---
layout: book
order: 13
title: "第8章：運用監視と自動化"
---
# 第8章：運用監視と自動化

```text
 システム運用を病院の管理システムで考えてみよう
├──  健康診断（パフォーマンス監視）：定期的な状態チェック
├──  バイタルサイン（メトリクス監視）：心拍数・血圧・体温の常時測定
├── [CRITICAL] 緊急警報（アラートシステム）：異常値検知時の即座通知
├──  自動治療（自動修復）：問題発見時の自動対処
└──  カルテ管理（ログ分析）：過去の症状と治療記録の保管

 システム運用管理
├──  パフォーマンス監視：CPU・メモリ・ディスク使用率の監視
├──  メトリクス監視：レスポンス時間・エラー率・スループットの測定
├── [CRITICAL] アラートシステム：異常検知時の管理者への自動通知
├──  自動復旧：負荷分散・スケーリング・再起動の自動実行
└──  ログ分析：エラーログ・アクセスログ・監査ログの分析
```

## この章で学ぶこと

「アプリが動いているから大丈夫」と思って放置していると、ある日突然「サイトが重い」「エラーが多発している」「データが消えている」といった**運用トラブル**に見舞われます。しかし、**適切な監視と自動化**があれば、問題を事前に発見し、迅速に対処できます。

### 初心者が陥りがちな問題
```python
# [NG] よくある初心者の運用方法
def check_system_health():
    # 手動で管理画面を見に行く
    # エラーが起きてからユーザーからの報告で気づく
    # サーバーが落ちていることに数時間後に気づく
    pass
```

### [OK] この章で作る自動運用システム
```python
# [OK] 自動監視・自動対処システム
@monitor_performance(threshold_ms=2000)
@auto_scale(cpu_threshold=80, memory_threshold=85)
@alert_on_error(error_rate_threshold=1.0)
def api_endpoint():
    # エラー発生→即座に通知
    # 負荷増加→自動スケーリング
    # 異常検知→自動修復
    return handle_request()
```

### 学習進度別ガイド

| レベル | 対象者 | 学習内容 | 所要時間 |
|:------|:-------|:---------|----------:|
|  **基礎**| 手動運用しかしたことがない方 | 監視の基本・メトリクス理解・簡単なアラート | 6〜8時間 |
|  **応用**| 基本的な監視ができる方 | 自動スケーリング・ログ分析・障害対応 | 8〜12時間 |
|  **発展**| 本格運用を目指す方 | CI/CD・インフラ自動化・予防保守 | 12〜16時間 |

---

### この章で扱う構成
- 構成: 共通（運用監視・自動化）
- 推奨用途: チーム運用/商用運用
- 非推奨用途: 個人PoCで運用を最小化したいケース

## 8.1 システム監視の基礎（病院のバイタルサイン監視）

病院で患者の心拍数や血圧を常時監視するように、**システムの健康状態を24時間365日監視**することで、問題を早期発見し、迅速に対処できます。

```text
 患者の健康監視システム
├──  心拍数モニター：1分間の心拍数を測定
├──  血圧計：最高血圧・最低血圧を定期測定
├──  体温計：体温の変化を追跡
├──  ベッドサイドモニター：すべての数値を一画面で表示
└── [CRITICAL] ナースコール：異常値検知時に看護師に即座通知

 システム健康監視システム
├──  CPU使用率：プロセッサーの負荷状況を監視
├──  メモリ使用率：RAMの使用状況を追跡
├──  レスポンス時間：API応答時間の測定
├──  ダッシュボード：すべてのメトリクスを一画面で表示
└── [CRITICAL] アラート：異常値検知時に管理者に即座通知
```

### Step 1: 基本的なパフォーマンス監視システム

まず、システムの「バイタルサイン」を監視する基本的なシステムを構築しましょう：

```python
# app/monitoring/system_health.py（システム健康診断システム）
import psutil
import time
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

class HealthStatus(Enum):
    HEALTHY = "healthy"      # 正常（緑）
    WARNING = "warning"      # 注意（黄）
    CRITICAL = "critical"    # 危険（赤）
    UNKNOWN = "unknown"      # 不明（グレー）

@dataclass
class HealthMetric:
    """健康指標（バイタルサイン）"""
    name: str                    # 指標名（CPU使用率、メモリ使用率など）
    value: float                 # 現在値
    unit: str                    # 単位（%、MB、msなど）
    status: HealthStatus         # 健康状態
    threshold_warning: float     # 警告しきい値
    threshold_critical: float    # 危険しきい値
    timestamp: datetime          # 測定時刻
    message: str                 # 状況説明メッセージ

class SystemHealthMonitor:
    """システム健康監視システム（病院のモニタリングシステム）"""
    
    def __init__(self):
        self.supabase_url = "https://your-project.supabase.co"
        self.supabase_key = "sb_publishable_XXXXXXXXXXXXXXXX"
        
        #  健康しきい値設定（病院の正常値範囲）
        self.thresholds = {
            'cpu_usage': {'warning': 70.0, 'critical': 85.0},           # CPU使用率
            'memory_usage': {'warning': 75.0, 'critical': 90.0},        # メモリ使用率
            'disk_usage': {'warning': 80.0, 'critical': 95.0},          # ディスク使用率
            'response_time': {'warning': 2000.0, 'critical': 5000.0},   # レスポンス時間(ms)
            'error_rate': {'warning': 1.0, 'critical': 5.0},            # エラー率(%)
            'database_connections': {'warning': 80.0, 'critical': 95.0} # DB接続使用率
        }
    
    def check_system_health(self) -> Dict[str, HealthMetric]:
        """システム全体の健康診断（総合健康チェック）"""
        
        health_metrics = {}
        
        #  CPU使用率チェック（心拍数のような基本バイタル）
        cpu_metric = self._check_cpu_usage()
        health_metrics['cpu'] = cpu_metric
        
        #  メモリ使用率チェック（血圧のような重要指標）
        memory_metric = self._check_memory_usage()
        health_metrics['memory'] = memory_metric
        
        #  ディスク使用率チェック（体重のような容量指標）
        disk_metric = self._check_disk_usage()
        health_metrics['disk'] = disk_metric
        
        #  ネットワーク応答時間チェック（反射神経のような反応速度）
        response_metric = self._check_response_time()
        health_metrics['response_time'] = response_metric
        
        #  データベース接続チェック（血液循環のような重要機能）
        db_metric = self._check_database_health()
        health_metrics['database'] = db_metric
        
        #  Supabase API健康チェック（生命維持装置のような外部依存）
        supabase_metric = self._check_supabase_health()
        health_metrics['supabase'] = supabase_metric
        
        return health_metrics
    
    def _check_cpu_usage(self) -> HealthMetric:
        """CPU使用率チェック（心拍数測定）"""
        
        #  5秒間の平均CPU使用率を測定
        cpu_percent = psutil.cpu_percent(interval=5)
        
        #  健康状態判定
        thresholds = self.thresholds['cpu_usage']
        if cpu_percent >= thresholds['critical']:
            status = HealthStatus.CRITICAL
            message = f"[WARN] CPU使用率が危険レベル！サーバー増強が必要です"
        elif cpu_percent >= thresholds['warning']:
            status = HealthStatus.WARNING  
            message = f" CPU使用率が高めです。最適化を検討してください"
        else:
            status = HealthStatus.HEALTHY
            message = f"[OK] CPU使用率は正常範囲内です"
        
        return HealthMetric(
            name="CPU使用率",
            value=cpu_percent,
            unit="%",
            status=status,
            threshold_warning=thresholds['warning'],
            threshold_critical=thresholds['critical'],
            timestamp=datetime.now(),
            message=message
        )
    
    def _check_memory_usage(self) -> HealthMetric:
        """メモリ使用率チェック（血圧測定）"""
        
        #  メモリ使用状況を取得
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        #  使用量を分かりやすい単位に変換
        used_gb = memory.used / (1024**3)  # ギガバイト
        total_gb = memory.total / (1024**3)
        
        #  健康状態判定
        thresholds = self.thresholds['memory_usage']
        if memory_percent >= thresholds['critical']:
            status = HealthStatus.CRITICAL
            message = f"[CRITICAL] メモリ不足が深刻！{used_gb:.1f}GB/{total_gb:.1f}GB使用中"
        elif memory_percent >= thresholds['warning']:
            status = HealthStatus.WARNING
            message = f"[WARN] メモリ使用量が多めです {used_gb:.1f}GB/{total_gb:.1f}GB"
        else:
            status = HealthStatus.HEALTHY
            message = f"[OK] メモリ使用量は正常 {used_gb:.1f}GB/{total_gb:.1f}GB"
        
        return HealthMetric(
            name="メモリ使用率",
            value=memory_percent,
            unit="%",
            status=status,
            threshold_warning=thresholds['warning'],
            threshold_critical=thresholds['critical'],
            timestamp=datetime.now(),
            message=message
        )
    
    def _check_disk_usage(self) -> HealthMetric:
        """ディスク使用率チェック（体重測定）"""
        
        #  ディスク使用状況を取得
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        
        #  使用量を分かりやすい単位に変換
        used_gb = disk.used / (1024**3)
        total_gb = disk.total / (1024**3)
        free_gb = disk.free / (1024**3)
        
        #  健康状態判定
        thresholds = self.thresholds['disk_usage']
        if disk_percent >= thresholds['critical']:
            status = HealthStatus.CRITICAL
            message = f" ディスク容量が危険！残り{free_gb:.1f}GB"
        elif disk_percent >= thresholds['warning']:
            status = HealthStatus.WARNING
            message = f"[WARN] ディスク容量に注意 残り{free_gb:.1f}GB"
        else:
            status = HealthStatus.HEALTHY
            message = f"[OK] ディスク容量に余裕あり 残り{free_gb:.1f}GB"
        
        return HealthMetric(
            name="ディスク使用率",
            value=disk_percent,
            unit="%",
            status=status,
            threshold_warning=thresholds['warning'],
            threshold_critical=thresholds['critical'],
            timestamp=datetime.now(),
            message=message
        )
    
    def _check_response_time(self) -> HealthMetric:
        """API応答時間チェック（反射神経テスト）"""
        
        try:
            #  自分のAPIエンドポイントに対するレスポンス時間を測定
            start_time = time.time()
            response = requests.get(f"{self.supabase_url}/rest/v1/", 
                                  headers={"apikey": self.supabase_key},
                                  timeout=10)
            end_time = time.time()
            
            response_time_ms = (end_time - start_time) * 1000  # ミリ秒
            
            #  健康状態判定
            thresholds = self.thresholds['response_time']
            if response_time_ms >= thresholds['critical']:
                status = HealthStatus.CRITICAL
                message = f" APIレスポンスが非常に遅い！{response_time_ms:.0f}ms"
            elif response_time_ms >= thresholds['warning']:
                status = HealthStatus.WARNING
                message = f" APIレスポンスが遅めです {response_time_ms:.0f}ms"
            else:
                status = HealthStatus.HEALTHY
                message = f" APIレスポンスは高速 {response_time_ms:.0f}ms"
            
            return HealthMetric(
                name="API応答時間",
                value=response_time_ms,
                unit="ms",
                status=status,
                threshold_warning=thresholds['warning'],
                threshold_critical=thresholds['critical'],
                timestamp=datetime.now(),
                message=message
            )
            
        except Exception as e:
            # [NG] 接続できない場合
            return HealthMetric(
                name="API応答時間",
                value=999999,  # 非常に大きな値
                unit="ms",
                status=HealthStatus.CRITICAL,
                threshold_warning=self.thresholds['response_time']['warning'],
                threshold_critical=self.thresholds['response_time']['critical'],
                timestamp=datetime.now(),
                message=f" API接続エラー: {str(e)}"
            )
    
    def _check_database_health(self) -> HealthMetric:
        """データベース健康チェック（血液検査）"""
        
        try:
            #  Supabaseへの簡単なクエリでDB接続をテスト
            start_time = time.time()
            response = requests.get(
                f"{self.supabase_url}/rest/v1/health?select=status",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                },
                timeout=5
            )
            end_time = time.time()
            
            query_time_ms = (end_time - start_time) * 1000
            
            if response.status_code == 200:
                # [OK] 接続成功
                if query_time_ms < 500:
                    status = HealthStatus.HEALTHY
                    message = f"[OK] データベース接続良好 {query_time_ms:.0f}ms"
                elif query_time_ms < 2000:
                    status = HealthStatus.WARNING
                    message = f"[WARN] データベース応答が遅め {query_time_ms:.0f}ms"
                else:
                    status = HealthStatus.CRITICAL
                    message = f" データベース応答が非常に遅い {query_time_ms:.0f}ms"
            else:
                # [NG] エラーレスポンス
                status = HealthStatus.CRITICAL
                message = f" データベースエラー: HTTP {response.status_code}"
            
            return HealthMetric(
                name="データベース接続",
                value=query_time_ms,
                unit="ms",
                status=status,
                threshold_warning=500,
                threshold_critical=2000,
                timestamp=datetime.now(),
                message=message
            )
            
        except Exception as e:
            # [NG] 接続例外
            return HealthMetric(
                name="データベース接続",
                value=999999,
                unit="ms",
                status=HealthStatus.CRITICAL,
                threshold_warning=500,
                threshold_critical=2000,
                timestamp=datetime.now(),
                message=f" データベース接続不可: {str(e)}"
            )
    
    def _check_supabase_health(self) -> HealthMetric:
        """Supabase サービス健康チェック（外部機器チェック）"""
        
        try:
            #  Supabaseの各サービスをチェック
            services_status = []
            
            # Auth service check
            auth_response = requests.get(f"{self.supabase_url}/auth/v1/health", timeout=5)
            auth_healthy = auth_response.status_code == 200
            services_status.append(("認証", auth_healthy))
            
            # Storage service check (if available)
            try:
                storage_response = requests.get(f"{self.supabase_url}/storage/v1/object", 
                                              headers={"apikey": self.supabase_key}, 
                                              timeout=5)
                storage_healthy = storage_response.status_code in [200, 400]  # 400 is OK for this endpoint
                services_status.append(("ストレージ", storage_healthy))
            except:
                services_status.append(("ストレージ", False))
            
            #  全体の健康状態を判定
            healthy_services = sum(1 for _, healthy in services_status if healthy)
            total_services = len(services_status)
            health_percentage = (healthy_services / total_services) * 100
            
            if health_percentage == 100:
                status = HealthStatus.HEALTHY
                message = f"[OK] Supabaseサービス全て正常 ({healthy_services}/{total_services})"
            elif health_percentage >= 50:
                status = HealthStatus.WARNING
                message = f"[WARN] 一部サービスに問題 ({healthy_services}/{total_services})"
            else:
                status = HealthStatus.CRITICAL
                message = f" Supabaseサービスに深刻な問題 ({healthy_services}/{total_services})"
            
            return HealthMetric(
                name="Supabaseサービス",
                value=health_percentage,
                unit="%",
                status=status,
                threshold_warning=80,
                threshold_critical=50,
                timestamp=datetime.now(),
                message=message
            )
            
        except Exception as e:
            return HealthMetric(
                name="Supabaseサービス",
                value=0,
                unit="%",
                status=HealthStatus.CRITICAL,
                threshold_warning=80,
                threshold_critical=50,
                timestamp=datetime.now(),
                message=f" Supabaseサービスチェック失敗: {str(e)}"
            )
    
    def get_overall_health_status(self, metrics: Dict[str, HealthMetric]) -> HealthStatus:
        """総合健康状態判定（総合診断）"""
        
        # [CRITICAL] 一つでもCRITICALがあれば全体もCRITICAL
        if any(metric.status == HealthStatus.CRITICAL for metric in metrics.values()):
            return HealthStatus.CRITICAL
        
        # [WARN] 一つでもWARNINGがあれば全体もWARNING  
        if any(metric.status == HealthStatus.WARNING for metric in metrics.values()):
            return HealthStatus.WARNING
        
        # [OK] 全てHEALTHYなら全体もHEALTHY
        return HealthStatus.HEALTHY

#  使用例：ヘルスチェック実行デモ
def demo_health_monitoring():
    """ヘルスモニタリングのデモ実行"""
    
    print(" システム健康診断を開始します...")
    print("=" * 50)
    
    monitor = SystemHealthMonitor()
    
    #  全体の健康チェック実行
    health_metrics = monitor.check_system_health()
    overall_status = monitor.get_overall_health_status(health_metrics)
    
    #  結果表示
    print(f" 総合健康状態: {overall_status.value.upper()}")
    print("-" * 50)
    
    for metric_name, metric in health_metrics.items():
        status_emoji = {
            HealthStatus.HEALTHY: "[OK]",
            HealthStatus.WARNING: "[WARN]", 
            HealthStatus.CRITICAL: "[CRITICAL]",
            HealthStatus.UNKNOWN: "UNKNOWN"
        }
        
        print(f"{status_emoji[metric.status]} {metric.name}: {metric.value:.1f}{metric.unit}")
        print(f"   {metric.message}")
        print(f"   警告レベル: {metric.threshold_warning}{metric.unit}, 危険レベル: {metric.threshold_critical}{metric.unit}")
        print()
    
    return overall_status, health_metrics

if __name__ == "__main__":
    demo_health_monitoring()
```

**初心者向け解説**：

このシステム監視の活用例：

| 監視項目 | 正常値 | 警告値 | 危険値 | 対処法 |
|:---------|:-------|:-------|:-------|:-------|
| **CPU使用率**| 0〜70% | 70〜85% | 85%以上 | プロセス最適化・サーバー増強 |
| **メモリ使用率**| 0〜75% | 75〜90% | 90%以上 | メモリリーク調査・メモリ増設 |
| **ディスク使用率**| 0〜80% | 80〜95% | 95%以上 | ファイル削除・ストレージ拡張 |
| **API応答時間**| 0〜2秒 | 2〜5秒 | 5秒以上 | クエリ最適化・CDN導入 |

### AI運用メトリクス（RAG/埋め込み/推論の監視）

AIを組み込む場合は、通常のインフラ指標に加えて **AI特有の運用指標**が必要です。  
以下は最小セットの例です。

| 指標 | 目的 | 例 |
|:-----|:-----|:---|
| **token / cost**| 予算超過の防止 | 1日あたりの推定コスト |
| **latency**| 体感品質の維持 | P95 応答時間 |
| **error rate**| 推論失敗の検知 | 5xx / timeout率 |
| **embedding backlog**| バッチ遅延の検知 | キュー滞留数 |
| **retrieval hit rate**| 検索品質の把握 | top-k の命中率 |

> 注意: 指標の定義や取得方法は採用するモデル/プラットフォームにより変わるため、最新仕様を確認してください。

### Advisor（Security/Performance/Index）の使い方

SupabaseのAdvisor系機能は便利ですが、**誤検知や環境依存**があります。  
以下のルールで取り込みます。

- **Security Advisor**: 重大度が高いものから対応。例外が必要なら根拠を記録
- **Performance Advisor**: 影響範囲を測定してから適用（ステージングで検証）
- **Index Advisor**: 追加前に `EXPLAIN` を確認し、不要なら採用しない

### Step 2: ダッシュボードシステム（ナースステーションの監視画面）

病院のナースステーションに設置された大型モニターのように、**システムの健康状態を一目で把握できるダッシュボード**を作成します：

```python
# app/monitoring/dashboard.py（監視ダッシュボードシステム）
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import psutil

class HealthDashboard:
    """健康監視ダッシュボード（ナースステーション監視画面）"""
    
    def __init__(self):
        self.monitor = SystemHealthMonitor()
        self.connected_clients: List[WebSocket] = []
        self.is_monitoring = False
        
    async def start_real_time_monitoring(self):
        """リアルタイム監視開始（24時間監視体制）"""
        
        self.is_monitoring = True
        
        while self.is_monitoring:
            try:
                #  健康状態チェック実行
                health_metrics = self.monitor.check_system_health()
                overall_status = self.monitor.get_overall_health_status(health_metrics)
                
                #  接続中のクライアントに結果を送信
                dashboard_data = {
                    "timestamp": datetime.now().isoformat(),
                    "overall_status": overall_status.value,
                    "metrics": {
                        name: {
                            "name": metric.name,
                            "value": metric.value,
                            "unit": metric.unit,
                            "status": metric.status.value,
                            "message": metric.message,
                            "threshold_warning": metric.threshold_warning,
                            "threshold_critical": metric.threshold_critical
                        }
                        for name, metric in health_metrics.items()
                    }
                }
                
                #  WebSocketで全クライアントに送信
                await self._broadcast_to_clients(dashboard_data)
                
                # [CRITICAL] クリティカルな状態の場合は即座に再チェック
                if overall_status == HealthStatus.CRITICAL:
                    await asyncio.sleep(10)  # 10秒後に再チェック
                else:
                    await asyncio.sleep(60)  # 通常は1分間隔
                    
            except Exception as e:
                print(f"[NG] 監視エラー: {e}")
                await asyncio.sleep(30)  # エラー時は30秒待機
    
    async def _broadcast_to_clients(self, data: Dict[str, Any]):
        """接続中の全クライアントにデータ送信"""
        
        if not self.connected_clients:
            return
            
        disconnected_clients = []
        
        for client in self.connected_clients:
            try:
                await client.send_text(json.dumps(data))
            except WebSocketDisconnect:
                #  切断されたクライアントを記録
                disconnected_clients.append(client)
            except Exception as e:
                print(f"[WARN] クライアント送信エラー: {e}")
                disconnected_clients.append(client)
        
        #  切断されたクライアントを削除
        for client in disconnected_clients:
            self.connected_clients.remove(client)
    
    async def connect_client(self, websocket: WebSocket):
        """新しいクライアント接続"""
        
        await websocket.accept()
        self.connected_clients.append(websocket)
        print(f" 新しいクライアント接続: 現在{len(self.connected_clients)}台")
        
        #  初回データ送信
        health_metrics = self.monitor.check_system_health()
        overall_status = self.monitor.get_overall_health_status(health_metrics)
        
        initial_data = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": overall_status.value,
            "metrics": {
                name: {
                    "name": metric.name,
                    "value": metric.value,
                    "unit": metric.unit,
                    "status": metric.status.value,
                    "message": metric.message,
                    "threshold_warning": metric.threshold_warning,
                    "threshold_critical": metric.threshold_critical
                }
                for name, metric in health_metrics.items()
            }
        }
        
        await websocket.send_text(json.dumps(initial_data))
    
    def disconnect_client(self, websocket: WebSocket):
        """クライアント切断"""
        
        if websocket in self.connected_clients:
            self.connected_clients.remove(websocket)
            print(f" クライアント切断: 現在{len(self.connected_clients)}台")

#  FastAPI ダッシュボードアプリケーション
app = FastAPI(title="System Health Dashboard", description="システム健康監視ダッシュボード")
dashboard = HealthDashboard()

# 静的ファイル配信（HTML、CSS、JavaScript）
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.on_event("startup")
async def startup_event():
    """アプリケーション起動時に監視開始"""
    asyncio.create_task(dashboard.start_real_time_monitoring())

@app.get("/", response_class=HTMLResponse)
async def get_dashboard():
    """ダッシュボードページ表示"""
    
    #  シンプルなダッシュボードHTML
    html_content = """
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title> システム健康監視ダッシュボード</title>
        <style>
            body {
                font-family: 'Segoe UI', sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .dashboard {
                max-width: 1200px;
                margin: 0 auto;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .overall-status {
                text-align: center;
                font-size: 2em;
                margin-bottom: 30px;
                padding: 20px;
                border-radius: 10px;
                background: rgba(255,255,255,0.1);
            }
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .metric-card {
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
                padding: 20px;
                backdrop-filter: blur(10px);
            }
            .metric-name {
                font-size: 1.2em;
                margin-bottom: 10px;
                font-weight: bold;
            }
            .metric-value {
                font-size: 2.5em;
                margin: 10px 0;
                font-weight: bold;
            }
            .metric-message {
                font-size: 0.9em;
                opacity: 0.8;
                margin-top: 10px;
            }
            .status-healthy { color: #4CAF50; }
            .status-warning { color: #FF9800; }
            .status-critical { color: #F44336; }
            .status-unknown { color: #9E9E9E; }
            .timestamp {
                text-align: center;
                opacity: 0.7;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="dashboard">
            <div class="header">
                <h1> システム健康監視ダッシュボード</h1>
                <p>リアルタイム監視システム - 24時間365日稼働</p>
            </div>
            
            <div class="overall-status" id="overall-status">
                 監視システム起動中...
            </div>
            
            <div class="metrics-grid" id="metrics-grid">
                <!-- メトリクスカードがここに動的に追加されます -->
            </div>
            
            <div class="timestamp" id="timestamp">
                最終更新: 接続中...
            </div>
        </div>

        <script>
            //  WebSocket接続
            const ws = new WebSocket(`ws://${window.location.host}/ws`);
            
            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                updateDashboard(data);
            };
            
            ws.onopen = function() {
                console.log('[OK] ダッシュボード接続成功');
            };
            
            ws.onerror = function(error) {
                console.error('[NG] WebSocket エラー:', error);
            };
            
            ws.onclose = function() {
                console.log(' ダッシュボード接続終了');
                setTimeout(() => location.reload(), 5000); // 5秒後に再接続
            };
            
            function updateDashboard(data) {
                //  総合ステータス更新
                const overallStatus = document.getElementById('overall-status');
                const statusEmoji = {
                    'healthy': '[OK]',
                    'warning': '[WARN]', 
                    'critical': '[CRITICAL]',
                    'unknown': 'UNKNOWN'
                };
                
                overallStatus.innerHTML = `
                    ${statusEmoji[data.overall_status]} 
                    システム総合状態: ${data.overall_status.toUpperCase()}
                `;
                overallStatus.className = `overall-status status-${data.overall_status}`;
                
                //  メトリクス更新
                const metricsGrid = document.getElementById('metrics-grid');
                metricsGrid.innerHTML = '';
                
                Object.entries(data.metrics).forEach(([key, metric]) => {
                    const card = document.createElement('div');
                    card.className = 'metric-card';
                    card.innerHTML = `
                        <div class="metric-name">${metric.name}</div>
                        <div class="metric-value status-${metric.status}">
                            ${metric.value.toFixed(1)}${metric.unit}
                        </div>
                        <div class="metric-message">${metric.message}</div>
                        <div style="font-size: 0.8em; margin-top: 10px; opacity: 0.6;">
                            警告: ${metric.threshold_warning}${metric.unit} / 
                            危険: ${metric.threshold_critical}${metric.unit}
                        </div>
                    `;
                    metricsGrid.appendChild(card);
                });
                
                //  タイムスタンプ更新
                const timestamp = document.getElementById('timestamp');
                const updateTime = new Date(data.timestamp).toLocaleString('ja-JP');
                timestamp.textContent = `最終更新: ${updateTime}`;
            }
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket接続エンドポイント"""
    
    await dashboard.connect_client(websocket)
    
    try:
        # 接続維持（クライアントが切断するまで待機）
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        dashboard.disconnect_client(websocket)

@app.get("/api/health")
async def get_health_status():
    """健康状態API（外部監視システム用）"""
    
    health_metrics = dashboard.monitor.check_system_health()
    overall_status = dashboard.monitor.get_overall_health_status(health_metrics)
    
    return {
        "status": overall_status.value,
        "timestamp": datetime.now().isoformat(),
        "metrics": {
            name: {
                "value": metric.value,
                "unit": metric.unit,
                "status": metric.status.value,
                "message": metric.message
            }
            for name, metric in health_metrics.items()
        }
    }
```

**初心者向け解説**：

このダッシュボードシステムの特徴：

| 機能 | 病院の例 | システムダッシュボード | 利点 |
|:-----|:--------|:---------------------|:-----|
| **リアルタイム表示**| ベッドサイドモニター | WebSocketでライブ更新 | 即座に状況把握 |
| **色分け表示**| 緑・黄・赤のランプ | ステータス色でわかりやすく | 直感的な理解 |
| **複数画面対応**| 複数のナースステーション | 複数ブラウザで同時監視 | チーム全体で共有 |
| **履歴記録**| 患者カルテ | メトリクス履歴保存 | 傾向分析が可能 |

## 8.2 アラートシステム（緊急通報システム）

病院で患者の容体が急変したときに看護師や医師に緊急通報するように、**システムに異常が発生したときに管理者に即座に通知**するシステムを構築します。

```text
 病院の緊急通報システム
├── [CRITICAL] ナースコール：ベッドサイドから緊急時に看護師呼び出し
├──  PHS・スマホ通知：担当医に即座にメッセージ送信
├──  院内放送：緊急事態時の全体への周知
├──  家族への連絡：重篤な場合の家族への緊急連絡
└──  記録システム：いつ・誰に・何を通知したかの詳細記録

 システム緊急通報システム
├── [CRITICAL] 即座アラート：異常検知後30秒以内の通知
├──  複数チャネル：Slack・メール・SMS・Discord
├──  エスカレーション：レベルに応じた通知先の拡大
├──  ステークホルダー通知：重大障害時の経営層への報告
└──  通知履歴：アラート履歴と対応状況の追跡
```

### Step 1: 多チャネル通知システム

```python
# app/monitoring/alerts.py（緊急通知システム）
import smtplib
import requests
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class AlertLevel(Enum):
    INFO = "info"           # 情報（青）：参考情報
    WARNING = "warning"     # 警告（黄）：注意が必要
    CRITICAL = "critical"   # 危険（赤）：即座対応必要
    EMERGENCY = "emergency" # 緊急（紫）：全社対応必要

class NotificationChannel(Enum):
    EMAIL = "email"         # メール通知
    SLACK = "slack"         # Slack通知
    SMS = "sms"            # SMS通知
    DISCORD = "discord"     # Discord通知
    WEBHOOK = "webhook"     # Webhook通知

@dataclass
class AlertRule:
    """アラートルール（通知条件設定）"""
    name: str                           # ルール名
    condition: str                      # 発動条件
    level: AlertLevel                   # アラートレベル
    channels: List[NotificationChannel] # 通知チャネル
    recipients: Dict[str, List[str]]    # 通知先（チャネル別）
    cooldown_minutes: int = 15          # 連続通知防止（分）
    auto_resolve_minutes: int = 60      # 自動解決時間（分）

class AlertManager:
    """アラート管理システム（病院の緊急通報指令センター）"""
    
    def __init__(self):
        #  メール設定
        self.smtp_config = {
            'host': 'smtp.gmail.com',
            'port': 587,
            'username': 'your-email@gmail.com',
            'password': 'your-app-password',
            'from_email': 'system-monitor@yourcompany.com'
        }
        
        #  Slack設定
        self.slack_webhook_url = "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
        
        #  SMS設定（Twilio例）
        self.sms_config = {
            'account_sid': 'your-twilio-account-sid',
            'auth_token': 'your-twilio-auth-token',
            'from_number': '+1234567890'
        }
        
        #  Discord設定
        self.discord_webhook_url = "https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK"
        
        #  アラート履歴管理
        self.active_alerts: Dict[str, Dict] = {}  # 現在のアクティブアラート
        self.alert_history: List[Dict] = []       # アラート履歴
        
        #  アラートルール設定
        self.alert_rules = [
            AlertRule(
                name="高CPU使用率",
                condition="cpu_usage >= 85",
                level=AlertLevel.CRITICAL,
                channels=[NotificationChannel.SLACK, NotificationChannel.EMAIL],
                recipients={
                    "slack": ["#system-alerts", "#dev-team"],
                    "email": ["admin@company.com", "dev-team@company.com"]
                },
                cooldown_minutes=10
            ),
            AlertRule(
                name="メモリ不足",
                condition="memory_usage >= 90",
                level=AlertLevel.CRITICAL,
                channels=[NotificationChannel.SLACK, NotificationChannel.EMAIL, NotificationChannel.SMS],
                recipients={
                    "slack": ["#system-alerts"],
                    "email": ["admin@company.com"],
                    "sms": ["+818012345678"]  # 管理者の携帯
                },
                cooldown_minutes=5
            ),
            AlertRule(
                name="API応答遅延",
                condition="response_time >= 5000",
                level=AlertLevel.WARNING,
                channels=[NotificationChannel.SLACK],
                recipients={
                    "slack": ["#dev-team"]
                },
                cooldown_minutes=15
            ),
            AlertRule(
                name="システム完全停止",
                condition="overall_status == critical AND database_connection == false",
                level=AlertLevel.EMERGENCY,
                channels=[NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.SLACK],
                recipients={
                    "email": ["ceo@company.com", "cto@company.com", "admin@company.com"],
                    "sms": ["+818011111111", "+818022222222"],  # 経営陣の携帯
                    "slack": ["#emergency-response"]
                },
                cooldown_minutes=0  # 緊急時は連続通知許可
            )
        ]
    
    async def process_health_metrics(self, health_metrics: Dict[str, Any], overall_status: str):
        """健康メトリクスを評価してアラート発動判定"""
        
        print(f" アラート評価開始: 総合ステータス = {overall_status}")
        
        #  各アラートルールを評価
        for rule in self.alert_rules:
            should_alert = self._evaluate_alert_condition(rule, health_metrics, overall_status)
            
            if should_alert:
                await self._trigger_alert(rule, health_metrics, overall_status)
            else:
                # [OK] 条件が解消された場合の自動解決
                await self._check_auto_resolve(rule, health_metrics)
    
    def _evaluate_alert_condition(self, rule: AlertRule, metrics: Dict[str, Any], overall_status: str) -> bool:
        """アラート条件評価（症状の重篤度判定）"""
        
        try:
            #  条件文字列をPython式として評価
            # 安全性のため、限定された変数のみ使用
            
            evaluation_context = {
                'overall_status': overall_status,
                'cpu_usage': metrics.get('cpu', {}).get('value', 0),
                'memory_usage': metrics.get('memory', {}).get('value', 0),
                'disk_usage': metrics.get('disk', {}).get('value', 0),
                'response_time': metrics.get('response_time', {}).get('value', 0),
                'database_connection': metrics.get('database', {}).get('status') == 'healthy'
            }
            
            #  条件を安全に評価
            result = eval(rule.condition, {"__builtins__": {}}, evaluation_context)
            
            if result:
                print(f"[CRITICAL] アラート条件成立: {rule.name} - {rule.condition}")
            
            return result
            
        except Exception as e:
            print(f"[NG] アラート条件評価エラー: {rule.name} - {e}")
            return False
    
    async def _trigger_alert(self, rule: AlertRule, metrics: Dict[str, Any], overall_status: str):
        """アラート発動（緊急通報実行）"""
        
        alert_id = f"{rule.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        #  クールダウンチェック（連続通知防止）
        if self._is_in_cooldown(rule):
            print(f" クールダウン中のためスキップ: {rule.name}")
            return
        
        print(f"[CRITICAL] アラート発動: {rule.name} (レベル: {rule.level.value})")
        
        #  アラート詳細情報作成
        alert_data = {
            'id': alert_id,
            'rule_name': rule.name,
            'level': rule.level.value,
            'timestamp': datetime.now().isoformat(),
            'condition': rule.condition,
            'metrics': metrics,
            'overall_status': overall_status,
            'message': self._generate_alert_message(rule, metrics, overall_status)
        }
        
        #  アクティブアラートに追加
        self.active_alerts[alert_id] = alert_data
        self.alert_history.append(alert_data)
        
        #  各チャネルに通知送信
        notification_tasks = []
        for channel in rule.channels:
            if channel in rule.recipients:
                task = self._send_notification(channel, rule, alert_data)
                notification_tasks.append(task)
        
        #  並行実行で高速通知
        if notification_tasks:
            await asyncio.gather(*notification_tasks, return_exceptions=True)
    
    def _generate_alert_message(self, rule: AlertRule, metrics: Dict[str, Any], overall_status: str) -> str:
        """アラートメッセージ生成（症状説明書作成）"""
        
        #  レベル別の絵文字
        level_emoji = {
            AlertLevel.INFO: "",
            AlertLevel.WARNING: "[WARN]", 
            AlertLevel.CRITICAL: "[CRITICAL]",
            AlertLevel.EMERGENCY: "[CRITICAL]"
        }
        
        #  基本メッセージ
        message = f"{level_emoji[rule.level]} **{rule.name}**\n"
        message += f"**レベル**: {rule.level.value.upper()}\n"
        message += f"**発生時刻**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        message += f"**総合ステータス**: {overall_status}\n\n"
        
        #  主要メトリクス情報
        message += "**現在の状況**:\n"
        for name, metric in metrics.items():
            if isinstance(metric, dict) and 'value' in metric:
                status_emoji = {"healthy": "[OK]", "warning": "[WARN]", "critical": "[CRITICAL]"}.get(metric.get('status', 'unknown'), "UNKNOWN")
                message += f"• {metric.get('name', name)}: {metric['value']:.1f}{metric.get('unit', '')} {status_emoji}\n"
        
        #  対処推奨事項
        message += f"\n**推奨対処**: {self._get_recommended_action(rule, metrics)}\n"
        
        return message
    
    def _get_recommended_action(self, rule: AlertRule, metrics: Dict[str, Any]) -> str:
        """推奨対処法提案（治療方針決定）"""
        
        #  ルール別の対処法ガイド
        action_guide = {
            "高CPU使用率": "プロセス使用率確認、不要プロセス停止、サーバースケールアップ検討",
            "メモリ不足": "メモリリーク調査、プロセス再起動、メモリ増設検討", 
            "API応答遅延": "データベースクエリ最適化、CDN設定確認、負荷分散検討",
            "システム完全停止": "即座にシステム再起動、障害原因調査、緊急対応チーム招集"
        }
        
        return action_guide.get(rule.name, "システム管理者に連絡してください")
    
    async def _send_notification(self, channel: NotificationChannel, rule: AlertRule, alert_data: Dict[str, Any]):
        """通知送信（各種通信手段での緊急連絡）"""
        
        try:
            recipients = rule.recipients.get(channel.value, [])
            
            if channel == NotificationChannel.EMAIL:
                await self._send_email_alert(recipients, alert_data)
            elif channel == NotificationChannel.SLACK:
                await self._send_slack_alert(recipients, alert_data)
            elif channel == NotificationChannel.SMS:
                await self._send_sms_alert(recipients, alert_data)
            elif channel == NotificationChannel.DISCORD:
                await self._send_discord_alert(recipients, alert_data)
                
            print(f"[OK] {channel.value} 通知送信完了: {len(recipients)}件")
            
        except Exception as e:
            print(f"[NG] {channel.value} 通知送信失敗: {e}")
    
    async def _send_email_alert(self, recipients: List[str], alert_data: Dict[str, Any]):
        """メール通知送信（電子メール緊急連絡）"""
        
        if not recipients:
            return
            
        try:
            #  メール内容構築
            msg = MIMEMultipart()
            msg['From'] = self.smtp_config['from_email']
            msg['To'] = ', '.join(recipients)
            msg['Subject'] = f"[CRITICAL] システムアラート: {alert_data['rule_name']} ({alert_data['level'].upper()})"
            
            #  HTML形式のメール本文
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #d32f2f;">[CRITICAL] システムアラート通知</h2>
                <table style="border-collapse: collapse; width: 100%;">
                    <tr><td style="padding: 8px; font-weight: bold;">アラート名:</td><td style="padding: 8px;">{alert_data['rule_name']}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">レベル:</td><td style="padding: 8px; color: #d32f2f;">{alert_data['level'].upper()}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">発生時刻:</td><td style="padding: 8px;">{alert_data['timestamp']}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">システム状態:</td><td style="padding: 8px;">{alert_data['overall_status']}</td></tr>
                </table>
                <h3>詳細情報:</h3>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">{alert_data['message']}</pre>
                <p style="color: #666;">
                    このメールは自動送信されています。<br>
                    対応完了後は <a href="https://your-dashboard.com">監視ダッシュボード</a> で状況を確認してください。
                </p>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(html_body, 'html', 'utf-8'))
            
            #  SMTP送信
            with smtplib.SMTP(self.smtp_config['host'], self.smtp_config['port']) as server:
                server.starttls()
                server.login(self.smtp_config['username'], self.smtp_config['password'])
                server.send_message(msg)
                
        except Exception as e:
            print(f"[NG] メール送信エラー: {e}")
    
    async def _send_slack_alert(self, channels: List[str], alert_data: Dict[str, Any]):
        """Slack通知送信（チャット緊急連絡）"""
        
        if not channels or not self.slack_webhook_url:
            return
            
        try:
            #  レベル別の色設定
            color_map = {
                "info": "#36a64f",      # 緑
                "warning": "#ff9800",   # オレンジ  
                "critical": "#d32f2f",  # 赤
                "emergency": "#9c27b0"  # 紫
            }
            
            #  Slack メッセージ構築
            slack_payload = {
                "text": f"[CRITICAL] システムアラート: {alert_data['rule_name']}",
                "attachments": [
                    {
                        "color": color_map.get(alert_data['level'], "#9e9e9e"),
                        "fields": [
                            {"title": "アラート名", "value": alert_data['rule_name'], "short": True},
                            {"title": "レベル", "value": alert_data['level'].upper(), "short": True},
                            {"title": "発生時刻", "value": alert_data['timestamp'], "short": True},
                            {"title": "システム状態", "value": alert_data['overall_status'], "short": True}
                        ],
                        "text": f"```{alert_data['message']}```",
                        "footer": "システム監視",
                        "ts": int(datetime.now().timestamp())
                    }
                ]
            }
            
            #  Webhook送信
            async with aiohttp.ClientSession() as session:
                async with session.post(self.slack_webhook_url, json=slack_payload) as response:
                    if response.status == 200:
                        print(f"[OK] Slack通知送信成功")
                    else:
                        print(f"[NG] Slack通知送信失敗: {response.status}")
                        
        except Exception as e:
            print(f"[NG] Slack通知エラー: {e}")
    
    def _is_in_cooldown(self, rule: AlertRule) -> bool:
        """クールダウン期間チェック（連続通知防止）"""
        
        if rule.cooldown_minutes == 0:
            return False  # 緊急時はクールダウンなし
            
        #  同じルールの最近のアラートをチェック
        cutoff_time = datetime.now() - timedelta(minutes=rule.cooldown_minutes)
        
        for alert in reversed(self.alert_history):  # 新しい順でチェック
            alert_time = datetime.fromisoformat(alert['timestamp'])
            if alert_time < cutoff_time:
                break  # 十分古いので以降はチェック不要
                
            if alert['rule_name'] == rule.name:
                return True  # クールダウン期間内に同じアラートあり
        
        return False
    
    async def _check_auto_resolve(self, rule: AlertRule, metrics: Dict[str, Any]):
        """自動解決チェック（症状改善確認）"""
        
        #  該当するアクティブアラートがあるかチェック
        alerts_to_resolve = []
        
        for alert_id, alert_data in self.active_alerts.items():
            if alert_data['rule_name'] == rule.name:
                #  自動解決時間経過チェック
                alert_time = datetime.fromisoformat(alert_data['timestamp'])
                if datetime.now() - alert_time > timedelta(minutes=rule.auto_resolve_minutes):
                    alerts_to_resolve.append(alert_id)
        
        # [OK] 解決済みアラートを削除
        for alert_id in alerts_to_resolve:
            resolved_alert = self.active_alerts.pop(alert_id)
            print(f"[OK] アラート自動解決: {resolved_alert['rule_name']}")
            
            #  解決通知送信（オプション）
            await self._send_resolution_notification(resolved_alert)
    
    async def _send_resolution_notification(self, alert_data: Dict[str, Any]):
        """解決通知送信（回復報告）"""
        
        resolution_message = f"[OK] **アラート解決**: {alert_data['rule_name']}\n"
        resolution_message += f"**解決時刻**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        resolution_message += f"**発生からの経過時間**: 約{rule.auto_resolve_minutes}分\n"
        resolution_message += "システムは正常な状態に戻りました。"
        
        #  簡易Slack通知（解決報告）
        if self.slack_webhook_url:
            payload = {
                "text": f"[OK] アラート解決: {alert_data['rule_name']}",
                "attachments": [
                    {
                        "color": "#4caf50",  # 緑色
                        "text": resolution_message
                    }
                ]
            }
            
            try:
                async with aiohttp.ClientSession() as session:
                    await session.post(self.slack_webhook_url, json=payload)
            except Exception as e:
                print(f"[NG] 解決通知エラー: {e}")
```

**初心者向け解説**：

アラートシステムの通知チャネル比較：

| 通知方法 | 到達速度 | 緊急度 | 使用場面 | 利点 |
|:---------|:--------|:-------|:---------|:-----|
| **Slack**| 即座 | 中-高 | 開発チーム内の連携 | リアルタイム・履歴確認が容易 |
| **メール**| 1〜5分 | 中 | 公式な通知・記録用 | 詳細情報・添付ファイル可能 |
| **SMS**| 即座 | 最高 | 真の緊急事態 | 確実な到達・どこでも受信 |
| **Discord**| 即座 | 中 | カジュアルなチーム連携 | コミュニティ感・画像対応 |

{% raw %}
```yaml
  # テスト実行
  test:
    runs-on: ${{ matrix.os }}
    needs: [detect-changes, quality-check]
    if: needs.detect-changes.outputs.backend-changed == 'true'
    strategy:
      matrix: ${{ fromJson(needs.detect-changes.outputs.test-matrix) }}
      fail-fast: false
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v6
        with:
          python-version: ${{ matrix.python-version }}
      
      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements*.txt') }}
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-test.txt
      
      - name: Run unit tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          SECRET_KEY: test-secret-key-for-ci
        run: |
          pytest tests/unit/ -v --junitxml=junit-unit.xml --cov=app --cov-report=xml:coverage-unit.xml
      
      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          SECRET_KEY: test-secret-key-for-ci
        run: |
          pytest tests/integration/ -v --junitxml=junit-integration.xml --cov=app --cov-append --cov-report=xml:coverage-integration.xml
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ matrix.python-version }}-${{ matrix.os }}
          path: |
            junit-*.xml
            coverage-*.xml

  # パフォーマンステスト
  performance-test:
    runs-on: ubuntu-latest
    needs: [detect-changes, test]
    if: needs.detect-changes.outputs.backend-changed == 'true' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Build application
        run: |
          docker build -t app:test .
      
      - name: Start test environment
        run: |
          docker compose -f docker-compose.test.yml up -d
          sleep 30  # アプリケーション起動待機
      
      - name: Run load tests
        run: |
          pip install locust
          locust -f tests/performance/locustfile.py --host=http://localhost:8000 \
                 --users=100 --spawn-rate=10 --run-time=300s --headless \
                 --html=performance-report.html --csv=performance
      
      - name: Upload performance results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: |
            performance-report.html
            performance_*.csv

  # データベースマイグレーション検証
  migration-test:
    runs-on: ubuntu-latest
    needs: detect-changes
    if: needs.detect-changes.outputs.database-changed == 'true'
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: migration_test
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Test migration rollback/forward
        run: |
          # ベースブランチからのマイグレーション実行
          git checkout ${{ github.base_ref || 'main' }}
          supabase db reset --db-url postgresql://postgres:postgres@localhost:5432/migration_test
          
          # 新しいマイグレーション適用
          git checkout ${{ github.sha }}
          supabase db push --db-url postgresql://postgres:postgres@localhost:5432/migration_test
          
          # ロールバックテスト
          git checkout ${{ github.base_ref || 'main' }}
          supabase db push --db-url postgresql://postgres:postgres@localhost:5432/migration_test

  # ビルド・レジストリプッシュ
  build-and-push:
    runs-on: ubuntu-latest
    needs: [security-scan, test, migration-test]
    if: always() && (needs.test.result == 'success' || needs.test.result == 'skipped')
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
      image-tag: ${{ steps.meta.outputs.tags }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
      
      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            BUILDKIT_INLINE_CACHE=1
            VERSION=${{ github.sha }}

  # セキュリティスキャン（イメージ）
  image-security-scan:
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.event_name != 'pull_request'
    steps:
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@0.33.1
        with:
          image-ref: ${{ needs.build-and-push.outputs.image-tag }}
          format: 'sarif'
          output: 'trivy-image-results.sarif'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: 'trivy-image-results.sarif'

  # 開発環境デプロイ
  deploy-dev:
    runs-on: ubuntu-latest
    needs: [build-and-push, image-security-scan]
    if: github.ref == 'refs/heads/develop'
    environment: development
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to development
        run: |
          echo "Deploying to development environment"
          # Kubernetesデプロイメント、Terraformなど

  # ステージング環境デプロイ
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build-and-push, image-security-scan]
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment"
          
      - name: Run smoke tests
        run: |
          # スモークテスト実行
          echo "Running smoke tests"

  # 本番デプロイ
  deploy-production:
    runs-on: ubuntu-latest
    needs: [deploy-staging, performance-test]
    if: github.event_name == 'release' && github.event.action == 'published'
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to production
        run: |
          echo "Deploying to production environment"
          
      - name: Post-deployment verification
        run: |
          # 本番環境検証
          echo "Verifying production deployment"

  # 結果通知
  notify:
    runs-on: ubuntu-latest
    needs: [deploy-dev, deploy-staging, deploy-production]
    if: always()
    steps:
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```
{% endraw %}

### 高度なテスト戦略

```python
# tests/conftest.py
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from httpx import AsyncClient
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

from app.main import app
from app.core.database import get_db
from app.models.base import Base

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def postgres_container():
    with PostgresContainer("postgres:15") as postgres:
        yield postgres
        postgres.stop()

@pytest.fixture(scope="session")
async def redis_container():
    with RedisContainer("redis:7") as redis:
        yield redis
        redis.stop()

@pytest.fixture(scope="session")
async def test_engine(postgres_container):
    database_url = postgres_container.get_connection_url().replace(
        "postgresql://", "postgresql+asyncpg://"
    )
    engine = create_async_engine(database_url, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture(scope="function")
async def db_session(test_engine):
    async with AsyncSession(test_engine) as session:
        yield session
        await session.close()

@pytest.fixture(scope="function")
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
        await ac.aclose()

@pytest.fixture(scope="function")
def sample_user_data():
    return {
        "username": "test_user",
        "email": "test_user@example.com",
        "password": "securepassword"
    }

@pytest.fixture(scope="function")
def sample_organization_data():
    return {
        "name": "Test Organization",
        "description": "A sample organization for testing purposes"
    }
```

---

## 8.3 マイグレーション管理戦略

### 8.3.1 Branching/Preview環境の活用（安全な検証）

Supabase Cloud の **Branching/Preview**を使うと、  
ブランチごとに **独立環境 + 独立API資格情報**を用意して検証できます。

**運用のポイント**:
- **本番データは複製されない前提**で、seedデータで初期化する  
  （仕様は変更される可能性があるため、必ず公式ドキュメントで確認）
- RAGの **回帰テスト用クエリセット**を用意する
- RLSの **権限制御回帰**を自動化する
- コスト閾値（token / cost）もテストで確認する

**推奨フロー**:
1. Branchingで環境作成（GitHub連携 or ダッシュボード操作）
2. seed投入（最小データ + テスト専用）
3. 回帰テスト実行
4. 問題なければ本番へ反映

**作成方法の例**:
- **GitHub連携**: PR作成時に自動でPreview環境が生成される
- **ダッシュボード**: Studioから手動でBranchを作成し検証する

---

### データベースマイグレーション自動化

```python
# scripts/migration_manager.py
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.database import get_db
from app.core.config import settings

class MigrationManager:
    """データベースマイグレーション管理"""
    
    def __init__(self, database_url: str):
        self.engine = create_async_engine(database_url)
        self.migrations_dir = Path("migrations")
        self.logger = logging.getLogger(__name__)
    
    async def create_migration_table(self):
        """マイグレーション管理テーブル作成"""
        async with self.engine.begin() as conn:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(255) PRIMARY KEY,
                    filename VARCHAR(255) NOT NULL,
                    checksum VARCHAR(255) NOT NULL,
                    executed_at TIMESTAMPTZ DEFAULT NOW(),
                    execution_time_ms INTEGER,
                    success BOOLEAN DEFAULT TRUE,
                    error_message TEXT
                )
            """))
    
    async def get_applied_migrations(self) -> List[str]:
        """適用済みマイグレーション取得"""
        async with self.engine.begin() as conn:
            result = await conn.execute(text("""
                SELECT version FROM schema_migrations 
                WHERE success = TRUE 
                ORDER BY version
            """))
            return [row[0] for row in result.fetchall()]
    
    async def get_pending_migrations(self) -> List[Dict[str, Any]]:
        """未適用マイグレーション取得"""
        applied = set(await self.get_applied_migrations())
        all_migrations = self._discover_migrations()
        
        pending = []
        for migration in all_migrations:
            if migration["version"] not in applied:
                pending.append(migration)
        
        return sorted(pending, key=lambda x: x["version"])
    
    def _discover_migrations(self) -> List[Dict[str, Any]]:
        """マイグレーションファイル発見"""
        migrations = []
        
        if not self.migrations_dir.exists():
            return migrations
        
        for file_path in self.migrations_dir.glob("*.sql"):
            # ファイル名からバージョン抽出 (例: 001_initial_schema.sql)
            filename = file_path.name
            version = filename.split("_")[0]
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            migrations.append({
                "version": version,
                "filename": filename,
                "path": file_path,
                "content": content,
                "checksum": self._calculate_checksum(content)
            })
        
        return migrations
    
    def _calculate_checksum(self, content: str) -> str:
        """チェックサム計算"""
        import hashlib
        return hashlib.sha256(content.encode()).hexdigest()
    
    async def apply_migration(self, migration: Dict[str, Any]) -> bool:
        """マイグレーション適用"""
        start_time = datetime.now()
        success = False
        error_message = None
        
        try:
            self.logger.info(f"Applying migration {migration['version']}: {migration['filename']}")
            
            async with self.engine.begin() as conn:
                # マイグレーション実行
                await conn.execute(text(migration["content"]))
                
                # 実行記録
                execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
                await conn.execute(text("""
                    INSERT INTO schema_migrations 
                    (version, filename, checksum, execution_time_ms, success)
                    VALUES (:version, :filename, :checksum, :execution_time, :success)
                """), {
                    "version": migration["version"],
                    "filename": migration["filename"],
                    "checksum": migration["checksum"],
                    "execution_time": execution_time,
                    "success": True
                })
                
                success = True
                self.logger.info(f"Migration {migration['version']} applied successfully")
                
        except Exception as e:
            error_message = str(e)
            self.logger.error(f"Migration {migration['version']} failed: {error_message}")
            
            # エラー記録
            try:
                async with self.engine.begin() as conn:
                    await conn.execute(text("""
                        INSERT INTO schema_migrations 
                        (version, filename, checksum, success, error_message)
                        VALUES (:version, :filename, :checksum, :success, :error_message)
                    """), {
                        "version": migration["version"],
                        "filename": migration["filename"],
                        "checksum": migration["checksum"],
                        "success": False,
                        "error_message": error_message
                    })
            except:
                pass  # エラー記録失敗は無視
        
        return success
    
    async def migrate(self, target_version: Optional[str] = None) -> Dict[str, Any]:
        """マイグレーション実行"""
        await self.create_migration_table()
        
        pending_migrations = await self.get_pending_migrations()
        
        if target_version:
            # 指定バージョンまでのマイグレーション
            pending_migrations = [
                m for m in pending_migrations 
                if m["version"] <= target_version
            ]
        
        if not pending_migrations:
            self.logger.info("No pending migrations")
            return {"applied": 0, "failed": 0, "migrations": []}
        
        applied = 0
        failed = 0
        results = []
        
        for migration in pending_migrations:
            success = await self.apply_migration(migration)
            results.append({
                "version": migration["version"],
                "filename": migration["filename"],
                "success": success
            })
            
            if success:
                applied += 1
            else:
                failed += 1
                # 失敗時は停止
                break
        
        return {
            "applied": applied,
            "failed": failed,
            "migrations": results
        }
    
    async def rollback(self, target_version: str) -> Dict[str, Any]:
        """ロールバック実行"""
        # ロールバック用マイグレーション探索
        rollback_dir = self.migrations_dir / "rollback"
        if not rollback_dir.exists():
            raise ValueError("Rollback directory not found")
        
        applied_migrations = await self.get_applied_migrations()
        rollback_migrations = []
        
        for version in reversed(applied_migrations):
            if version <= target_version:
                break
            
            rollback_file = rollback_dir / f"{version}_rollback.sql"
            if rollback_file.exists():
                with open(rollback_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                rollback_migrations.append({
                    "version": version,
                    "filename": rollback_file.name,
                    "content": content
                })
        
        # ロールバック実行
        rolled_back = 0
        for migration in rollback_migrations:
            try:
                async with self.engine.begin() as conn:
                    await conn.execute(text(migration["content"]))
                    
                    # マイグレーション記録削除
                    await conn.execute(text("""
                        DELETE FROM schema_migrations 
                        WHERE version = :version
                    """), {"version": migration["version"]})
                
                rolled_back += 1
                self.logger.info(f"Rolled back migration {migration['version']}")
                
            except Exception as e:
                self.logger.error(f"Rollback failed for {migration['version']}: {e}")
                break
        
        return {"rolled_back": rolled_back}

# マイグレーション生成
class MigrationGenerator:
    """マイグレーション生成"""
    
    def __init__(self, migrations_dir: Path):
        self.migrations_dir = migrations_dir
        self.migrations_dir.mkdir(exist_ok=True)
    
    def generate_migration(self, name: str, content: str = None) -> Path:
        """新しいマイグレーション生成"""
        # バージョン番号生成
        existing_versions = [
            int(f.name.split("_")[0]) 
            for f in self.migrations_dir.glob("*.sql")
            if f.name.split("_")[0].isdigit()
        ]
        
        next_version = str(max(existing_versions, default=0) + 1).zfill(3)
        
        # ファイル名生成
        filename = f"{next_version}_{name}.sql"
        file_path = self.migrations_dir / filename
        
        # テンプレート内容
        if content is None:
            content = f"""-- Migration: {name}
-- Created: {datetime.now().isoformat()}
-- Version: {next_version}

-- ここにマイグレーション内容を記述
BEGIN;

-- 例: CREATE TABLE example (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMPTZ DEFAULT NOW()
-- );

COMMIT;
"""
        
        # ファイル作成
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"Generated migration: {file_path}")
        return file_path
    
    def generate_rollback(self, version: str, content: str) -> Path:
        """ロールバック用マイグレーション生成"""
        rollback_dir = self.migrations_dir / "rollback"
        rollback_dir.mkdir(exist_ok=True)
        
        filename = f"{version}_rollback.sql"
        file_path = rollback_dir / filename
        
        rollback_content = f"""-- Rollback Migration: {version}
-- Created: {datetime.now().isoformat()}

-- ここにロールバック内容を記述
BEGIN;

{content}

COMMIT;
"""
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(rollback_content)
        
        print(f"Generated rollback: {file_path}")
        return file_path

# CLI コマンド
async def migrate_command(target_version: str = None):
    """マイグレーション実行コマンド"""
    manager = MigrationManager(settings.database_url)
    result = await manager.migrate(target_version)
    
    print(f"Applied: {result['applied']} migrations")
    if result['failed'] > 0:
        print(f"Failed: {result['failed']} migrations")
    
    for migration in result['migrations']:
        status = "✓" if migration['success'] else "✗"
        print(f"{status} {migration['version']}: {migration['filename']}")

async def rollback_command(target_version: str):
    """ロールバック実行コマンド"""
    manager = MigrationManager(settings.database_url)
    result = await manager.rollback(target_version)
    
    print(f"Rolled back: {result['rolled_back']} migrations")

def generate_command(name: str):
    """マイグレーション生成コマンド"""
    generator = MigrationGenerator(Path("migrations"))
    generator.generate_migration(name)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python migration_manager.py [migrate|rollback|generate] [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "migrate":
        target = sys.argv[2] if len(sys.argv) > 2 else None
        asyncio.run(migrate_command(target))
    elif command == "rollback":
        if len(sys.argv) < 3:
            print("Usage: python migration_manager.py rollback <target_version>")
            sys.exit(1)
        target = sys.argv[2]
        asyncio.run(rollback_command(target))
    elif command == "generate":
        if len(sys.argv) < 3:
            print("Usage: python migration_manager.py generate <name>")
            sys.exit(1)
        name = sys.argv[2]
        generate_command(name)
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
```

---

## 8.4 バックアップ・ディザスタリカバリ

### 8.4.1 S3互換Storageを前提とした外部連携

Supabase Storage は **S3互換プロトコル**を前提に外部ツールと連携できます。  
バックアップや移行では **S3互換のツール**を利用すると運用が簡潔です。

**活用例**:
- 既存のS3バックアップツールで **そのまま連携**
- 別環境への **バケット移行**（staging → production）
- 監査用の **長期保管**を外部ストレージに集約

> 注意: 設定値やサポート状況は変更される可能性があるため、最新の公式ドキュメントを確認してください。

### 自動バックアップシステム

```python
# scripts/backup_manager.py
import asyncio
import gzip
import boto3
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import logging
import json

from app.core.config import settings

class BackupManager:
    """包括的バックアップ管理システム"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.s3_client = boto3.client('s3') if hasattr(settings, 'AWS_ACCESS_KEY_ID') else None
        self.backup_config = {
            "database": {
                "enabled": True,
                "schedule": "0 2 * * *",  # 毎日2時
                "retention_days": 30,
                "compression": True
            },
            "files": {
                "enabled": True,
                "schedule": "0 3 * * *",  # 毎日3時
                "retention_days": 7,
                "paths": ["/app/uploads", "/app/logs"]
            },
            "application_data": {
                "enabled": True,
                "schedule": "0 4 * * 0",  # 毎週日曜4時
                "retention_days": 90
            }
        }
    
    async def create_database_backup(self, backup_name: str = None) -> Dict[str, Any]:
        """データベースバックアップ作成"""
        if not backup_name:
            backup_name = f"db_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        backup_file = Path(f"/tmp/{backup_name}.sql")
        
        try:
            # pg_dumpでバックアップ作成
            cmd = [
                "pg_dump",
                "--host", settings.POSTGRES_SERVER,
                "--port", str(settings.POSTGRES_PORT),
                "--username", settings.POSTGRES_USER,
                "--dbname", settings.POSTGRES_DB,
                "--no-password",
                "--verbose",
                "--file", str(backup_file),
                "--format", "custom",
                "--compress", "9"
            ]
            
            env = {"PGPASSWORD": settings.POSTGRES_PASSWORD}
            
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600  # 1時間タイムアウト
            )
            
            if result.returncode != 0:
                raise Exception(f"pg_dump failed: {result.stderr}")
            
            # バックアップファイル情報取得
            file_size = backup_file.stat().st_size
            
            # S3アップロード
            s3_key = None
            if self.s3_client:
                s3_key = await self._upload_to_s3(backup_file, f"database/{backup_name}.sql")
            
            # メタデータ保存
            metadata = {
                "backup_name": backup_name,
                "backup_type": "database",
                "created_at": datetime.now().isoformat(),
                "file_size": file_size,
                "local_path": str(backup_file),
                "s3_key": s3_key,
                "database_name": settings.POSTGRES_DB,
                "format": "custom",
                "compressed": True
            }
            
            await self._save_backup_metadata(metadata)
            
            self.logger.info(f"Database backup created: {backup_name}")
            return metadata
            
        except Exception as e:
            self.logger.error(f"Database backup failed: {e}")
            # クリーンアップ
            if backup_file.exists():
                backup_file.unlink()
            raise
    
    async def restore_database_backup(self, backup_name: str, target_db: str = None) -> bool:
        """データベースバックアップ復元"""
        try:
            # バックアップメタデータ取得
            metadata = await self._get_backup_metadata(backup_name)
            if not metadata:
                raise ValueError(f"Backup not found: {backup_name}")
            
            # S3からダウンロード（必要に応じて）
            backup_file = Path(metadata["local_path"])
            if not backup_file.exists() and metadata.get("s3_key"):
                backup_file = await self._download_from_s3(metadata["s3_key"])
            
            if not backup_file.exists():
                raise FileNotFoundError(f"Backup file not found: {backup_file}")
            
            # 復元実行
            target_database = target_db or settings.POSTGRES_DB
            
            # 既存接続を切断
            await self._terminate_database_connections(target_database)
            
            # データベース再作成
            await self._recreate_database(target_database)
            
            # pg_restore で復元
            cmd = [
                "pg_restore",
                "--host", settings.POSTGRES_SERVER,
                "--port", str(settings.POSTGRES_PORT),
                "--username", settings.POSTGRES_USER,
                "--dbname", target_database,
                "--no-password",
                "--verbose",
                "--clean",
                "--if-exists",
                str(backup_file)
            ]
            
            env = {"PGPASSWORD": settings.POSTGRES_PASSWORD}
            
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600
            )
            
            if result.returncode != 0:
                # 一部のエラーは無視（clean時の存在しないオブジェクト等）
                if "does not exist" not in result.stderr:
                    raise Exception(f"pg_restore failed: {result.stderr}")
            
            self.logger.info(f"Database restored from backup: {backup_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Database restore failed: {e}")
            return False
    
    async def create_file_backup(self, paths: List[str] = None) -> Dict[str, Any]:
        """ファイルバックアップ作成"""
        if not paths:
            paths = self.backup_config["files"]["paths"]
        
        backup_name = f"files_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        backup_file = Path(f"/tmp/{backup_name}.tar.gz")
        
        try:
            # tar.gz でアーカイブ作成
            cmd = ["tar", "-czf", str(backup_file)] + paths
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=1800  # 30分タイムアウト
            )
            
            if result.returncode != 0:
                raise Exception(f"tar failed: {result.stderr}")
            
            file_size = backup_file.stat().st_size
            
            # S3アップロード
            s3_key = None
            if self.s3_client:
                s3_key = await self._upload_to_s3(backup_file, f"files/{backup_name}.tar.gz")
            
            metadata = {
                "backup_name": backup_name,
                "backup_type": "files",
                "created_at": datetime.now().isoformat(),
                "file_size": file_size,
                "local_path": str(backup_file),
                "s3_key": s3_key,
                "paths": paths,
                "format": "tar.gz",
                "compressed": True
            }
            
            await self._save_backup_metadata(metadata)
            
            self.logger.info(f"File backup created: {backup_name}")
            return metadata
            
        except Exception as e:
            self.logger.error(f"File backup failed: {e}")
            if backup_file.exists():
                backup_file.unlink()
            raise
    
    async def cleanup_old_backups(self):
        """古いバックアップクリーンアップ"""
        try:
            all_backups = await self._list_all_backups()
            
            for backup in all_backups:
                created_at = datetime.fromisoformat(backup["created_at"])
                backup_type = backup["backup_type"]
                
                retention_days = self.backup_config.get(backup_type, {}).get("retention_days", 30)
                cutoff_date = datetime.now() - timedelta(days=retention_days)
                
                if created_at < cutoff_date:
                    await self._delete_backup(backup)
                    self.logger.info(f"Deleted old backup: {backup['backup_name']}")
            
        except Exception as e:
            self.logger.error(f"Backup cleanup failed: {e}")
    
    async def _upload_to_s3(self, file_path: Path, s3_key: str) -> str:
        """S3アップロード"""
        try:
            bucket_name = settings.S3_BACKUP_BUCKET
            
            with open(file_path, 'rb') as f:
                self.s3_client.upload_fileobj(f, bucket_name, s3_key)
            
            return s3_key
            
        except Exception as e:
            self.logger.error(f"S3 upload failed: {e}")
            return None
    
    async def _download_from_s3(self, s3_key: str) -> Path:
        """S3ダウンロード"""
        local_file = Path(f"/tmp/{Path(s3_key).name}")
        
        bucket_name = settings.S3_BACKUP_BUCKET
        self.s3_client.download_file(bucket_name, s3_key, str(local_file))
        
        return local_file
    
    async def _save_backup_metadata(self, metadata: Dict[str, Any]):
        """バックアップメタデータ保存"""
        # データベースまたはファイルに保存
        metadata_file = Path(f"/app/backups/metadata/{metadata['backup_name']}.json")
        metadata_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    async def _get_backup_metadata(self, backup_name: str) -> Optional[Dict[str, Any]]:
        """バックアップメタデータ取得"""
        metadata_file = Path(f"/app/backups/metadata/{backup_name}.json")
        
        if not metadata_file.exists():
            return None
        
        with open(metadata_file, 'r') as f:
            return json.load(f)
    
    async def _list_all_backups(self) -> List[Dict[str, Any]]:
        """全バックアップ一覧取得"""
        metadata_dir = Path("/app/backups/metadata")
        if not metadata_dir.exists():
            return []
        
        backups = []
        for metadata_file in metadata_dir.glob("*.json"):
            with open(metadata_file, 'r') as f:
                backups.append(json.load(f))
        
        return backups
    
    async def _delete_backup(self, backup: Dict[str, Any]):
        """バックアップ削除"""
        # ローカルファイル削除
        local_path = Path(backup["local_path"])
        if local_path.exists():
            local_path.unlink()
        
        # S3から削除
        if backup.get("s3_key") and self.s3_client:
            bucket_name = settings.S3_BACKUP_BUCKET
            self.s3_client.delete_object(Bucket=bucket_name, Key=backup["s3_key"])
        
        # メタデータ削除
        metadata_file = Path(f"/app/backups/metadata/{backup['backup_name']}.json")
        if metadata_file.exists():
            metadata_file.unlink()
    
    async def _terminate_database_connections(self, database_name: str):
        """データベース接続終了"""
        # 実装省略（PostgreSQL固有のクエリ実行）
        pass
    
    async def _recreate_database(self, database_name: str):
        """データベース再作成"""
        # 実装省略（DROP/CREATE DATABASE）
        pass

# ディザスタリカバリ計画
class DisasterRecoveryPlan:
    """ディザスタリカバリ計画実行"""
    
    def __init__(self):
        self.backup_manager = BackupManager()
        self.logger = logging.getLogger(__name__)
        
        self.recovery_procedures = {
            "database_corruption": self._recover_from_database_corruption,
            "application_failure": self._recover_from_application_failure,
            "infrastructure_failure": self._recover_from_infrastructure_failure,
            "security_breach": self._recover_from_security_breach
        }
    
    async def execute_recovery(self, incident_type: str, **kwargs) -> Dict[str, Any]:
        """災害復旧実行"""
        if incident_type not in self.recovery_procedures:
            raise ValueError(f"Unknown incident type: {incident_type}")
        
        self.logger.info(f"Starting disaster recovery for: {incident_type}")
        
        recovery_procedure = self.recovery_procedures[incident_type]
        result = await recovery_procedure(**kwargs)
        
        self.logger.info(f"Disaster recovery completed for: {incident_type}")
        return result
    
    async def _recover_from_database_corruption(self, backup_name: str = None) -> Dict[str, Any]:
        """データベース破損からの復旧"""
        steps = []
        
        try:
            # 1. 最新バックアップ特定
            if not backup_name:
                backups = await self.backup_manager._list_all_backups()
                db_backups = [b for b in backups if b["backup_type"] == "database"]
                if not db_backups:
                    raise Exception("No database backups found")
                
                latest_backup = max(db_backups, key=lambda x: x["created_at"])
                backup_name = latest_backup["backup_name"]
            
            steps.append(f"Selected backup: {backup_name}")
            
            # 2. アプリケーション停止
            await self._stop_application()
            steps.append("Application stopped")
            
            # 3. データベース復元
            success = await self.backup_manager.restore_database_backup(backup_name)
            if not success:
                raise Exception("Database restore failed")
            steps.append("Database restored")
            
            # 4. アプリケーション再起動
            await self._start_application()
            steps.append("Application restarted")
            
            # 5. 整合性チェック
            integrity_check = await self._verify_database_integrity()
            steps.append(f"Integrity check: {integrity_check}")
            
            return {
                "status": "success",
                "steps": steps,
                "backup_used": backup_name
            }
            
        except Exception as e:
            self.logger.error(f"Database recovery failed: {e}")
            return {
                "status": "failed",
                "steps": steps,
                "error": str(e)
            }
    
    async def _recover_from_application_failure(self) -> Dict[str, Any]:
        """アプリケーション障害からの復旧"""
        # 実装省略
        return {"status": "success", "steps": ["Application recovery completed"]}
    
    async def _recover_from_infrastructure_failure(self) -> Dict[str, Any]:
        """インフラ障害からの復旧"""
        # 実装省略
        return {"status": "success", "steps": ["Infrastructure recovery completed"]}
    
    async def _recover_from_security_breach(self) -> Dict[str, Any]:
        """セキュリティ侵害からの復旧"""
        # 実装省略
        return {"status": "success", "steps": ["Security breach recovery completed"]}
    
    async def _stop_application(self):
        """アプリケーション停止"""
        # Kubernetes、Docker Compose等での停止処理
        pass
    
    async def _start_application(self):
        """アプリケーション開始"""
        # Kubernetes、Docker Compose等での開始処理
        pass
    
    async def _verify_database_integrity(self) -> bool:
        """データベース整合性検証"""
        # データベース固有の整合性チェック
        return True

# 定期バックアップスケジューラー
async def scheduled_backup():
    """定期バックアップ実行"""
    backup_manager = BackupManager()
    
    try:
        # データベースバックアップ
        await backup_manager.create_database_backup()
        
        # ファイルバックアップ
        await backup_manager.create_file_backup()
        
        # 古いバックアップクリーンアップ
        await backup_manager.cleanup_old_backups()
        
    except Exception as e:
        logging.error(f"Scheduled backup failed: {e}")

if __name__ == "__main__":
    asyncio.run(scheduled_backup())
```

---

## 8.5 監視・アラート設計

### 包括的監視システム

```python
# app/monitoring/comprehensive_monitor.py
import asyncio
import aiohttp
import psutil
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import json
import logging

class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class MonitoringTarget(Enum):
    APPLICATION = "application"
    DATABASE = "database"
    INFRASTRUCTURE = "infrastructure"
    EXTERNAL_SERVICES = "external_services"
    SECURITY = "security"

@dataclass
class MonitoringMetric:
    name: str
    value: float
    timestamp: datetime
    target: MonitoringTarget
    labels: Dict[str, str]
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None

@dataclass
class Alert:
    id: str
    title: str
    description: str
    severity: AlertSeverity
    target: MonitoringTarget
    metric: MonitoringMetric
    created_at: datetime
    resolved_at: Optional[datetime] = None
    acknowledged: bool = False

class ComprehensiveMonitor:
    """包括的監視システム"""
    
    def __init__(self):
        self.metrics_history: List[MonitoringMetric] = []
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_handlers: List[Callable[[Alert], None]] = []
        self.monitoring_config = self._load_monitoring_config()
        self.logger = logging.getLogger(__name__)
        
        # 監視間隔
        self.collection_interval = 30  # 30秒
        self.health_check_interval = 60  # 1分
        
    def _load_monitoring_config(self) -> Dict[str, Any]:
        """監視設定読み込み"""
        return {
            "application": {
                "response_time_warning": 1.0,  # 1秒
                "response_time_critical": 5.0,  # 5秒
                "error_rate_warning": 0.05,    # 5%
                "error_rate_critical": 0.10,   # 10%
                "memory_usage_warning": 80.0,  # 80%
                "memory_usage_critical": 90.0  # 90%
            },
            "database": {
                "connection_count_warning": 80,
                "connection_count_critical": 95,
                "query_time_warning": 2.0,
                "query_time_critical": 10.0,
                "disk_usage_warning": 85.0,
                "disk_usage_critical": 95.0
            },
            "infrastructure": {
                "cpu_usage_warning": 75.0,
                "cpu_usage_critical": 90.0,
                "memory_usage_warning": 80.0,
                "memory_usage_critical": 90.0,
                "disk_usage_warning": 85.0,
                "disk_usage_critical": 95.0
            }
        }
    
    async def start_monitoring(self):
        """監視開始"""
        self.logger.info("Starting comprehensive monitoring")
        
        # 並行タスク開始
        tasks = [
            asyncio.create_task(self._collect_metrics_loop()),
            asyncio.create_task(self._health_check_loop()),
            asyncio.create_task(self._alert_processor_loop())
        ]
        
        try:
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            self.logger.info("Monitoring stopped")
            for task in tasks:
                task.cancel()
    
    async def _collect_metrics_loop(self):
        """メトリクス収集ループ"""
        while True:
            try:
                await self._collect_all_metrics()
                await asyncio.sleep(self.collection_interval)
            except Exception as e:
                self.logger.error(f"Metrics collection error: {e}")
                await asyncio.sleep(5)
    
    async def _collect_all_metrics(self):
        """全メトリクス収集"""
        now = datetime.now()
        
        # アプリケーションメトリクス
        app_metrics = await self._collect_application_metrics()
        
        # インフラストラクチャメトリクス
        infra_metrics = await self._collect_infrastructure_metrics()
        
        # データベースメトリクス
        db_metrics = await self._collect_database_metrics()
        
        # 外部サービスメトリクス
        external_metrics = await self._collect_external_service_metrics()
        
        # 全メトリクスを履歴に追加
        all_metrics = app_metrics + infra_metrics + db_metrics + external_metrics
        self.metrics_history.extend(all_metrics)
        
        # 履歴サイズ制限
        max_history = 10000
        if len(self.metrics_history) > max_history:
            self.metrics_history = self.metrics_history[-max_history:]
        
        # アラートチェック
        for metric in all_metrics:
            await self._check_metric_thresholds(metric)
    
    async def _collect_application_metrics(self) -> List[MonitoringMetric]:
        """アプリケーションメトリクス収集"""
        metrics = []
        now = datetime.now()
        
        # メモリ使用量
        process = psutil.Process()
        memory_info = process.memory_info()
        memory_percent = process.memory_percent()
        
        metrics.append(MonitoringMetric(
            name="app_memory_usage_percent",
            value=memory_percent,
            timestamp=now,
            target=MonitoringTarget.APPLICATION,
            labels={"component": "application"},
            threshold_warning=self.monitoring_config["application"]["memory_usage_warning"],
            threshold_critical=self.monitoring_config["application"]["memory_usage_critical"]
        ))
        
        # CPU使用量
        cpu_percent = process.cpu_percent()
        
        metrics.append(MonitoringMetric(
            name="app_cpu_usage_percent",
            value=cpu_percent,
            timestamp=now,
            target=MonitoringTarget.APPLICATION,
            labels={"component": "application"}
        ))
        
        # ファイルディスクリプタ数
        try:
            fd_count = process.num_fds()
            metrics.append(MonitoringMetric(
                name="app_file_descriptors",
                value=fd_count,
                timestamp=now,
                target=MonitoringTarget.APPLICATION,
                labels={"component": "application"}
            ))
        except AttributeError:
            # Windowsでは利用不可
            pass
        
        return metrics
    
    async def _collect_infrastructure_metrics(self) -> List[MonitoringMetric]:
        """インフラストラクチャメトリクス収集"""
        metrics = []
        now = datetime.now()
        
        # システムCPU使用量
        cpu_percent = psutil.cpu_percent(interval=1)
        metrics.append(MonitoringMetric(
            name="system_cpu_usage_percent",
            value=cpu_percent,
            timestamp=now,
            target=MonitoringTarget.INFRASTRUCTURE,
            labels={"component": "system"},
            threshold_warning=self.monitoring_config["infrastructure"]["cpu_usage_warning"],
            threshold_critical=self.monitoring_config["infrastructure"]["cpu_usage_critical"]
        ))
        
        # システムメモリ使用量
        memory = psutil.virtual_memory()
        metrics.append(MonitoringMetric(
            name="system_memory_usage_percent",
            value=memory.percent,
            timestamp=now,
            target=MonitoringTarget.INFRASTRUCTURE,
            labels={"component": "system"},
            threshold_warning=self.monitoring_config["infrastructure"]["memory_usage_warning"],
            threshold_critical=self.monitoring_config["infrastructure"]["memory_usage_critical"]
        ))
        
        # ディスク使用量
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        metrics.append(MonitoringMetric(
            name="system_disk_usage_percent",
            value=disk_percent,
            timestamp=now,
            target=MonitoringTarget.INFRASTRUCTURE,
            labels={"component": "system", "mount": "/"},
            threshold_warning=self.monitoring_config["infrastructure"]["disk_usage_warning"],
            threshold_critical=self.monitoring_config["infrastructure"]["disk_usage_critical"]
        ))
        
        # ネットワークI/O
        network = psutil.net_io_counters()
        metrics.extend([
            MonitoringMetric(
                name="system_network_bytes_sent",
                value=network.bytes_sent,
                timestamp=now,
                target=MonitoringTarget.INFRASTRUCTURE,
                labels={"component": "network", "direction": "sent"}
            ),
            MonitoringMetric(
                name="system_network_bytes_recv",
                value=network.bytes_recv,
                timestamp=now,
                target=MonitoringTarget.INFRASTRUCTURE,
                labels={"component": "network", "direction": "received"}
            )
        ])
        
        return metrics
    
    async def _collect_database_metrics(self) -> List[MonitoringMetric]:
        """データベースメトリクス収集"""
        metrics = []
        now = datetime.now()
        
        try:
            from app.core.database import engine
            
            # 接続プール情報
            pool = engine.pool
            if hasattr(pool, 'size'):
                total_connections = pool.size()
                checked_out = pool.checkedout()
                
                metrics.append(MonitoringMetric(
                    name="db_connections_active",
                    value=checked_out,
                    timestamp=now,
                    target=MonitoringTarget.DATABASE,
                    labels={"component": "connection_pool"},
                    threshold_warning=self.monitoring_config["database"]["connection_count_warning"],
                    threshold_critical=self.monitoring_config["database"]["connection_count_critical"]
                ))
                
                metrics.append(MonitoringMetric(
                    name="db_connections_total",
                    value=total_connections,
                    timestamp=now,
                    target=MonitoringTarget.DATABASE,
                    labels={"component": "connection_pool"}
                ))
            
            # データベース固有メトリクス（PostgreSQL）
            async with engine.begin() as conn:
                # データベースサイズ
                result = await conn.execute("""
                    SELECT pg_database_size(current_database()) as size
                """)
                db_size = result.scalar()
                
                metrics.append(MonitoringMetric(
                    name="db_size_bytes",
                    value=db_size,
                    timestamp=now,
                    target=MonitoringTarget.DATABASE,
                    labels={"component": "storage"}
                ))
                
                # アクティブクエリ数
                result = await conn.execute("""
                    SELECT count(*) FROM pg_stat_activity 
                    WHERE state = 'active' AND pid != pg_backend_pid()
                """)
                active_queries = result.scalar()
                
                metrics.append(MonitoringMetric(
                    name="db_active_queries",
                    value=active_queries,
                    timestamp=now,
                    target=MonitoringTarget.DATABASE,
                    labels={"component": "queries"}
                ))
        
        except Exception as e:
            self.logger.error(f"Database metrics collection failed: {e}")
        
        return metrics
    
    async def _collect_external_service_metrics(self) -> List[MonitoringMetric]:
        """外部サービスメトリクス収集"""
        metrics = []
        now = datetime.now()
        
        # 外部サービスのヘルスチェック
        external_services = [
            {"name": "supabase_api", "url": "https://api.supabase.io/health"},
            {"name": "stripe_api", "url": "https://status.stripe.com/api/v2/status.json"},
        ]
        
        for service in external_services:
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                    start_time = asyncio.get_event_loop().time()
                    async with session.get(service["url"]) as response:
                        end_time = asyncio.get_event_loop().time()
                        
                        response_time = (end_time - start_time) * 1000  # ミリ秒
                        is_healthy = 200 <= response.status < 300
                        
                        metrics.extend([
                            MonitoringMetric(
                                name="external_service_response_time_ms",
                                value=response_time,
                                timestamp=now,
                                target=MonitoringTarget.EXTERNAL_SERVICES,
                                labels={"service": service["name"]}
                            ),
                            MonitoringMetric(
                                name="external_service_health",
                                value=1.0 if is_healthy else 0.0,
                                timestamp=now,
                                target=MonitoringTarget.EXTERNAL_SERVICES,
                                labels={"service": service["name"]}
                            )
                        ])
                        
            except Exception as e:
                self.logger.warning(f"External service check failed for {service['name']}: {e}")
                metrics.append(MonitoringMetric(
                    name="external_service_health",
                    value=0.0,
                    timestamp=now,
                    target=MonitoringTarget.EXTERNAL_SERVICES,
                    labels={"service": service["name"]}
                ))
        
        return metrics
    
    async def _check_metric_thresholds(self, metric: MonitoringMetric):
        """メトリクス閾値チェック"""
        alert_id = f"{metric.target.value}_{metric.name}_{hash(str(metric.labels))}"
        
        # 既存のアラートをチェック
        existing_alert = self.active_alerts.get(alert_id)
        
        # 閾値チェック
        severity = None
        if metric.threshold_critical and metric.value >= metric.threshold_critical:
            severity = AlertSeverity.CRITICAL
        elif metric.threshold_warning and metric.value >= metric.threshold_warning:
            severity = AlertSeverity.WARNING
        
        if severity:
            if not existing_alert or existing_alert.severity != severity:
                # 新しいアラートまたは重要度変更
                alert = Alert(
                    id=alert_id,
                    title=f"{metric.name} threshold exceeded",
                    description=f"{metric.name} value {metric.value} exceeded threshold",
                    severity=severity,
                    target=metric.target,
                    metric=metric,
                    created_at=datetime.now()
                )
                
                self.active_alerts[alert_id] = alert
                await self._trigger_alert(alert)
        else:
            # 閾値以下の場合、既存アラートを解決
            if existing_alert and not existing_alert.resolved_at:
                existing_alert.resolved_at = datetime.now()
                await self._resolve_alert(existing_alert)
                del self.active_alerts[alert_id]
    
    async def _trigger_alert(self, alert: Alert):
        """アラート発火"""
        self.logger.warning(f"Alert triggered: {alert.title}")
        
        for handler in self.alert_handlers:
            try:
                await handler(alert)
            except Exception as e:
                self.logger.error(f"Alert handler failed: {e}")
    
    async def _resolve_alert(self, alert: Alert):
        """アラート解決"""
        self.logger.info(f"Alert resolved: {alert.title}")
    
    async def _health_check_loop(self):
        """ヘルスチェックループ"""
        while True:
            try:
                await self._perform_health_checks()
                await asyncio.sleep(self.health_check_interval)
            except Exception as e:
                self.logger.error(f"Health check error: {e}")
                await asyncio.sleep(10)
    
    async def _perform_health_checks(self):
        """ヘルスチェック実行"""
        # アプリケーションヘルスチェック
        try:
            # 内部エンドポイントチェック
            async with aiohttp.ClientSession() as session:
                async with session.get("http://localhost:8000/health") as response:
                    if response.status != 200:
                        await self._create_health_alert("application_health", "Application health check failed")
        except Exception as e:
            await self._create_health_alert("application_health", f"Application unreachable: {e}")
        
        # データベースヘルスチェック
        try:
            from app.core.database import engine
            async with engine.begin() as conn:
                await conn.execute("SELECT 1")
        except Exception as e:
            await self._create_health_alert("database_health", f"Database unreachable: {e}")
    
    async def _create_health_alert(self, component: str, message: str):
        """ヘルスチェックアラート作成"""
        alert_id = f"health_{component}"
        
        if alert_id not in self.active_alerts:
            alert = Alert(
                id=alert_id,
                title=f"{component} health check failed",
                description=message,
                severity=AlertSeverity.CRITICAL,
                target=MonitoringTarget.APPLICATION,
                metric=None,
                created_at=datetime.now()
            )
            
            self.active_alerts[alert_id] = alert
            await self._trigger_alert(alert)
    
    async def _alert_processor_loop(self):
        """アラート処理ループ"""
        while True:
            try:
                # アラート自動復旧チェック
                await self._check_alert_auto_recovery()
                
                # アラート集約処理
                await self._aggregate_similar_alerts()
                
                await asyncio.sleep(30)
            except Exception as e:
                self.logger.error(f"Alert processor error: {e}")
                await asyncio.sleep(10)
    
    async def _check_alert_auto_recovery(self):
        """アラート自動復旧チェック"""
        # 実装省略
        pass
    
    async def _aggregate_similar_alerts(self):
        """類似アラート集約"""
        # 実装省略
        pass
    
    def add_alert_handler(self, handler: Callable[[Alert], None]):
        """アラートハンドラー追加"""
        self.alert_handlers.append(handler)
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """メトリクス要約取得"""
        if not self.metrics_history:
            return {}
        
        # 最新の各メトリクス取得
        latest_metrics = {}
        for metric in reversed(self.metrics_history):
            key = f"{metric.target.value}_{metric.name}"
            if key not in latest_metrics:
                latest_metrics[key] = metric
        
        # サマリー生成
        summary = {
            "timestamp": datetime.now().isoformat(),
            "total_metrics": len(self.metrics_history),
            "active_alerts": len(self.active_alerts),
            "targets": {}
        }
        
        for target in MonitoringTarget:
            target_metrics = [m for m in latest_metrics.values() if m.target == target]
            summary["targets"][target.value] = {
                "metric_count": len(target_metrics),
                "metrics": [
                    {
                        "name": m.name,
                        "value": m.value,
                        "timestamp": m.timestamp.isoformat(),
                        "labels": m.labels
                    }
                    for m in target_metrics
                ]
            }
        
        return summary
```

---

## トラブルシューティング

### 8.5.1 CI/CDパイプライン障害対応

#### パイプライン実行失敗の診断手順

```bash
# CI/CDログ分析スクリプト
#!/bin/bash
# analyze_pipeline_failure.sh

WORKFLOW_RUN_ID="$1"
REPO="$2"

if [ -z "$WORKFLOW_RUN_ID" ] || [ -z "$REPO" ]; then
    echo "Usage: $0 <workflow_run_id> <owner/repo>"
    exit 1
fi

echo "=== CI/CD障害分析レポート ==="
echo "Run ID: $WORKFLOW_RUN_ID"
echo "Repository: $REPO"
echo "Timestamp: $(date)"
echo

# ワークフロー実行情報取得
echo "--- ワークフロー実行概要 ---"
gh api repos/$REPO/actions/runs/$WORKFLOW_RUN_ID \
    --jq '.conclusion, .status, .created_at, .updated_at, .head_commit.message'

# 失敗したジョブ特定
echo "--- 失敗ジョブ一覧 ---"
gh api repos/$REPO/actions/runs/$WORKFLOW_RUN_ID/jobs \
    --jq '.jobs[] | select(.conclusion == "failure") | .name, .conclusion, .completed_at'

# 詳細ログ取得
echo "--- 失敗ジョブの詳細ログ ---"
FAILED_JOB_ID=$(gh api repos/$REPO/actions/runs/$WORKFLOW_RUN_ID/jobs \
    --jq '.jobs[] | select(.conclusion == "failure") | .id' | head -1)

if [ -n "$FAILED_JOB_ID" ]; then
    gh api repos/$REPO/actions/jobs/$FAILED_JOB_ID/logs
fi

# 一般的な問題パターンチェック
echo "--- 問題パターン分析 ---"
LOGS=$(gh api repos/$REPO/actions/jobs/$FAILED_JOB_ID/logs)

if echo "$LOGS" | grep -q "npm ERR!"; then
    echo " Node.js/npm関連エラーを検出"
    echo "対処法: package-lock.jsonの更新、依存関係の確認"
fi

if echo "$LOGS" | grep -q "ENOSPC"; then
    echo " ディスク容量不足を検出"
    echo "対処法: キャッシュクリア、不要ファイル削除"
fi

if echo "$LOGS" | grep -q "docker: Error"; then
    echo " Docker関連エラーを検出"
    echo "対処法: Dockerfileの確認、イメージ更新"
fi

if echo "$LOGS" | grep -q "Permission denied"; then
    echo " 権限エラーを検出"
    echo "対処法: ファイル権限、GITHUB_TOKEN権限の確認"
fi

if echo "$LOGS" | grep -q "timeout"; then
    echo " タイムアウトエラーを検出"
    echo "対処法: タイムアウト時間の延長、処理の最適化"
fi

echo "\n=== 推奨アクション ==="
echo "1. 上記の問題パターンに基づく修正"
echo "2. ローカル環境での再現テスト"
echo "3. 段階的なワークフロー修正"
echo "4. 必要に応じてワークフロー再実行"
```

#### 一般的なCI/CD問題と解決策

```python
# ci_cd_troubleshooter.py
from typing import Dict, List, Tuple
import re
import json

class CICDTroubleshooter:
    """CI/CD問題診断・解決支援"""
    
    def __init__(self):
        self.error_patterns = {
            'dependency_issues': [
                r'npm ERR! peer dep missing',
                r'ERROR: Could not find a version that satisfies',
                r'ModuleNotFoundError',
                r'ImportError: No module named'
            ],
            'resource_issues': [
                r'ENOSPC: no space left on device',
                r'disk usage.*100%',
                r'out of memory',
                r'killed.*memory'
            ],
            'network_issues': [
                r'Connection timed out',
                r'network timeout',
                r'Failed to connect',
                r'DNS resolution failed'
            ],
            'permission_issues': [
                r'Permission denied',
                r'Access denied',
                r'Forbidden',
                r'insufficient privileges'
            ],
            'configuration_issues': [
                r'Invalid configuration',
                r'Missing required parameter',
                r'Unknown option',
                r'Syntax error in.*yml'
            ]
        }
        
        self.solutions = {
            'dependency_issues': [
                "package.json/requirements.txtの依存関係を確認",
                "ロックファイル（package-lock.json, poetry.lock）を更新",
                "キャッシュをクリアして再インストール",
                "依存関係のバージョン競合を解決"
            ],
            'resource_issues': [
                "不要なファイルやキャッシュを削除",
                "ワークフローでのクリーンアップ処理を追加",
                "より大きなランナーインスタンスを使用",
                "処理を分割して並列実行"
            ],
            'network_issues': [
                "リトライ機構を追加",
                "タイムアウト値を増加",
                "代替ネットワーク経路を使用",
                "外部サービスの状態を確認"
            ],
            'permission_issues': [
                "GITHUB_TOKENの権限を確認",
                "ファイル・ディレクトリ権限を修正",
                "ワークフロー権限設定を更新",
                "必要なシークレットが設定されているか確認"
            ],
            'configuration_issues': [
                "YAML構文を検証",
                "必要な環境変数が設定されているか確認",
                "ワークフロー設定ファイルを再確認",
                "デフォルト値の動作を確認"
            ]
        }
    
    def diagnose_failure(self, log_content: str) -> Dict[str, any]:
        """障害ログ診断"""
        detected_issues = []
        
        for issue_type, patterns in self.error_patterns.items():
            for pattern in patterns:
                if re.search(pattern, log_content, re.IGNORECASE):
                    detected_issues.append({
                        'type': issue_type,
                        'pattern': pattern,
                        'solutions': self.solutions[issue_type]
                    })
                    break
        
        return {
            'detected_issues': detected_issues,
            'recommendations': self._generate_recommendations(detected_issues)
        }
    
    def _generate_recommendations(self, issues: List[Dict]) -> List[str]:
        """推奨アクション生成"""
        if not issues:
            return ["明確な問題パターンが検出されませんでした。ログの詳細確認が必要です。"]
        
        recommendations = []
        
        # 優先度順での推奨事項
        priority_order = ['resource_issues', 'dependency_issues', 'configuration_issues', 'permission_issues', 'network_issues']
        
        for issue_type in priority_order:
            for issue in issues:
                if issue['type'] == issue_type:
                    recommendations.extend(issue['solutions'])
                    break
        
        return list(dict.fromkeys(recommendations))  # 重複除去

# 使用例
def analyze_ci_failure(log_file_path: str):
    """CI失敗分析実行"""
    troubleshooter = CICDTroubleshooter()
    
    try:
        with open(log_file_path, 'r', encoding='utf-8') as f:
            log_content = f.read()
        
        diagnosis = troubleshooter.diagnose_failure(log_content)
        
        print("CI/CD障害診断結果")
        print("=" * 50)
        
        if diagnosis['detected_issues']:
            print("検出された問題:")
            for issue in diagnosis['detected_issues']:
                print(f"  - {issue['type']}: {issue['pattern']}")
        
        print("\n推奨アクション:")
        for i, rec in enumerate(diagnosis['recommendations'], 1):
            print(f"  {i}. {rec}")
    
    except FileNotFoundError:
        print(f"ログファイルが見つかりません: {log_file_path}")
    except Exception as e:
        print(f"分析中にエラーが発生しました: {e}")
```

### 8.5.2 マイグレーション問題診断

#### データベースマイグレーション失敗の対処

```python
# migration_troubleshooter.py
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from typing import Dict, List, Optional
import logging

class MigrationTroubleshooter:
    """マイグレーション問題診断・解決"""
    
    def __init__(self, database_url: str):
        self.engine = create_async_engine(database_url)
        self.logger = logging.getLogger(__name__)
    
    async def diagnose_migration_failure(self, migration_version: str) -> Dict[str, any]:
        """マイグレーション失敗診断"""
        diagnosis = {
            'migration_version': migration_version,
            'issues_found': [],
            'recommendations': [],
            'safety_checks': []
        }
        
        # 基本的な接続確認
        connection_status = await self._check_database_connection()
        if not connection_status['connected']:
            diagnosis['issues_found'].append({
                'type': 'connection_failure',
                'description': '데이터베이스 연결 실패',
                'details': connection_status['error']
            })
            diagnosis['recommendations'].append('데이터베이스 접속 정보 및 네트워크 확인')
            return diagnosis
        
        # マイグレーション状態確認
        migration_state = await self._check_migration_state(migration_version)
        diagnosis['migration_state'] = migration_state
        
        # ロック状態確認
        lock_info = await self._check_migration_locks()
        if lock_info['locked']:
            diagnosis['issues_found'].append({
                'type': 'migration_locked',
                'description': 'マイグレーションロックが検出されました',
                'details': lock_info
            })
            diagnosis['recommendations'].extend([
                'ロックファイルを確認',
                '他のマイグレーションプロセスが実行中でないか確認',
                '必要に応じてロックを手動解除'
            ])
        
        # 依存関係確認
        dependency_issues = await self._check_migration_dependencies(migration_version)
        if dependency_issues:
            diagnosis['issues_found'].append({
                'type': 'dependency_issues',
                'description': 'マイグレーション依存関係の問題',
                'details': dependency_issues
            })
            diagnosis['recommendations'].append('依存するマイグレーションを先に実行')
        
        # スキーマ競合確認
        schema_conflicts = await self._check_schema_conflicts(migration_version)
        if schema_conflicts:
            diagnosis['issues_found'].append({
                'type': 'schema_conflicts',
                'description': 'スキーマ競合が検出されました',
                'details': schema_conflicts
            })
            diagnosis['recommendations'].extend([
                '競合するオブジェクトを確認',
                '手動でのスキーマ調整を検討',
                'マイグレーション内容の見直し'
            ])
        
        # 権限確認
        permission_issues = await self._check_database_permissions()
        if permission_issues:
            diagnosis['issues_found'].append({
                'type': 'permission_issues',
                'description': 'データベース権限不足',
                'details': permission_issues
            })
            diagnosis['recommendations'].append('必要なデータベース権限を付与')
        
        # 安全性チェック
        safety_issues = await self._perform_safety_checks(migration_version)
        diagnosis['safety_checks'] = safety_issues
        
        return diagnosis
    
    async def _check_database_connection(self) -> Dict[str, any]:
        """データベース接続確認"""
        try:
            async with self.engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            return {'connected': True, 'error': None}
        except Exception as e:
            return {'connected': False, 'error': str(e)}
    
    async def _check_migration_state(self, version: str) -> Dict[str, any]:
        """マイグレーション状態確認"""
        try:
            async with self.engine.begin() as conn:
                # マイグレーション記録確認
                result = await conn.execute(text("""
                    SELECT version, filename, executed_at, success, error_message
                    FROM schema_migrations 
                    WHERE version = :version
                """), {'version': version})
                
                row = result.fetchone()
                if row:
                    return {
                        'exists': True,
                        'version': row[0],
                        'filename': row[1],
                        'executed_at': row[2],
                        'success': row[3],
                        'error_message': row[4]
                    }
                else:
                    return {'exists': False}
        except Exception as e:
            return {'exists': False, 'error': str(e)}
    
    async def _check_migration_locks(self) -> Dict[str, any]:
        """マイグレーションロック確認"""
        try:
            async with self.engine.begin() as conn:
                # PostgreSQLのロック情報を確認
                result = await conn.execute(text("""
                    SELECT 
                        pg_locks.locktype,
                        pg_locks.mode,
                        pg_stat_activity.query,
                        pg_stat_activity.state,
                        pg_stat_activity.query_start
                    FROM pg_locks
                    JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
                    WHERE pg_stat_activity.query LIKE '%schema_migrations%'
                    AND pg_stat_activity.state = 'active'
                """))
                
                locks = result.fetchall()
                return {
                    'locked': len(locks) > 0,
                    'active_locks': [{
                        'locktype': lock[0],
                        'mode': lock[1],
                        'query': lock[2],
                        'state': lock[3],
                        'query_start': lock[4]
                    } for lock in locks]
                }
        except Exception as e:
            return {'locked': False, 'error': str(e)}
    
    async def _check_migration_dependencies(self, version: str) -> List[str]:
        """マイグレーション依存関係確認"""
        try:
            # マイグレーションファイルから依存関係を読み取る
            # 実装簡略化のため、基本的なバージョン順序チェックのみ
            async with self.engine.begin() as conn:
                result = await conn.execute(text("""
                    SELECT version FROM schema_migrations 
                    WHERE success = TRUE 
                    ORDER BY version
                """))
                
                applied_versions = [row[0] for row in result.fetchall()]
                
                # 現在のバージョンより前のバージョンが全て適用されているか確認
                missing_versions = []
                for i in range(1, int(version)):
                    version_str = str(i).zfill(3)
                    if version_str not in applied_versions:
                        missing_versions.append(version_str)
                
                return missing_versions
        except Exception as e:
            self.logger.error(f"依存関係確認エラー: {e}")
            return []
    
    async def _check_schema_conflicts(self, version: str) -> List[Dict[str, str]]:
        """スキーマ競合確認"""
        conflicts = []
        
        try:
            # マイグレーション内容を解析して潜在的な競合を検出
            # 実際の実装では、マイグレーションファイルを解析する
            async with self.engine.begin() as conn:
                # 既存のテーブル・カラム・インデックスを確認
                result = await conn.execute(text("""
                    SELECT table_name, column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public'
                """))
                
                existing_objects = result.fetchall()
                
                # 簡単な例: 重複テーブル名チェック
                # 実際の実装では、マイグレーション内容との照合が必要
                
        except Exception as e:
            self.logger.error(f"スキーマ競合確認エラー: {e}")
        
        return conflicts
    
    async def _check_database_permissions(self) -> List[str]:
        """データベース権限確認"""
        issues = []
        
        try:
            async with self.engine.begin() as conn:
                # 基本的な操作権限確認
                test_operations = [
                    ("CREATE TABLE", "CREATE TEMPORARY TABLE test_permissions (id INT)"),
                    ("ALTER TABLE", "ALTER TABLE test_permissions ADD COLUMN test_col INT"),
                    ("DROP TABLE", "DROP TABLE test_permissions")
                ]
                
                for operation, query in test_operations:
                    try:
                        await conn.execute(text(query))
                    except Exception as e:
                        issues.append(f"{operation}権限不足: {str(e)}")
        
        except Exception as e:
            issues.append(f"権限確認中にエラー: {str(e)}")
        
        return issues
    
    async def _perform_safety_checks(self, version: str) -> List[Dict[str, any]]:
        """安全性チェック"""
        checks = []
        
        # バックアップ存在確認
        backup_check = await self._verify_backup_exists()
        checks.append({
            'name': 'backup_verification',
            'passed': backup_check['exists'],
            'details': backup_check
        })
        
        # データ量確認
        data_size_check = await self._check_data_size()
        checks.append({
            'name': 'data_size_check',
            'passed': data_size_check['safe'],
            'details': data_size_check
        })
        
        return checks
    
    async def _verify_backup_exists(self) -> Dict[str, any]:
        """バックアップ存在確認"""
        # 実装省略 - 実際のバックアップストレージ確認
        return {'exists': True, 'latest_backup': 'backup_20240101_120000'}
    
    async def _check_data_size(self) -> Dict[str, any]:
        """データサイズ確認"""
        try:
            async with self.engine.begin() as conn:
                result = await conn.execute(text("""
                    SELECT pg_size_pretty(pg_database_size(current_database())) as size,
                           pg_database_size(current_database()) as size_bytes
                """))
                
                row = result.fetchone()
                size_bytes = row[1] if row else 0
                
                # 1GB以上の場合は注意喚起
                return {
                    'safe': size_bytes < 1024 * 1024 * 1024,
                    'size_pretty': row[0] if row else 'unknown',
                    'size_bytes': size_bytes,
                    'warning': size_bytes >= 1024 * 1024 * 1024
                }
        except Exception as e:
            return {'safe': False, 'error': str(e)}

# マイグレーション復旧スクリプト
async def emergency_migration_recovery(database_url: str, failed_version: str):
    """緊急マイグレーション復旧"""
    troubleshooter = MigrationTroubleshooter(database_url)
    
    print(f"マイグレーション復旧開始: version {failed_version}")
    
    # 診断実行
    diagnosis = await troubleshooter.diagnose_migration_failure(failed_version)
    
    print("\n=== 診断結果 ===")
    for issue in diagnosis['issues_found']:
        print(f"[NG] {issue['type']}: {issue['description']}")
    
    print("\n=== 推奨アクション ===")
    for i, rec in enumerate(diagnosis['recommendations'], 1):
        print(f"{i}. {rec}")
    
    # 自動復旧可能な問題の処理
    recovery_actions = []
    
    for issue in diagnosis['issues_found']:
        if issue['type'] == 'migration_locked':
            recovery_actions.append('ロック解除')
        elif issue['type'] == 'dependency_issues':
            recovery_actions.append('依存マイグレーション実行')
    
    if recovery_actions:
        print("\n=== 自動復旧アクション ===")
        for action in recovery_actions:
            print(f"実行: {action}")
            # 実際の復旧処理を実装

# 使用例
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 3:
        print("Usage: python migration_troubleshooter.py <database_url> <migration_version>")
        sys.exit(1)
    
    database_url = sys.argv[1]
    migration_version = sys.argv[2]
    
    asyncio.run(emergency_migration_recovery(database_url, migration_version))
```

### 8.5.3 バックアップ・復旧問題対応

#### バックアップ失敗の診断と対処

```python
# backup_troubleshooter.py
import os
import subprocess
import boto3
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
import json

class BackupTroubleshooter:
    """バックアップ問題診断・解決"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.s3_client = None
        
        try:
            self.s3_client = boto3.client('s3')
        except Exception as e:
            self.logger.warning(f"S3クライアント初期化失敗: {e}")
    
    def diagnose_backup_failure(self, backup_type: str, error_log: str) -> Dict[str, any]:
        """バックアップ失敗診断"""
        diagnosis = {
            'backup_type': backup_type,
            'issues_found': [],
            'recommendations': [],
            'recovery_steps': []
        }
        
        # エラーパターン分析
        error_patterns = {
            'disk_space': [
                'No space left on device',
                'ENOSPC',
                'disk full',
                'not enough space'
            ],
            'permission': [
                'Permission denied',
                'Access denied',
                'cannot create',
                'forbidden'
            ],
            'network': [
                'Connection timed out',
                'Network unreachable',
                'DNS resolution failed',
                'SSL handshake failed'
            ],
            'database': [
                'connection refused',
                'authentication failed',
                'database does not exist',
                'invalid password'
            ],
            'aws_s3': [
                'AccessDenied',
                'InvalidAccessKeyId',
                'SignatureDoesNotMatch',
                'NoSuchBucket'
            ]
        }
        
        detected_issues = []
        for issue_type, patterns in error_patterns.items():
            for pattern in patterns:
                if pattern.lower() in error_log.lower():
                    detected_issues.append(issue_type)
                    break
        
        # 問題別対処法
        for issue_type in detected_issues:
            issue_info = self._get_issue_info(issue_type, backup_type)
            diagnosis['issues_found'].append(issue_info)
            diagnosis['recommendations'].extend(issue_info['solutions'])
            diagnosis['recovery_steps'].extend(issue_info['recovery_steps'])
        
        # 環境診断
        env_check = self._check_backup_environment(backup_type)
        diagnosis['environment_check'] = env_check
        
        return diagnosis
    
    def _get_issue_info(self, issue_type: str, backup_type: str) -> Dict[str, any]:
        """問題情報取得"""
        issue_database = {
            'disk_space': {
                'description': 'ディスク容量不足',
                'solutions': [
                    '不要ファイルの削除',
                    'ログローテーション設定',
                    'ディスク容量拡張',
                    'バックアップ保存先の変更'
                ],
                'recovery_steps': [
                    'df -h でディスク使用量確認',
                    'du -sh /* で大容量ディレクトリ特定',
                    '古いバックアップファイル削除',
                    'バックアップ実行再試行'
                ]
            },
            'permission': {
                'description': 'ファイル・ディレクトリ権限問題',
                'solutions': [
                    'バックアップディレクトリの権限確認',
                    '実行ユーザーの権限付与',
                    'SELinux/AppArmorの設定確認'
                ],
                'recovery_steps': [
                    'ls -la でファイル権限確認',
                    'chmod/chown で権限修正',
                    'バックアップスクリプト実行権限確認'
                ]
            },
            'network': {
                'description': 'ネットワーク接続問題',
                'solutions': [
                    'ネットワーク接続確認',
                    'ファイアウォール設定確認',
                    'DNS設定確認',
                    'プロキシ設定確認'
                ],
                'recovery_steps': [
                    'ping でネットワーク疎通確認',
                    'telnet で特定ポート確認',
                    'nslookup でDNS解決確認'
                ]
            },
            'database': {
                'description': 'データベース接続問題',
                'solutions': [
                    'データベース接続情報確認',
                    'データベースサービス状態確認',
                    '認証情報の確認',
                    'データベース設定確認'
                ],
                'recovery_steps': [
                    'psql で手動接続確認',
                    'systemctl status postgresql確認',
                    'pg_hba.conf設定確認'
                ]
            },
            'aws_s3': {
                'description': 'AWS S3接続・権限問題',
                'solutions': [
                    'AWS認証情報確認',
                    'S3バケット権限確認',
                    'IAMポリシー確認',
                    'リージョン設定確認'
                ],
                'recovery_steps': [
                    'aws s3 ls でS3アクセス確認',
                    'AWS認証情報の再設定',
                    'IAMポリシーの権限確認'
                ]
            }
        }
        
        return issue_database.get(issue_type, {
            'description': f'不明な問題: {issue_type}',
            'solutions': ['詳細調査が必要'],
            'recovery_steps': ['ログの詳細分析']
        })
    
    def _check_backup_environment(self, backup_type: str) -> Dict[str, any]:
        """バックアップ環境確認"""
        checks = {
            'disk_space': self._check_disk_space(),
            'dependencies': self._check_dependencies(backup_type),
            'connectivity': self._check_connectivity(backup_type),
            'permissions': self._check_permissions()
        }
        
        return checks
    
    def _check_disk_space(self) -> Dict[str, any]:
        """ディスク容量確認"""
        try:
            result = subprocess.run(['df', '-h'], capture_output=True, text=True)
            disk_usage = result.stdout
            
            # 使用率90%以上の警告
            warning_filesystems = []
            for line in disk_usage.split('\n')[1:]:
                if line.strip():
                    parts = line.split()
                    if len(parts) >= 5:
                        usage_str = parts[4]
                        if usage_str.endswith('%'):
                            usage = int(usage_str[:-1])
                            if usage >= 90:
                                warning_filesystems.append({
                                    'filesystem': parts[0],
                                    'usage': usage,
                                    'mount': parts[5]
                                })
            
            return {
                'status': 'warning' if warning_filesystems else 'ok',
                'disk_usage': disk_usage,
                'warnings': warning_filesystems
            }
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    def _check_dependencies(self, backup_type: str) -> Dict[str, any]:
        """依存関係確認"""
        dependencies = {
            'database': ['pg_dump', 'psql'],
            'files': ['tar', 'gzip'],
            's3': ['aws']
        }
        
        required_tools = dependencies.get(backup_type, [])
        missing_tools = []
        
        for tool in required_tools:
            try:
                subprocess.run(['which', tool], check=True, capture_output=True)
            except subprocess.CalledProcessError:
                missing_tools.append(tool)
        
        return {
            'status': 'error' if missing_tools else 'ok',
            'missing_tools': missing_tools,
            'required_tools': required_tools
        }
    
    def _check_connectivity(self, backup_type: str) -> Dict[str, any]:
        """接続性確認"""
        if self.s3_client:
            try:
                # S3接続テスト
                self.s3_client.list_buckets()
                return {'status': 'ok', 'type': 's3'}
            except Exception as e:
                return {'status': 'error', 'type': 's3', 'error': str(e)}
        
        return {'status': 'skip', 'reason': 'connectivity check not applicable'}
    
    def _check_permissions(self) -> Dict[str, any]:
        """権限確認"""
        backup_dirs = ['/var/backups', '/tmp', '/app/backups']
        permission_issues = []
        
        for backup_dir in backup_dirs:
            if os.path.exists(backup_dir):
                if not os.access(backup_dir, os.W_OK):
                    permission_issues.append(f'{backup_dir}: 書き込み権限なし')
        
        return {
            'status': 'error' if permission_issues else 'ok',
            'issues': permission_issues
        }
    
    def generate_recovery_script(self, diagnosis: Dict[str, any]) -> str:
        """復旧スクリプト生成"""
        script_lines = [
            '#!/bin/bash',
            '# 自動生成されたバックアップ復旧スクリプト',
            f'# 生成日時: {datetime.now().isoformat()}',
            '',
            'echo "バックアップ復旧スクリプト開始"',
            ''
        ]
        
        # 環境チェック結果に基づく修正コマンド
        env_check = diagnosis.get('environment_check', {})
        
        # ディスク容量問題
        if env_check.get('disk_space', {}).get('status') == 'warning':
            script_lines.extend([
                '# ディスク容量警告への対処',
                'echo "古いログファイルを削除中..."',
                'find /var/log -name "*.log.*" -mtime +7 -delete',
                'find /tmp -type f -mtime +3 -delete',
                'echo "ディスククリーンアップ完了"',
                ''
            ])
        
        # 依存関係問題
        missing_tools = env_check.get('dependencies', {}).get('missing_tools', [])
        if missing_tools:
            script_lines.extend([
                '# 不足ツールのインストール',
                'echo "必要なツールをインストール中..."'
            ])
            
            for tool in missing_tools:
                if tool in ['pg_dump', 'psql']:
                    script_lines.append('apt-get update && apt-get install -y postgresql-client')
                elif tool == 'aws':
                    script_lines.append('pip install awscli')
            
            script_lines.append('')
        
        # 権限問題
        permission_issues = env_check.get('permissions', {}).get('issues', [])
        if permission_issues:
            script_lines.extend([
                '# 権限問題の修正',
                'echo "バックアップディレクトリ権限を修正中..."',
                'mkdir -p /var/backups',
                'chmod 755 /var/backups',
                'chown $USER:$USER /var/backups',
                ''
            ])
        
        # バックアップ再実行
        script_lines.extend([
            '# バックアップ再実行',
            'echo "バックアップを再実行中..."',
        ])

        backup_type = diagnosis.get('backup_type')
        if backup_type == 'database':
            script_lines.extend([
                '# 例: Database バックアップ（環境変数 DATABASE_URL を想定）',
                'pg_dump "$DATABASE_URL" -Fc -f "/var/backups/db_$(date +%Y%m%d%H%M%S).dump"',
            ])
        elif backup_type == 'files':
            script_lines.extend([
                '# 例: ファイルバックアップ（/app/uploads と /app/logs を想定）',
                'tar -czf "/var/backups/files_$(date +%Y%m%d%H%M%S).tar.gz" /app/uploads /app/logs',
            ])
        elif backup_type == 'application_data':
            script_lines.extend([
                '# 例: アプリケーションデータのバックアップ（アプリ設定や追加データを想定）',
                'tar -czf "/var/backups/app_data_$(date +%Y%m%d%H%M%S).tar.gz" /app/config /app/extra_data',
            ])
        else:
            script_lines.extend([
                '# バックアップタイプが不明です。コマンドを確認して実行してください。',
            ])

        script_lines.extend([
            '',
            'echo "復旧スクリプト完了"'
        ])
        
        return '\n'.join(script_lines)

# コマンドライン診断ツール
def backup_diagnosis_cli():
    """バックアップ診断CLI"""
    import argparse
    
    parser = argparse.ArgumentParser(description='バックアップ失敗診断ツール')
    parser.add_argument('--type', required=True, choices=['database', 'files', 'application_data'], 
                       help='バックアップタイプ')
    parser.add_argument('--log-file', required=True, help='エラーログファイルパス')
    parser.add_argument('--generate-script', action='store_true', 
                       help='復旧スクリプト生成')
    
    args = parser.parse_args()
    
    try:
        with open(args.log_file, 'r', encoding='utf-8') as f:
            error_log = f.read()
    except FileNotFoundError:
        print(f"エラー: ログファイルが見つかりません: {args.log_file}")
        return
    
    troubleshooter = BackupTroubleshooter()
    diagnosis = troubleshooter.diagnose_backup_failure(args.type, error_log)
    
    print("バックアップ失敗診断結果")
    print("=" * 50)
    
    print(f"バックアップタイプ: {diagnosis['backup_type']}")
    
    if diagnosis['issues_found']:
        print("\n検出された問題:")
        for issue in diagnosis['issues_found']:
            print(f"  [NG] {issue['description']}")
    
    if diagnosis['recommendations']:
        print("\n推奨アクション:")
        for i, rec in enumerate(diagnosis['recommendations'], 1):
            print(f"  {i}. {rec}")
    
    if args.generate_script:
        script = troubleshooter.generate_recovery_script(diagnosis)
        script_file = f"backup_recovery_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sh"
        
        with open(script_file, 'w') as f:
            f.write(script)
        
        print(f"\n復旧スクリプトを生成しました: {script_file}")
        print("実行前にスクリプト内容を確認してください。")

if __name__ == "__main__":
    backup_diagnosis_cli()
```

### 8.5.4 監視・アラート問題対応

#### 監視システム障害の診断

```python
# monitoring_troubleshooter.py
import asyncio
import aiohttp
import psutil
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json
import logging

class MonitoringTroubleshooter:
    """監視システム問題診断"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def diagnose_monitoring_issues(self) -> Dict[str, any]:
        """監視システム総合診断"""
        diagnosis = {
            'timestamp': datetime.now().isoformat(),
            'components': {},
            'overall_health': 'unknown',
            'critical_issues': [],
            'recommendations': []
        }
        
        # 各監視コンポーネント診断
        components = [
            ('metrics_collection', self._diagnose_metrics_collection),
            ('alerting_system', self._diagnose_alerting_system),
            ('log_aggregation', self._diagnose_log_aggregation),
            ('dashboard_access', self._diagnose_dashboard_access),
            ('notification_delivery', self._diagnose_notification_delivery)
        ]
        
        for component_name, diagnostic_func in components:
            try:
                component_result = await diagnostic_func()
                diagnosis['components'][component_name] = component_result
                
                if component_result['status'] == 'critical':
                    diagnosis['critical_issues'].extend(component_result['issues'])
            except Exception as e:
                diagnosis['components'][component_name] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        # 全体的な健全性評価
        diagnosis['overall_health'] = self._evaluate_overall_health(diagnosis['components'])
        
        # 総合推奨事項生成
        diagnosis['recommendations'] = self._generate_comprehensive_recommendations(diagnosis)
        
        return diagnosis
    
    async def _diagnose_metrics_collection(self) -> Dict[str, any]:
        """メトリクス収集診断"""
        issues = []
        status = 'healthy'
        
        # システムリソース確認
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # 閾値チェック
            if cpu_percent > 90:
                issues.append(f'CPU使用率が高い: {cpu_percent:.1f}%')
                status = 'warning'
            
            if memory.percent > 90:
                issues.append(f'メモリ使用率が高い: {memory.percent:.1f}%')
                status = 'critical'
            
            if disk.percent > 95:
                issues.append(f'ディスク使用率が危険レベル: {disk.percent:.1f}%')
                status = 'critical'
        
        except Exception as e:
            issues.append(f'システムメトリクス取得エラー: {str(e)}')
            status = 'error'
        
        # メトリクス収集プロセス確認
        monitoring_processes = self._check_monitoring_processes()
        if not monitoring_processes['running']:
            issues.extend(monitoring_processes['missing_processes'])
            status = 'critical'
        
        return {
            'status': status,
            'issues': issues,
            'metrics': {
                'cpu_percent': cpu_percent if 'cpu_percent' in locals() else None,
                'memory_percent': memory.percent if 'memory' in locals() else None,
                'disk_percent': disk.percent if 'disk' in locals() else None
            },
            'processes': monitoring_processes
        }
    
    def _check_monitoring_processes(self) -> Dict[str, any]:
        """監視プロセス確認"""
        required_processes = [
            'prometheus',
            'grafana-server',
            'alertmanager',
            'node_exporter'
        ]
        
        running_processes = []
        missing_processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            process_name = proc.info['name']
            cmdline = ' '.join(proc.info['cmdline'] or [])
            
            for required in required_processes:
                if required in process_name or required in cmdline:
                    running_processes.append({
                        'name': required,
                        'pid': proc.info['pid'],
                        'status': 'running'
                    })
                    if required in required_processes:
                        required_processes.remove(required)
                    break
        
        missing_processes = [f'{proc}プロセスが動作していません' for proc in required_processes]
        
        return {
            'running': len(missing_processes) == 0,
            'running_processes': running_processes,
            'missing_processes': missing_processes
        }
    
    async def _diagnose_alerting_system(self) -> Dict[str, any]:
        """アラートシステム診断"""
        issues = []
        status = 'healthy'
        
        # Alertmanager健全性確認
        alertmanager_health = await self._check_alertmanager_health()
        if not alertmanager_health['healthy']:
            issues.append('Alertmanagerが応答しません')
            status = 'critical'
        
        # アラートルール設定確認
        alert_rules_check = await self._check_alert_rules()
        if alert_rules_check['errors']:
            issues.extend(alert_rules_check['errors'])
            status = 'warning'
        
        # 過去24時間のアラート統計
        alert_stats = await self._get_alert_statistics()
        
        return {
            'status': status,
            'issues': issues,
            'alertmanager_health': alertmanager_health,
            'alert_rules': alert_rules_check,
            'statistics': alert_stats
        }
    
    async def _check_alertmanager_health(self) -> Dict[str, any]:
        """Alertmanager健全性確認"""
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                async with session.get('http://localhost:9093/-/healthy') as response:
                    healthy = response.status == 200
                    return {
                        'healthy': healthy,
                        'status_code': response.status,
                        'response_time_ms': response.headers.get('X-Response-Time', 'unknown')
                    }
        except Exception as e:
            return {
                'healthy': False,
                'error': str(e)
            }
    
    async def _check_alert_rules(self) -> Dict[str, any]:
        """アラートルール確認"""
        try:
            # Prometheus API経由でルール確認
            async with aiohttp.ClientSession() as session:
                async with session.get('http://localhost:9090/api/v1/rules') as response:
                    if response.status == 200:
                        data = await response.json()
                        rules = data.get('data', {}).get('groups', [])
                        
                        errors = []
                        total_rules = 0
                        active_alerts = 0
                        
                        for group in rules:
                            for rule in group.get('rules', []):
                                total_rules += 1
                                if rule.get('type') == 'alerting' and rule.get('alerts'):
                                    active_alerts += len(rule['alerts'])
                                
                                # ルール健全性チェック
                                if rule.get('health') != 'ok':
                                    errors.append(f"ルール '{rule.get('name')}' に問題: {rule.get('lastError')}")
                        
                        return {
                            'errors': errors,
                            'total_rules': total_rules,
                            'active_alerts': active_alerts
                        }
                    else:
                        return {
                            'errors': [f'Prometheus API エラー: {response.status}'],
                            'total_rules': 0,
                            'active_alerts': 0
                        }
        except Exception as e:
            return {
                'errors': [f'アラートルール確認エラー: {str(e)}'],
                'total_rules': 0,
                'active_alerts': 0
            }
    
    async def _get_alert_statistics(self) -> Dict[str, any]:
        """アラート統計取得"""
        try:
            # 過去24時間のアラート数を取得
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=24)
            
            # 実装簡略化 - 実際は時系列データベースから取得
            return {
                'last_24h_alerts': 15,
                'resolved_alerts': 12,
                'active_alerts': 3,
                'avg_resolution_time_minutes': 45
            }
        except Exception as e:
            return {
                'error': str(e)
            }
    
    async def _diagnose_log_aggregation(self) -> Dict[str, any]:
        """ログ集約診断"""
        issues = []
        status = 'healthy'
        
        # ログファイル確認
        log_files_check = self._check_log_files()
        if log_files_check['issues']:
            issues.extend(log_files_check['issues'])
            status = 'warning'
        
        # ログ転送確認
        log_forwarding_check = await self._check_log_forwarding()
        if not log_forwarding_check['working']:
            issues.append('ログ転送が動作していません')
            status = 'critical'
        
        return {
            'status': status,
            'issues': issues,
            'log_files': log_files_check,
            'log_forwarding': log_forwarding_check
        }
    
    def _check_log_files(self) -> Dict[str, any]:
        """ログファイル確認"""
        log_paths = [
            '/var/log/application.log',
            '/var/log/nginx/access.log',
            '/var/log/nginx/error.log',
            '/app/logs/app.log'
        ]
        
        issues = []
        log_status = []
        
        for log_path in log_paths:
            try:
                if os.path.exists(log_path):
                    stat = os.stat(log_path)
                    size_mb = stat.st_size / (1024 * 1024)
                    last_modified = datetime.fromtimestamp(stat.st_mtime)
                    
                    # 過去1時間以内に更新されているか
                    if datetime.now() - last_modified > timedelta(hours=1):
                        issues.append(f'{log_path} が1時間以上更新されていません')
                    
                    # ファイルサイズが異常に大きくないか
                    if size_mb > 1000:  # 1GB
                        issues.append(f'{log_path} のサイズが大きすぎます: {size_mb:.1f}MB')
                    
                    log_status.append({
                        'path': log_path,
                        'size_mb': size_mb,
                        'last_modified': last_modified.isoformat(),
                        'exists': True
                    })
                else:
                    log_status.append({
                        'path': log_path,
                        'exists': False
                    })
            except Exception as e:
                issues.append(f'{log_path} 確認エラー: {str(e)}')
        
        return {
            'issues': issues,
            'log_status': log_status
        }
    
    async def _check_log_forwarding(self) -> Dict[str, any]:
        """ログ転送確認"""
        # ログ転送サービス（Fluent Bit, Filebeat等）の確認
        log_forwarders = ['fluent-bit', 'filebeat', 'fluentd']
        
        for forwarder in log_forwarders:
            for proc in psutil.process_iter(['pid', 'name']):
                if forwarder in proc.info['name']:
                    return {
                        'working': True,
                        'forwarder': forwarder,
                        'pid': proc.info['pid']
                    }
        
        return {
            'working': False,
            'error': 'ログ転送プロセスが見つかりません'
        }
    
    async def _diagnose_dashboard_access(self) -> Dict[str, any]:
        """ダッシュボードアクセス診断"""
        dashboards = [
            {'name': 'Grafana', 'url': 'http://localhost:3000'},
            {'name': 'Prometheus', 'url': 'http://localhost:9090'},
            {'name': 'Alertmanager', 'url': 'http://localhost:9093'}
        ]
        
        issues = []
        dashboard_status = []
        
        for dashboard in dashboards:
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                    start_time = asyncio.get_event_loop().time()
                    async with session.get(dashboard['url']) as response:
                        end_time = asyncio.get_event_loop().time()
                        response_time = (end_time - start_time) * 1000
                        
                        accessible = response.status < 400
                        if not accessible:
                            issues.append(f"{dashboard['name']} にアクセスできません: {response.status}")
                        
                        dashboard_status.append({
                            'name': dashboard['name'],
                            'url': dashboard['url'],
                            'accessible': accessible,
                            'status_code': response.status,
                            'response_time_ms': response_time
                        })
            except Exception as e:
                issues.append(f"{dashboard['name']} 接続エラー: {str(e)}")
                dashboard_status.append({
                    'name': dashboard['name'],
                    'url': dashboard['url'],
                    'accessible': False,
                    'error': str(e)
                })
        
        status = 'critical' if issues else 'healthy'
        
        return {
            'status': status,
            'issues': issues,
            'dashboards': dashboard_status
        }
    
    async def _diagnose_notification_delivery(self) -> Dict[str, any]:
        """通知配信診断"""
        # 通知チャネル確認
        notification_channels = {
            'email': self._test_email_delivery,
            'slack': self._test_slack_delivery,
            'sms': self._test_sms_delivery
        }
        
        issues = []
        channel_status = {}
        
        for channel_name, test_func in notification_channels.items():
            try:
                result = await test_func()
                channel_status[channel_name] = result
                
                if not result.get('working', False):
                    issues.append(f'{channel_name} 通知が動作していません')
            except Exception as e:
                channel_status[channel_name] = {
                    'working': False,
                    'error': str(e)
                }
                issues.append(f'{channel_name} 通知テストエラー: {str(e)}')
        
        status = 'critical' if issues else 'healthy'
        
        return {
            'status': status,
            'issues': issues,
            'channels': channel_status
        }
    
    async def _test_email_delivery(self) -> Dict[str, any]:
        """メール配信テスト"""
        # 実装簡略化 - 実際はSMTPサーバー接続テスト
        return {
            'working': True,
            'test_result': 'SMTP接続確認済み'
        }
    
    async def _test_slack_delivery(self) -> Dict[str, any]:
        """Slack配信テスト"""
        # 実装簡略化 - 実際はSlack Webhook テスト
        return {
            'working': True,
            'test_result': 'Slack Webhook接続確認済み'
        }
    
    async def _test_sms_delivery(self) -> Dict[str, any]:
        """SMS配信テスト"""
        # 実装簡略化 - 実際はSMS API テスト
        return {
            'working': False,
            'test_result': 'SMS API未設定'
        }
    
    def _evaluate_overall_health(self, components: Dict[str, any]) -> str:
        """全体的な健全性評価"""
        critical_count = sum(1 for comp in components.values() if comp.get('status') == 'critical')
        warning_count = sum(1 for comp in components.values() if comp.get('status') == 'warning')
        
        if critical_count > 0:
            return 'critical'
        elif warning_count > 2:
            return 'degraded'
        elif warning_count > 0:
            return 'warning'
        else:
            return 'healthy'
    
    def _generate_comprehensive_recommendations(self, diagnosis: Dict[str, any]) -> List[str]:
        """総合推奨事項生成"""
        recommendations = []
        
        overall_health = diagnosis['overall_health']
        
        if overall_health == 'critical':
            recommendations.extend([
                '緊急対応が必要です',
                '監視システムの重要なコンポーネントに障害があります',
                '運用チームに即座に連絡してください'
            ])
        
        # コンポーネント別推奨事項
        components = diagnosis['components']
        
        if components.get('metrics_collection', {}).get('status') in ['critical', 'warning']:
            recommendations.extend([
                'システムリソースの確認と最適化',
                '監視プロセスの再起動を検討',
                'メトリクス収集間隔の調整'
            ])
        
        if components.get('alerting_system', {}).get('status') in ['critical', 'warning']:
            recommendations.extend([
                'アラートルールの見直し',
                'Alertmanager設定の確認',
                'アラート通知の動作確認'
            ])
        
        if components.get('log_aggregation', {}).get('status') in ['critical', 'warning']:
            recommendations.extend([
                'ログローテーション設定の確認',
                'ログ転送サービスの再起動',
                'ディスク容量の確保'
            ])
        
        if not recommendations:
            recommendations.append('監視システムは正常に動作しています')
        
        return recommendations

# 監視システム診断実行
async def run_monitoring_diagnosis():
    """監視システム診断実行"""
    troubleshooter = MonitoringTroubleshooter()
    
    print("監視システム診断を開始します...")
    
    diagnosis = await troubleshooter.diagnose_monitoring_issues()
    
    print("\n" + "=" * 60)
    print("監視システム診断結果")
    print("=" * 60)
    
    print(f"全体的な健全性: {diagnosis['overall_health']}")
    print(f"診断実行時刻: {diagnosis['timestamp']}")
    
    print("\nコンポーネント別状況:")
    for component_name, component_info in diagnosis['components'].items():
        status = component_info.get('status', 'unknown')
        print(f"  {component_name}: {status}")
        
        if component_info.get('issues'):
            for issue in component_info['issues']:
                print(f"    [WARN] {issue}")
    
    if diagnosis['critical_issues']:
        print("\n[CRITICAL] 重要な問題:")
        for issue in diagnosis['critical_issues']:
            print(f"  [NG] {issue}")
    
    print("\n 推奨アクション:")
    for i, rec in enumerate(diagnosis['recommendations'], 1):
        print(f"  {i}. {rec}")
    
    # 詳細レポート保存
    report_file = f"monitoring_diagnosis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(diagnosis, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n詳細レポートを保存しました: {report_file}")

if __name__ == "__main__":
    asyncio.run(run_monitoring_diagnosis())
```

### 8.5.5 運用自動化問題の予防策

#### プロアクティブ監視設定

{% raw %}
```yaml
# proactive_monitoring_rules.yml
groups:
- name: operational_health
  rules:
  # CI/CDパイプライン監視
  - alert: GitHubActionsFailed
    expr: github_actions_workflow_run_conclusion{conclusion="failure"} > 0
    for: 0m
    labels:
      severity: warning
      component: cicd
    annotations:
      summary: "GitHub Actions ワークフローが失敗しました"
      description: "Repository {{ $labels.repository }} のワークフロー {{ $labels.workflow_name }} が失敗しました"
      runbook_url: "https://docs.company.com/runbooks/github-actions-failure"
  
  # バックアップ監視
  - alert: BackupJobFailed
    expr: |
      (
        time() - backup_last_success_timestamp
      ) > 86400  # 24時間
    for: 30m
    labels:
      severity: critical
      component: backup
    annotations:
      summary: "バックアップが24時間以上実行されていません"
      description: "{{ $labels.backup_type }} バックアップが {{ $value | humanizeDuration }} 実行されていません"
  
  - alert: BackupStorageSpaceLow
    expr: backup_storage_available_bytes / backup_storage_total_bytes < 0.1
    for: 15m
    labels:
      severity: warning
      component: backup
    annotations:
      summary: "バックアップストレージ容量が不足しています"
      description: "バックアップストレージの残り容量が {{ $value | humanizePercentage }} です"
  
  # データベースマイグレーション監視
  - alert: MigrationStuck
    expr: migration_in_progress_duration_seconds > 3600  # 1時間
    for: 0m
    labels:
      severity: critical
      component: migration
    annotations:
      summary: "マイグレーションが1時間以上進行中です"
      description: "Migration version {{ $labels.version }} が {{ $value | humanizeDuration }} 実行されています"
  
  # システムリソース監視
  - alert: SystemResourceExhaustion
    expr: |
      (
        node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.05
      ) or (
        node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} < 0.05
      ) or (
        100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 95
      )
    for: 5m
    labels:
      severity: critical
      component: infrastructure
    annotations:
      summary: "システムリソースが枯渇しています"
      description: "{{ $labels.instance }} でリソース枯渇が検出されました"
  
  # アプリケーション健全性監視
  - alert: ApplicationUnhealthy
    expr: up{job="app"} == 0
    for: 1m
    labels:
      severity: critical
      component: application
    annotations:
      summary: "アプリケーションが応答していません"
      description: "{{ $labels.instance }} のアプリケーションが応答していません"
  
  - alert: ApplicationHighErrorRate
    expr: |
      (
        rate(http_requests_total{status=~"5.."}[5m]) /
        rate(http_requests_total[5m])
      ) > 0.1
    for: 5m
    labels:
      severity: warning
      component: application
    annotations:
      summary: "アプリケーションのエラー率が高くなっています"
      description: "{{ $labels.service }} のエラー率が {{ $value | humanizePercentage }} です"
  
  # Edge Functions監視
  - alert: EdgeFunctionColdStartHigh
    expr: supabase_edge_function_cold_start_duration_ms > 5000
    for: 2m
    labels:
      severity: warning
      component: edge_functions
    annotations:
      summary: "Edge Function のコールドスタート時間が長くなっています"
      description: "Function {{ $labels.function_name }} のコールドスタート時間が {{ $value }}ms です"
  
  - alert: EdgeFunctionTimeoutHigh
    expr: rate(supabase_edge_function_timeouts_total[5m]) > 0.01
    for: 3m
    labels:
      severity: warning
      component: edge_functions
    annotations:
      summary: "Edge Function でタイムアウトが頻発しています"
      description: "Function {{ $labels.function_name }} でタイムアウトが発生しています"
  
  # データベース接続監視
  - alert: DatabaseConnectionPoolExhausted
    expr: database_active_connections / database_max_connections > 0.9
    for: 2m
    labels:
      severity: critical
      component: database
    annotations:
      summary: "データベース接続プールが枯渇しています"
      description: "アクティブ接続数が最大接続数の90%を超えています"
  
  - alert: DatabaseQuerySlow
    expr: histogram_quantile(0.95, database_query_duration_seconds) > 2
    for: 5m
    labels:
      severity: warning
      component: database
    annotations:
      summary: "データベースクエリが遅くなっています"
      description: "クエリの95パーセンタイルが {{ $value }}秒です"

- name: security_monitoring
  rules:
  # セキュリティイベント監視
  - alert: SuspiciousLoginActivity
    expr: rate(auth_failed_login_attempts_total[5m]) > 10
    for: 1m
    labels:
      severity: warning
      component: security
    annotations:
      summary: "異常なログイン試行が検出されました"
      description: "{{ $labels.source_ip }} から {{ $value }} 回/分のログイン失敗が発生しています"
  
  - alert: UnauthorizedAPIAccess
    expr: rate(http_requests_total{status="401"}[5m]) > 5
    for: 2m
    labels:
      severity: warning
      component: security
    annotations:
      summary: "未認証のAPIアクセスが増加しています"
      description: "未認証アクセスが {{ $value }} 回/分 発生しています"
```
{% endraw %}

#### 運用チェックリスト自動化

```python
# operational_checklist.py
from typing import Dict, List, Callable, Any
from dataclasses import dataclass
from datetime import datetime
import asyncio
import json

@dataclass
class ChecklistItem:
    id: str
    name: str
    description: str
    category: str
    priority: str  # critical, high, medium, low
    frequency: str  # daily, weekly, monthly
    check_function: Callable
    remediation_steps: List[str]
    documentation_url: str = ""

class OperationalChecklistAutomator:
    """運用チェックリスト自動化"""
    
    def __init__(self):
        self.checklist_items = self._initialize_checklist()
        self.execution_history = []
    
    def _initialize_checklist(self) -> List[ChecklistItem]:
        """チェックリスト初期化"""
        return [
            ChecklistItem(
                id="backup_verification",
                name="バックアップ検証",
                description="過去24時間のバックアップが正常に完了していることを確認",
                category="data_protection",
                priority="critical",
                frequency="daily",
                check_function=self._check_backup_status,
                remediation_steps=[
                    "バックアップログの確認",
                    "失敗したバックアップの手動実行",
                    "バックアップストレージ容量の確認"
                ],
                documentation_url="https://docs.company.com/backup-procedures"
            ),
            ChecklistItem(
                id="ssl_certificate_expiry",
                name="SSL証明書期限確認",
                description="SSL証明書の有効期限が30日以内でないことを確認",
                category="security",
                priority="high",
                frequency="weekly",
                check_function=self._check_ssl_certificates,
                remediation_steps=[
                    "証明書更新手続きの開始",
                    "証明書更新スケジュールの確認",
                    "Let's Encrypt自動更新の確認"
                ]
            ),
            ChecklistItem(
                id="database_performance",
                name="データベースパフォーマンス確認",
                description="データベースの応答時間とリソース使用量を確認",
                category="performance",
                priority="high",
                frequency="daily",
                check_function=self._check_database_performance,
                remediation_steps=[
                    "遅いクエリの特定と最適化",
                    "インデックスの見直し",
                    "データベース統計の更新"
                ]
            ),
            ChecklistItem(
                id="log_analysis",
                name="エラーログ分析",
                description="過去24時間のエラーログを分析し、異常な傾向がないか確認",
                category="monitoring",
                priority="medium",
                frequency="daily",
                check_function=self._analyze_error_logs,
                remediation_steps=[
                    "エラーパターンの詳細調査",
                    "関連するコードの確認",
                    "修正パッチの適用検討"
                ]
            ),
            ChecklistItem(
                id="security_updates",
                name="セキュリティ更新確認",
                description="システムのセキュリティ更新とパッチ適用状況を確認",
                category="security",
                priority="critical",
                frequency="weekly",
                check_function=self._check_security_updates,
                remediation_steps=[
                    "セキュリティ更新の計画",
                    "テスト環境での更新検証",
                    "本番環境での更新実行"
                ]
            ),
            ChecklistItem(
                id="capacity_planning",
                name="キャパシティ計画確認",
                description="リソース使用傾向と将来のキャパシティ需要を確認",
                category="capacity",
                priority="medium",
                frequency="weekly",
                check_function=self._check_capacity_trends,
                remediation_steps=[
                    "リソース使用量トレンドの分析",
                    "スケールアップ/アウト計画の検討",
                    "コスト最適化の機会調査"
                ]
            )
        ]
    
    async def run_automated_checks(self, frequency: str = "daily") -> Dict[str, Any]:
        """自動チェック実行"""
        execution_report = {
            'execution_time': datetime.now(),
            'frequency': frequency,
            'checks_run': [],
            'summary': {
                'total': 0,
                'passed': 0,
                'failed': 0,
                'warnings': 0
            },
            'failed_checks': [],
            'remediation_required': []
        }
        
        # 頻度に基づくフィルタリング
        relevant_checks = [
            item for item in self.checklist_items 
            if item.frequency == frequency or frequency == "all"
        ]
        
        for check_item in relevant_checks:
            try:
                print(f"実行中: {check_item.name}")
                
                result = await check_item.check_function()
                
                check_result = {
                    'id': check_item.id,
                    'name': check_item.name,
                    'category': check_item.category,
                    'priority': check_item.priority,
                    'status': result['status'],
                    'message': result.get('message', ''),
                    'details': result.get('details', {}),
                    'execution_time': datetime.now()
                }
                
                execution_report['checks_run'].append(check_result)
                execution_report['summary']['total'] += 1
                
                if result['status'] == 'passed':
                    execution_report['summary']['passed'] += 1
                elif result['status'] == 'warning':
                    execution_report['summary']['warnings'] += 1
                else:  # failed
                    execution_report['summary']['failed'] += 1
                    execution_report['failed_checks'].append(check_result)
                    
                    # 修復アクション追加
                    execution_report['remediation_required'].append({
                        'check_id': check_item.id,
                        'check_name': check_item.name,
                        'priority': check_item.priority,
                        'remediation_steps': check_item.remediation_steps,
                        'documentation_url': check_item.documentation_url
                    })
                
            except Exception as e:
                error_result = {
                    'id': check_item.id,
                    'name': check_item.name,
                    'category': check_item.category,
                    'priority': check_item.priority,
                    'status': 'error',
                    'message': f'チェック実行エラー: {str(e)}',
                    'execution_time': datetime.now()
                }
                
                execution_report['checks_run'].append(error_result)
                execution_report['summary']['total'] += 1
                execution_report['summary']['failed'] += 1
                execution_report['failed_checks'].append(error_result)
        
        # 実行履歴に追加
        self.execution_history.append(execution_report)
        
        # レポート保存
        await self._save_execution_report(execution_report)
        
        return execution_report
    
    async def _check_backup_status(self) -> Dict[str, Any]:
        """バックアップ状態確認"""
        # 実装簡略化 - 実際はバックアップシステムAPI呼び出し
        try:
            # バックアップログ確認（例）
            last_backup_time = datetime.now()  # 実際はログから取得
            backup_size_gb = 15.5  # 実際はバックアップファイルサイズ
            
            # 24時間以内のバックアップ確認
            hours_since_backup = (datetime.now() - last_backup_time).total_seconds() / 3600
            
            if hours_since_backup > 24:
                return {
                    'status': 'failed',
                    'message': f'最新バックアップが{hours_since_backup:.1f}時間前です',
                    'details': {
                        'last_backup_time': last_backup_time.isoformat(),
                        'hours_since_backup': hours_since_backup
                    }
                }
            elif hours_since_backup > 12:
                return {
                    'status': 'warning',
                    'message': f'バックアップが{hours_since_backup:.1f}時間前です',
                    'details': {
                        'last_backup_time': last_backup_time.isoformat(),
                        'backup_size_gb': backup_size_gb
                    }
                }
            else:
                return {
                    'status': 'passed',
                    'message': 'バックアップは正常に実行されています',
                    'details': {
                        'last_backup_time': last_backup_time.isoformat(),
                        'backup_size_gb': backup_size_gb,
                        'hours_since_backup': hours_since_backup
                    }
                }
        except Exception as e:
            return {
                'status': 'failed',
                'message': f'バックアップ状態確認エラー: {str(e)}'
            }
    
    async def _check_ssl_certificates(self) -> Dict[str, Any]:
        """SSL証明書確認"""
        import ssl
        import socket
        from datetime import datetime
        
        domains = ['example.com', 'api.example.com']  # 実際のドメインリスト
        certificate_issues = []
        
        for domain in domains:
            try:
                context = ssl.create_default_context()
                with socket.create_connection((domain, 443), timeout=10) as sock:
                    with context.wrap_socket(sock, server_hostname=domain) as ssock:
                        cert = ssock.getpeercert()
                        
                        # 有効期限確認
                        not_after = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
                        days_until_expiry = (not_after - datetime.now()).days
                        
                        if days_until_expiry < 7:
                            certificate_issues.append({
                                'domain': domain,
                                'days_until_expiry': days_until_expiry,
                                'expiry_date': not_after.isoformat(),
                                'severity': 'critical'
                            })
                        elif days_until_expiry < 30:
                            certificate_issues.append({
                                'domain': domain,
                                'days_until_expiry': days_until_expiry,
                                'expiry_date': not_after.isoformat(),
                                'severity': 'warning'
                            })
            except Exception as e:
                certificate_issues.append({
                    'domain': domain,
                    'error': str(e),
                    'severity': 'error'
                })
        
        if certificate_issues:
            critical_issues = [issue for issue in certificate_issues if issue.get('severity') == 'critical']
            if critical_issues:
                return {
                    'status': 'failed',
                    'message': 'SSL証明書の有効期限が近づいています',
                    'details': {'certificate_issues': certificate_issues}
                }
            else:
                return {
                    'status': 'warning',
                    'message': 'SSL証明書の更新を検討してください',
                    'details': {'certificate_issues': certificate_issues}
                }
        else:
            return {
                'status': 'passed',
                'message': 'すべてのSSL証明書は有効です'
            }
    
    async def _check_database_performance(self) -> Dict[str, Any]:
        """データベースパフォーマンス確認"""
        # 実装簡略化 - 実際はデータベース監視メトリクス取得
        try:
            # サンプルメトリクス
            avg_query_time_ms = 150  # 実際は監視システムから取得
            active_connections = 25
            max_connections = 100
            
            performance_issues = []
            
            if avg_query_time_ms > 1000:
                performance_issues.append('平均クエリ時間が1秒を超えています')
            elif avg_query_time_ms > 500:
                performance_issues.append('平均クエリ時間が500msを超えています')
            
            connection_usage = (active_connections / max_connections) * 100
            if connection_usage > 80:
                performance_issues.append(f'データベース接続使用率が{connection_usage:.1f}%です')
            
            if performance_issues:
                return {
                    'status': 'warning' if avg_query_time_ms < 1000 and connection_usage < 90 else 'failed',
                    'message': '\n'.join(performance_issues),
                    'details': {
                        'avg_query_time_ms': avg_query_time_ms,
                        'active_connections': active_connections,
                        'connection_usage_percent': connection_usage
                    }
                }
            else:
                return {
                    'status': 'passed',
                    'message': 'データベースパフォーマンスは正常です',
                    'details': {
                        'avg_query_time_ms': avg_query_time_ms,
                        'active_connections': active_connections,
                        'connection_usage_percent': connection_usage
                    }
                }
        except Exception as e:
            return {
                'status': 'failed',
                'message': f'データベースパフォーマンス確認エラー: {str(e)}'
            }
    
    async def _analyze_error_logs(self) -> Dict[str, Any]:
        """エラーログ分析"""
        # 実装簡略化 - 実際はログ集約システムからデータ取得
        try:
            # サンプルエラー統計
            error_counts = {
                'database_connection_error': 5,
                'authentication_failed': 12,
                'api_timeout': 3,
                'validation_error': 25
            }
            
            total_errors = sum(error_counts.values())
            
            # 異常な増加の検出
            concerning_errors = []
            for error_type, count in error_counts.items():
                if count > 20:  # 閾値
                    concerning_errors.append(f'{error_type}: {count}回')
            
            if concerning_errors:
                return {
                    'status': 'warning',
                    'message': f'エラーの異常な増加が検出されました: {", ".join(concerning_errors)}',
                    'details': {
                        'total_errors': total_errors,
                        'error_breakdown': error_counts,
                        'concerning_errors': concerning_errors
                    }
                }
            else:
                return {
                    'status': 'passed',
                    'message': f'エラーログは正常範囲内です（合計: {total_errors}件）',
                    'details': {
                        'total_errors': total_errors,
                        'error_breakdown': error_counts
                    }
                }
        except Exception as e:
            return {
                'status': 'failed',
                'message': f'エラーログ分析エラー: {str(e)}'
            }
    
    async def _check_security_updates(self) -> Dict[str, Any]:
        """セキュリティ更新確認"""
        # 実装簡略化 - 実際はパッケージマネージャーやCVEデータベース確認
        try:
            # サンプル：利用可能な更新
            available_updates = {
                'critical': 2,
                'high': 5,
                'medium': 12,
                'low': 8
            }
            
            if available_updates['critical'] > 0:
                return {
                    'status': 'failed',
                    'message': f"重要なセキュリティ更新が{available_updates['critical']}件あります",
                    'details': {
                        'available_updates': available_updates,
                        'recommendation': '至急セキュリティ更新を適用してください'
                    }
                }
            elif available_updates['high'] > 10:
                return {
                    'status': 'warning',
                    'message': f"高レベルのセキュリティ更新が{available_updates['high']}件あります",
                    'details': {
                        'available_updates': available_updates,
                        'recommendation': '計画的にセキュリティ更新を適用してください'
                    }
                }
            else:
                return {
                    'status': 'passed',
                    'message': 'セキュリティ更新は最新です',
                    'details': {'available_updates': available_updates}
                }
        except Exception as e:
            return {
                'status': 'failed',
                'message': f'セキュリティ更新確認エラー: {str(e)}'
            }
    
    async def _check_capacity_trends(self) -> Dict[str, Any]:
        """キャパシティトレンド確認"""
        # 実装簡略化 - 実際は監視システムから過去データ取得
        try:
            # サンプルトレンドデータ
            capacity_metrics = {
                'cpu_trend_7d': 65.2,  # 7日間平均
                'memory_trend_7d': 72.8,
                'disk_trend_7d': 45.5,
                'predicted_cpu_30d': 75.0,  # 30日後予測
                'predicted_memory_30d': 85.2,
                'predicted_disk_30d': 65.0
            }
            
            capacity_warnings = []
            
            if capacity_metrics['predicted_cpu_30d'] > 80:
                capacity_warnings.append('30日後にCPU使用率が80%を超える可能性があります')
            
            if capacity_metrics['predicted_memory_30d'] > 85:
                capacity_warnings.append('30日後にメモリ使用率が85%を超える可能性があります')
            
            if capacity_metrics['predicted_disk_30d'] > 80:
                capacity_warnings.append('30日後にディスク使用率が80%を超える可能性があります')
            
            if capacity_warnings:
                return {
                    'status': 'warning',
                    'message': '\n'.join(capacity_warnings),
                    'details': {
                        'capacity_metrics': capacity_metrics,
                        'recommendation': 'キャパシティ拡張を検討してください'
                    }
                }
            else:
                return {
                    'status': 'passed',
                    'message': 'キャパシティは十分です',
                    'details': {'capacity_metrics': capacity_metrics}
                }
        except Exception as e:
            return {
                'status': 'failed',
                'message': f'キャパシティトレンド確認エラー: {str(e)}'
            }
    
    async def _save_execution_report(self, report: Dict[str, Any]):
        """実行レポート保存"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"operational_checklist_report_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"チェックリスト実行レポートを保存しました: {filename}")
    
    def generate_remediation_plan(self, execution_report: Dict[str, Any]) -> str:
        """修復計画生成"""
        if not execution_report['remediation_required']:
            return "修復が必要な項目はありません。"
        
        plan = ["# 運用チェックリスト修復計画\n"]
        plan.append(f"生成日時: {datetime.now().isoformat()}\n")
        plan.append(f"実行頻度: {execution_report['frequency']}\n")
        
        # 優先度別でソート
        priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        sorted_items = sorted(
            execution_report['remediation_required'],
            key=lambda x: priority_order.get(x['priority'], 4)
        )
        
        current_priority = None
        for item in sorted_items:
            if item['priority'] != current_priority:
                current_priority = item['priority']
                plan.append(f"\n## {current_priority.upper()} 優先度\n")
            
            plan.append(f"### {item['check_name']}\n")
            plan.append(f"**チェックID**: {item['check_id']}\n")
            plan.append("**修復手順**:\n")
            
            for i, step in enumerate(item['remediation_steps'], 1):
                plan.append(f"{i}. {step}\n")
            
            if item['documentation_url']:
                plan.append(f"**参考資料**: {item['documentation_url']}\n")
            
            plan.append("---\n")
        
        return ''.join(plan)

# 使用例
async def run_daily_checklist():
    """日次チェックリスト実行"""
    automator = OperationalChecklistAutomator()
    
    print("日次運用チェックリストを実行中...\n")
    
    # 日次チェック実行
    report = await automator.run_automated_checks("daily")
    
    # 結果表示
    print("\n" + "=" * 60)
    print("日次チェックリスト実行結果")
    print("=" * 60)
    
    summary = report['summary']
    print(f"実行時刻: {report['execution_time']}")
    print(f"合計チェック数: {summary['total']}")
    print(f"成功: {summary['passed']}, 警告: {summary['warnings']}, 失敗: {summary['failed']}")
    
    if report['failed_checks']:
        print("\n[WARN] 失敗したチェック:")
        for check in report['failed_checks']:
            print(f"  [NG] {check['name']}: {check['message']}")
    
    if report['remediation_required']:
        print("\n 修復が必要な項目があります")
        
        # 修復計画生成
        remediation_plan = automator.generate_remediation_plan(report)
        plan_filename = f"remediation_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        
        with open(plan_filename, 'w', encoding='utf-8') as f:
            f.write(remediation_plan)
        
        print(f"修復計画を生成しました: {plan_filename}")
    else:
        print("\n[OK] すべてのチェックが正常に完了しました")

if __name__ == "__main__":
    asyncio.run(run_daily_checklist())
```

---

## トラブルシューティング

### システム運用の問題

#### 問題1: Supabase プロジェクトの応答性能低下

**症状**:
- API レスポンス時間の増加
- 接続タイムアウト
- データベースクエリの遅延

**診断手順**:
```python
import asyncio
import time
from supabase import create_client
import logging

async def diagnose_performance():
    """パフォーマンス診断実行"""
    
    supabase = create_client(url, key)
    
    # 1. 基本接続テスト
    start_time = time.time()
    try:
        response = await supabase.table('_health').select('*').limit(1).execute()
        connection_time = time.time() - start_time
        print(f"基本接続時間: {connection_time:.3f}秒")
    except Exception as e:
        print(f"接続エラー: {e}")
        return
    
    # 2. データベースメトリクス取得
    metrics_query = """
    SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
    FROM pg_stat_user_tables 
    ORDER BY n_live_tup DESC;
    """
    
    start_time = time.time()
    result = await supabase.rpc('execute_sql', {'query': metrics_query}).execute()
    query_time = time.time() - start_time
    
    print(f"メトリクス取得時間: {query_time:.3f}秒")
    
    # 3. 接続プール状態確認
    pool_query = """
    SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
    FROM pg_stat_activity;
    """
    
    pool_result = await supabase.rpc('execute_sql', {'query': pool_query}).execute()
    print("接続プール状態:", pool_result.data)

# 実行
asyncio.run(diagnose_performance())
```

**解決策**:
```python
# パフォーマンス最適化設定
class PerformanceOptimizer:
    def __init__(self, supabase_client):
        self.client = supabase_client
        self.logger = logging.getLogger(__name__)
    
    async def optimize_queries(self):
        """クエリ最適化実行"""
        
        # 1. インデックス分析
        index_analysis = """
        SELECT 
            t.tablename,
            indexname,
            idx_stat.idx_scan as index_scans,
            idx_stat.idx_tup_read as tuples_read,
            idx_stat.idx_tup_fetch as tuples_fetched
        FROM pg_tables t
        LEFT JOIN pg_stat_user_indexes idx_stat 
            ON t.tablename = idx_stat.relname
        WHERE t.schemaname = 'public'
        ORDER BY idx_stat.idx_scan DESC;
        """
        
        result = await self.client.rpc('execute_sql', 
                                     {'query': index_analysis}).execute()
        
        # 2. 低使用インデックスの特定
        unused_indexes = [
            idx for idx in result.data 
            if idx['index_scans'] < 10
        ]
        
        if unused_indexes:
            self.logger.warning(f"低使用インデックス: {len(unused_indexes)}個")
            
        return {
            "analyzed_indexes": len(result.data),
            "unused_indexes": unused_indexes,
            "optimization_recommendations": self._generate_recommendations(result.data)
        }
    
    def _generate_recommendations(self, index_data):
        """最適化推奨事項生成"""
        recommendations = []
        
        for idx in index_data:
            if idx['index_scans'] == 0:
                recommendations.append(f"インデックス削除検討: {idx['indexname']}")
            elif idx['tuples_read'] > idx['tuples_fetched'] * 10:
                recommendations.append(f"インデックス効率改善: {idx['indexname']}")
        
        return recommendations
```

#### 問題2: バックアップ・リストア失敗

**症状**:
- バックアップファイル作成に失敗
- リストア処理がエラーで停止
- データ不整合

**診断手順**:
```python
import subprocess
import json
from datetime import datetime

class BackupDiagnostics:
    def __init__(self, project_ref, password):
        self.project_ref = project_ref
        self.password = password
        
    def diagnose_backup_issues(self):
        """バックアップ問題診断"""
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "checks": [],
            "recommendations": []
        }
        
        # 1. 接続テスト
        try:
            connection_result = subprocess.run([
                'psql', 
                f'postgresql://postgres:{self.password}@db.{self.project_ref}.supabase.co:5432/postgres',
                '-c', 'SELECT version();'
            ], capture_output=True, text=True, timeout=30)
            
            if connection_result.returncode == 0:
                results["checks"].append({
                    "name": "データベース接続",
                    "status": "success",
                    "details": "接続成功"
                })
            else:
                results["checks"].append({
                    "name": "データベース接続", 
                    "status": "failed",
                    "details": connection_result.stderr
                })
                
        except subprocess.TimeoutExpired:
            results["checks"].append({
                "name": "データベース接続",
                "status": "failed", 
                "details": "接続タイムアウト"
            })
        
        # 2. ディスク容量チェック
        disk_result = subprocess.run(['df', '-h'], capture_output=True, text=True)
        results["checks"].append({
            "name": "ディスク容量",
            "status": "info",
            "details": disk_result.stdout
        })
        
        # 3. バックアップサイズ予測
        size_query = """
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname IN ('public', 'auth')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
        """
        
        try:
            size_result = subprocess.run([
                'psql',
                f'postgresql://postgres:{self.password}@db.{self.project_ref}.supabase.co:5432/postgres',
                '-c', size_query
            ], capture_output=True, text=True)
            
            results["checks"].append({
                "name": "データサイズ分析",
                "status": "success",
                "details": size_result.stdout
            })
            
        except Exception as e:
            results["checks"].append({
                "name": "データサイズ分析",
                "status": "failed", 
                "details": str(e)
            })
        
        return results
    
    def test_backup_restore_cycle(self):
        """バックアップ・リストアサイクルテスト"""
        
        test_db = f"test_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            # 1. テストデータベース作成
            create_result = subprocess.run([
                'createdb',
                f'postgresql://postgres:{self.password}@db.{self.project_ref}.supabase.co:5432/{test_db}'
            ], capture_output=True, text=True)
            
            # 2. 小規模バックアップテスト
            backup_result = subprocess.run([
                'pg_dump',
                f'postgresql://postgres:{self.password}@db.{self.project_ref}.supabase.co:5432/postgres',
                '--schema=public',
                '--table=test_table',
                '--file=test_backup.sql'
            ], capture_output=True, text=True)
            
            # 3. リストアテスト
            restore_result = subprocess.run([
                'psql',
                f'postgresql://postgres:{self.password}@db.{self.project_ref}.supabase.co:5432/{test_db}',
                '--file=test_backup.sql'
            ], capture_output=True, text=True)
            
            return {
                "backup_success": backup_result.returncode == 0,
                "restore_success": restore_result.returncode == 0,
                "backup_error": backup_result.stderr if backup_result.returncode != 0 else None,
                "restore_error": restore_result.stderr if restore_result.returncode != 0 else None
            }
            
        finally:
            # クリーンアップ
            subprocess.run([
                'dropdb', 
                f'postgresql://postgres:{self.password}@db.{self.project_ref}.supabase.co:5432/{test_db}'
            ], capture_output=True)
```

### 監視・アラートの問題

#### 問題3: メトリクス収集の欠落

**症状**:
- 監視ダッシュボードにデータが表示されない
- アラートが発火しない
- メトリクス収集エラー

**解決手順**:
```python
import asyncio
import json
from datetime import datetime, timedelta

class MetricsCollector:
    def __init__(self, supabase_client):
        self.client = supabase_client
        self.metrics_table = "system_metrics"
        
    async def verify_metrics_collection(self):
        """メトリクス収集検証"""
        
        verification_results = {
            "timestamp": datetime.now().isoformat(),
            "collection_status": {},
            "data_quality": {},
            "recommendations": []
        }
        
        # 1. メトリクステーブル存在確認
        try:
            table_check = await self.client.table(self.metrics_table)\
                .select('*')\
                .limit(1)\
                .execute()
                
            verification_results["collection_status"]["table_exists"] = True
            
        except Exception as e:
            verification_results["collection_status"]["table_exists"] = False
            verification_results["recommendations"].append(
                "メトリクステーブルが存在しません。作成してください。"
            )
            return verification_results
        
        # 2. 最新データ確認
        recent_data = await self.client.table(self.metrics_table)\
            .select('*')\
            .gte('collected_at', (datetime.now() - timedelta(hours=1)).isoformat())\
            .execute()
            
        if not recent_data.data:
            verification_results["data_quality"]["recent_data"] = False
            verification_results["recommendations"].append(
                "過去1時間のメトリクスデータが見つかりません"
            )
        else:
            verification_results["data_quality"]["recent_data"] = True
            verification_results["data_quality"]["record_count"] = len(recent_data.data)
        
        # 3. データ完全性チェック
        required_fields = ['cpu_usage', 'memory_usage', 'response_time', 'error_rate']
        incomplete_records = []
        
        for record in recent_data.data[:10]:  # 最新10件をチェック
            missing_fields = [field for field in required_fields if not record.get(field)]
            if missing_fields:
                incomplete_records.append({
                    "record_id": record.get('id'),
                    "missing_fields": missing_fields
                })
        
        if incomplete_records:
            verification_results["data_quality"]["incomplete_records"] = incomplete_records
            verification_results["recommendations"].append(
                "データフィールドが不完全なレコードがあります"
            )
        
        return verification_results
    
    async def repair_metrics_collection(self):
        """メトリクス収集修復"""
        
        repair_actions = []
        
        # 1. メトリクステーブル再作成
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS system_metrics (
            id SERIAL PRIMARY KEY,
            collected_at TIMESTAMPTZ DEFAULT NOW(),
            cpu_usage FLOAT,
            memory_usage FLOAT,
            disk_usage FLOAT,
            response_time FLOAT,
            error_rate FLOAT,
            active_connections INTEGER,
            query_performance JSONB
        );
        """
        
        try:
            await self.client.rpc('execute_sql', {'query': create_table_sql}).execute()
            repair_actions.append("メトリクステーブル作成完了")
        except Exception as e:
            repair_actions.append(f"テーブル作成エラー: {e}")
        
        # 2. インデックス作成
        index_sql = """
        CREATE INDEX IF NOT EXISTS idx_metrics_collected_at 
        ON system_metrics(collected_at);
        """
        
        try:
            await self.client.rpc('execute_sql', {'query': index_sql}).execute()
            repair_actions.append("インデックス作成完了")
        except Exception as e:
            repair_actions.append(f"インデックス作成エラー: {e}")
        
        return repair_actions
```

#### 問題4: スケーリング問題

**症状**:
- 負荷増加時のパフォーマンス低下
- 接続プール枯渇
- メモリ不足

**自動スケーリング監視**:
```python
class AutoScalingMonitor:
    def __init__(self, supabase_client):
        self.client = supabase_client
        self.thresholds = {
            "cpu_threshold": 80.0,
            "memory_threshold": 85.0,
            "connection_threshold": 90.0,
            "response_time_threshold": 1000.0  # ms
        }
    
    async def monitor_scaling_triggers(self):
        """スケーリングトリガー監視"""
        
        # 現在のメトリクス取得
        current_metrics = await self._get_current_metrics()
        
        scaling_recommendations = []
        
        # CPU使用率チェック
        if current_metrics['cpu_usage'] > self.thresholds['cpu_threshold']:
            scaling_recommendations.append({
                "metric": "CPU",
                "current": current_metrics['cpu_usage'],
                "threshold": self.thresholds['cpu_threshold'],
                "action": "compute_scaling_up",
                "priority": "high"
            })
        
        # メモリ使用率チェック
        if current_metrics['memory_usage'] > self.thresholds['memory_threshold']:
            scaling_recommendations.append({
                "metric": "Memory",
                "current": current_metrics['memory_usage'], 
                "threshold": self.thresholds['memory_threshold'],
                "action": "memory_scaling_up",
                "priority": "high"
            })
        
        # 接続数チェック
        connection_usage = (current_metrics['active_connections'] / 
                          current_metrics['max_connections']) * 100
        
        if connection_usage > self.thresholds['connection_threshold']:
            scaling_recommendations.append({
                "metric": "Connections",
                "current": connection_usage,
                "threshold": self.thresholds['connection_threshold'], 
                "action": "connection_pool_scaling",
                "priority": "critical"
            })
        
        return {
            "timestamp": datetime.now().isoformat(),
            "current_metrics": current_metrics,
            "scaling_needed": len(scaling_recommendations) > 0,
            "recommendations": scaling_recommendations
        }
    
    async def _get_current_metrics(self):
        """現在のシステムメトリクス取得"""
        
        metrics_query = """
        SELECT 
            -- CPU メトリクス（PostgreSQL統計から推定）
            (SELECT ROUND(
                (sum(total_time) / sum(calls)) * 100 / 1000, 2
            ) FROM pg_stat_statements) as cpu_usage,
            
            -- メモリ使用率
            (SELECT ROUND(
                (sum(shared_blks_hit) + sum(shared_blks_read)) * 8192.0 / 
                (1024*1024*1024), 2
            ) FROM pg_stat_database) as memory_usage_gb,
            
            -- 接続数
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
            (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
            
            -- 平均レスポンス時間
            (SELECT ROUND(avg(mean_time), 2) FROM pg_stat_statements) as avg_response_time
        """
        
        result = await self.client.rpc('execute_sql', {'query': metrics_query}).execute()
        
        if result.data:
            return result.data[0]
        else:
            return {
                "cpu_usage": 0,
                "memory_usage": 0, 
                "active_connections": 0,
                "max_connections": 100,
                "avg_response_time": 0
            }
```

### 緊急対応手順

#### システム障害時の緊急対応

```python
class EmergencyResponse:
    def __init__(self, supabase_client):
        self.client = supabase_client
        
    async def execute_emergency_procedures(self, incident_type):
        """緊急対応手順実行"""
        
        procedures = {
            "database_deadlock": self._handle_database_deadlock,
            "connection_exhaustion": self._handle_connection_exhaustion,
            "memory_leak": self._handle_memory_leak,
            "performance_degradation": self._handle_performance_degradation
        }
        
        if incident_type in procedures:
            return await procedures[incident_type]()
        else:
            return {"error": f"Unknown incident type: {incident_type}"}
    
    async def _handle_database_deadlock(self):
        """デッドロック対応"""
        
        # 1. アクティブなクエリ確認
        active_queries = """
        SELECT 
            pid,
            usename,
            application_name,
            state,
            query_start,
            query
        FROM pg_stat_activity 
        WHERE state = 'active'
        AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY query_start;
        """
        
        result = await self.client.rpc('execute_sql', {'query': active_queries}).execute()
        
        # 2. 長時間実行クエリの特定
        long_queries = [
            query for query in result.data 
            if (datetime.now() - datetime.fromisoformat(query['query_start'].replace('Z', '+00:00'))).seconds > 300
        ]
        
        # 3. 必要に応じてクエリ終了
        killed_queries = []
        for query in long_queries:
            try:
                kill_query = f"SELECT pg_terminate_backend({query['pid']});"
                await self.client.rpc('execute_sql', {'query': kill_query}).execute()
                killed_queries.append(query['pid'])
            except Exception as e:
                print(f"Failed to kill query {query['pid']}: {e}")
        
        return {
            "incident": "database_deadlock",
            "active_queries": len(result.data),
            "long_queries_found": len(long_queries),
            "queries_terminated": killed_queries
        }
    
    async def _handle_connection_exhaustion(self):
        """接続枯渇対応"""
        
        # 1. アイドル接続の終了
        idle_connections_query = """
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity 
        WHERE state = 'idle'
        AND state_change < now() - interval '5 minutes'
        AND usename != 'postgres';
        """
        
        await self.client.rpc('execute_sql', {'query': idle_connections_query}).execute()
        
        # 2. 接続プール設定確認
        pool_settings = """
        SELECT name, setting, unit, context 
        FROM pg_settings 
        WHERE name IN ('max_connections', 'shared_buffers', 'work_mem');
        """
        
        settings_result = await self.client.rpc('execute_sql', {'query': pool_settings}).execute()
        
        return {
            "incident": "connection_exhaustion",
            "idle_connections_terminated": True,
            "current_settings": settings_result.data
        }
```

---

## まとめ

第8章では、Supabaseアプリケーションの包括的な運用自動化を実装しました。

**実装した自動化機能**:

- **CI/CD**: 高度なGitHub Actions、セキュリティスキャン、段階的デプロイ
- **マイグレーション**: 自動マイグレーション管理、ロールバック機能
- **バックアップ**: 自動バックアップ、災害復旧計画
- **監視**: リアルタイム監視、アラート、メトリクス収集

**運用自動化の利点**:

- **信頼性向上**: 人為的ミスの削減、一貫性のある運用
- **効率性**: 手動作業の削減、迅速な問題検知と対応
- **スケーラビリティ**: 自動スケーリング、適応的リソース管理
- **可視性**: 包括的監視、詳細なメトリクス

### 次章予告

第9章では、実践演習として、これまで学習した3つのアーキテクチャパターンの選択判断演習と、実際のプロジェクト要件に基づく設計演習を行います。
