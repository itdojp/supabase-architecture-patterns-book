"""
Supabase Architecture Patterns - Performance Monitoring
包括的なパフォーマンス監視とメトリクス収集の実装
"""

import time
import asyncio
import os
from functools import wraps
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta
import logging
from dataclasses import dataclass, field
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import structlog
from supabase import create_client, Client
import psutil
import json

# ロギング設定
logger = structlog.get_logger()

# === メトリクス定義 ===

# リクエスト関連
REQUEST_COUNT = Counter(
    'supabase_requests_total',
    'Total number of requests',
    ['method', 'endpoint', 'status', 'pattern']
)

REQUEST_DURATION = Histogram(
    'supabase_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint', 'pattern'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0]
)

# データベース関連
DB_CONNECTION_POOL = Gauge(
    'supabase_db_connections',
    'Number of active database connections',
    ['type']
)

DB_QUERY_DURATION = Histogram(
    'supabase_db_query_duration_seconds',
    'Database query duration in seconds',
    ['operation', 'table']
)

# システム関連
SYSTEM_CPU_USAGE = Gauge('system_cpu_usage_percent', 'System CPU usage percentage')
SYSTEM_MEMORY_USAGE = Gauge('system_memory_usage_percent', 'System memory usage percentage')
SYSTEM_DISK_USAGE = Gauge('system_disk_usage_percent', 'System disk usage percentage')

# === パフォーマンス監視クラス ===

@dataclass
class PerformanceMetrics:
    """パフォーマンスメトリクスの収集と管理"""
    
    pattern_name: str
    supabase_client: Client
    metrics_buffer: Dict[str, Any] = field(default_factory=dict)
    alert_thresholds: Dict[str, float] = field(default_factory=lambda: {
        'response_time': 1.0,  # 1秒
        'error_rate': 0.05,    # 5%
        'cpu_usage': 80.0,     # 80%
        'memory_usage': 85.0,  # 85%
    })
    
    def __post_init__(self):
        """初期化後の設定"""
        self.start_time = time.time()
        self.last_metrics_update = time.time()
        self.request_times = []
        self.error_count = 0
        self.total_requests = 0
    
    def record_request(self, method: str, endpoint: str, duration: float, status: int):
        """リクエストメトリクスを記録"""
        status_label = "success" if status < 400 else "error"
        
        REQUEST_COUNT.labels(
            method=method,
            endpoint=endpoint,
            status=status_label,
            pattern=self.pattern_name
        ).inc()
        
        REQUEST_DURATION.labels(
            method=method,
            endpoint=endpoint,
            pattern=self.pattern_name
        ).observe(duration)
        
        # 内部統計更新
        self.request_times.append(duration)
        self.total_requests += 1
        
        if status >= 400:
            self.error_count += 1
        
        # バッファサイズ制限（最新1000件）
        if len(self.request_times) > 1000:
            self.request_times = self.request_times[-1000:]
        
        # アラート チェック
        self._check_alerts(duration, status)
    
    def record_db_query(self, operation: str, table: str, duration: float):
        """データベースクエリメトリクスを記録"""
        DB_QUERY_DURATION.labels(
            operation=operation,
            table=table
        ).observe(duration)
    
    def update_system_metrics(self):
        """システムメトリクスの更新"""
        try:
            # CPU使用率
            cpu_percent = psutil.cpu_percent(interval=1)
            SYSTEM_CPU_USAGE.set(cpu_percent)
            
            # メモリ使用率
            memory = psutil.virtual_memory()
            SYSTEM_MEMORY_USAGE.set(memory.percent)
            
            # ディスク使用率
            disk = psutil.disk_usage('/')
            SYSTEM_DISK_USAGE.set(disk.percent)
            
            # データベース接続数
            # 実際の実装では、使用しているデータベースドライバーから接続プール情報を取得
            # 例: psycopg2の場合
            # active_connections = connection_pool.active_count()
            # idle_connections = connection_pool.idle_count()
            # ここではデモ用に環境変数またはデフォルト値を使用
            active_connections = int(os.getenv('DB_ACTIVE_CONNECTIONS', '0'))
            idle_connections = int(os.getenv('DB_IDLE_CONNECTIONS', '0'))
            DB_CONNECTION_POOL.labels(type='active').set(active_connections)
            DB_CONNECTION_POOL.labels(type='idle').set(idle_connections)
            
        except Exception as e:
            logger.error(f"Failed to update system metrics: {e}")
    
    def _check_alerts(self, duration: float, status: int):
        """アラート条件をチェック"""
        current_time = time.time()
        
        # レスポンスタイムアラート
        if duration > self.alert_thresholds['response_time']:
            self._send_alert('response_time', f"Slow response: {duration:.2f}s")
        
        # エラー率アラート（直近100リクエスト）
        if self.total_requests >= 100:
            recent_errors = sum(1 for t in self.request_times[-100:] if t > self.alert_thresholds['response_time'])
            error_rate = recent_errors / 100
            if error_rate > self.alert_thresholds['error_rate']:
                self._send_alert('error_rate', f"High error rate: {error_rate:.2%}")
    
    def _send_alert(self, alert_type: str, message: str):
        """アラートを送信"""
        logger.warning(f"ALERT [{alert_type}]: {message}")
        
        # Supabaseにアラートログを保存
        try:
            asyncio.create_task(self._save_alert_to_supabase(alert_type, message))
        except Exception as e:
            logger.error(f"Failed to save alert: {e}")
    
    async def _save_alert_to_supabase(self, alert_type: str, message: str):
        """アラートをSupabaseに保存"""
        try:
            await self.supabase.table('performance_alerts').insert({
                'alert_type': alert_type,
                'message': message,
                'pattern': self.pattern_name,
                'timestamp': datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            logger.error(f"Failed to save alert to Supabase: {e}")
    
    def get_summary_stats(self) -> Dict[str, Any]:
        """サマリー統計を取得"""
        if not self.request_times:
            return {}
        
        return {
            'total_requests': self.total_requests,
            'error_count': self.error_count,
            'error_rate': self.error_count / self.total_requests if self.total_requests > 0 else 0,
            'avg_response_time': sum(self.request_times) / len(self.request_times),
            'min_response_time': min(self.request_times),
            'max_response_time': max(self.request_times),
            'p95_response_time': sorted(self.request_times)[int(len(self.request_times) * 0.95)],
            'p99_response_time': sorted(self.request_times)[int(len(self.request_times) * 0.99)],
            'uptime': time.time() - self.start_time
        }

# === デコレーター ===

def monitor_performance(pattern_name: str):
    """パフォーマンス監視デコレーター"""
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            status = 200
            
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                status = 500
                logger.error(f"Error in {func.__name__}: {e}")
                raise
            finally:
                duration = time.time() - start_time
                
                # メトリクス記録（グローバルメトリクスマネージャーがある場合）
                if hasattr(func, '__self__') and hasattr(func.__self__, 'metrics'):
                    func.__self__.metrics.record_request(
                        method='ASYNC',
                        endpoint=func.__name__,
                        duration=duration,
                        status=status
                    )
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            status = 200
            
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                status = 500
                logger.error(f"Error in {func.__name__}: {e}")
                raise
            finally:
                duration = time.time() - start_time
                
                # メトリクス記録
                if hasattr(func, '__self__') and hasattr(func.__self__, 'metrics'):
                    func.__self__.metrics.record_request(
                        method='SYNC',
                        endpoint=func.__name__,
                        duration=duration,
                        status=status
                    )
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator

# === パフォーマンス最適化クラス ===

class PerformanceOptimizer:
    """パフォーマンス最適化の実装"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        self.query_cache = {}
        self.cache_ttl = 300  # 5分
    
    async def optimize_query(self, table: str, query: str, params: Dict[str, Any]) -> Any:
        """クエリの最適化"""
        # クエリキャッシュチェック
        cache_key = f"{table}:{query}:{hash(str(params))}"
        
        if cache_key in self.query_cache:
            cached_result, timestamp = self.query_cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                logger.info(f"Cache hit for query: {cache_key}")
                return cached_result
        
        # クエリ実行
        start_time = time.time()
        try:
            result = await self._execute_query(table, query, params)
            
            # キャッシュに保存
            self.query_cache[cache_key] = (result, time.time())
            
            # メトリクス記録
            duration = time.time() - start_time
            DB_QUERY_DURATION.labels(
                operation=query.split()[0].upper(),
                table=table
            ).observe(duration)
            
            return result
        except Exception as e:
            logger.error(f"Query optimization failed: {e}")
            raise
    
    async def _execute_query(self, table: str, query: str, params: Dict[str, Any]) -> Any:
        """実際のクエリ実行"""
        # ここで実際のSupabaseクエリを実行
        # 実装は具体的な用途に応じて変更
        return await self.supabase.table(table).select(query).execute()
    
    def clear_cache(self):
        """キャッシュクリア"""
        self.query_cache.clear()
        logger.info("Query cache cleared")

# === パターン別パフォーマンス分析 ===

class PatternPerformanceAnalyzer:
    """パターン別パフォーマンス分析"""
    
    def __init__(self):
        self.pattern_metrics = {}
    
    def add_pattern_metrics(self, pattern_name: str, metrics: PerformanceMetrics):
        """パターンメトリクスを追加"""
        self.pattern_metrics[pattern_name] = metrics
    
    def compare_patterns(self) -> Dict[str, Any]:
        """パターン間のパフォーマンス比較"""
        comparison = {}
        
        for pattern_name, metrics in self.pattern_metrics.items():
            stats = metrics.get_summary_stats()
            comparison[pattern_name] = {
                'avg_response_time': stats.get('avg_response_time', 0),
                'p95_response_time': stats.get('p95_response_time', 0),
                'error_rate': stats.get('error_rate', 0),
                'total_requests': stats.get('total_requests', 0),
                'uptime': stats.get('uptime', 0)
            }
        
        return comparison
    
    def get_recommendations(self) -> Dict[str, str]:
        """パフォーマンス改善推奨事項"""
        recommendations = {}
        comparison = self.compare_patterns()
        
        # レスポンスタイムによる推奨
        response_times = {name: data['avg_response_time'] for name, data in comparison.items()}
        fastest_pattern = min(response_times, key=response_times.get) if response_times else None
        
        if fastest_pattern:
            recommendations['fastest_pattern'] = f"最速パターン: {fastest_pattern} (平均レスポンス: {response_times[fastest_pattern]:.3f}s)"
        
        # エラー率による推奨
        error_rates = {name: data['error_rate'] for name, data in comparison.items()}
        most_reliable_pattern = min(error_rates, key=error_rates.get) if error_rates else None
        
        if most_reliable_pattern:
            recommendations['most_reliable_pattern'] = f"最も信頼性の高いパターン: {most_reliable_pattern} (エラー率: {error_rates[most_reliable_pattern]:.2%})"
        
        return recommendations

# === 使用例 ===

async def example_usage():
    """使用例"""
    # Supabaseクライアント初期化
    supabase = create_client("YOUR_SUPABASE_URL", "YOUR_SUPABASE_KEY")
    
    # パフォーマンス監視の初期化
    pattern1_metrics = PerformanceMetrics("pattern1", supabase)
    pattern2_metrics = PerformanceMetrics("pattern2", supabase)
    pattern3_metrics = PerformanceMetrics("pattern3", supabase)
    
    # パフォーマンス分析器の初期化
    analyzer = PatternPerformanceAnalyzer()
    analyzer.add_pattern_metrics("pattern1", pattern1_metrics)
    analyzer.add_pattern_metrics("pattern2", pattern2_metrics)
    analyzer.add_pattern_metrics("pattern3", pattern3_metrics)
    
    # シミュレーション: 各パターンでのリクエスト処理
    import random
    
    for i in range(100):
        # Pattern 1のシミュレーション
        duration = random.uniform(0.1, 0.5)
        status = 200 if random.random() > 0.05 else 500
        pattern1_metrics.record_request("GET", "/posts", duration, status)
        
        # Pattern 2のシミュレーション
        duration = random.uniform(0.05, 0.3)
        status = 200 if random.random() > 0.02 else 500
        pattern2_metrics.record_request("GET", "/posts", duration, status)
        
        # Pattern 3のシミュレーション
        duration = random.uniform(0.02, 0.2)
        status = 200 if random.random() > 0.01 else 500
        pattern3_metrics.record_request("GET", "/posts", duration, status)
    
    # パフォーマンス比較
    comparison = analyzer.compare_patterns()
    recommendations = analyzer.get_recommendations()
    
    print("=== パフォーマンス比較 ===")
    for pattern, stats in comparison.items():
        print(f"{pattern}:")
        print(f"  平均レスポンス時間: {stats['avg_response_time']:.3f}s")
        print(f"  P95レスポンス時間: {stats['p95_response_time']:.3f}s")
        print(f"  エラー率: {stats['error_rate']:.2%}")
        print(f"  総リクエスト数: {stats['total_requests']}")
        print()
    
    print("=== 推奨事項 ===")
    for key, recommendation in recommendations.items():
        print(f"{key}: {recommendation}")

if __name__ == "__main__":
    asyncio.run(example_usage())