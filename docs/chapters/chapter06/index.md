---
layout: book
order: 11
title: "第6章：パフォーマンス最適化"
---
# 第6章：パフォーマンス最適化

---
**目次に戻る**: [はじめに]({{ '/introduction/' | relative_url }})
**前の章**: [第5-4章：RAG/ベクトル検索アーキテクチャ]({{ '/chapters/chapter05-4/' | relative_url }})
**次の章**: [第7章：セキュリティ強化]({{ '/chapters/chapter07/' | relative_url }})
**学習フェーズ**: Part III - 実装・運用編（パフォーマンス）
**学習レベル**:  基礎 |  応用 |  発展
**推定学習時間**: 5〜7時間
**難易度**: 中上級（SQL 最適化・システム監視知識推奨）
---

## この章で扱う構成
- 構成: 共通（パフォーマンス最適化）
- 推奨用途: レスポンス改善・コスト最適化が必要な段階
- 非推奨用途: PoC段階で速度要件が低いケース

## この章で学ぶこと（初心者向け）

この章では、第5-1章で作ったSaaSプラットフォームを、**「F1カーのように高速で効率的」**なシステムに改善します。

- **初心者**: データベースが重い理由と、インデックスによる高速化がわかる
- **中級者**: システム全体のボトルネック特定と最適化手法が身につく
- **上級者**: 自動監視・自動最適化システムの構築ができるようになる

## まずは身近な例から：「超繁盛レストランの効率化作戦」

想像してみてください。あなたのレストランが大成功して、毎日長蛇の列ができるようになりました：

```text
 繁盛レストラン「Supabase 亭」の1日
├──  朝：お客さん少ない → サクサク対応（1秒で注文完了）
├──  昼：大行列発生 → 注文に5分かかる（お客さん怒る）
├──  夕方：更にパンク → 10分待ち（お客さん帰る）
└──  結果：売上激減、スタッフ疲弊、評判悪化
```

### なぜ遅くなるのか？

| 問題 | 具体例 | 技術的な対応 |
|:-----|:-------|:-------------|
|  **メニュー探しが遅い**| 200品目から「ハンバーグ」を探すのに時間がかかる | データベースインデックス不足 |
|  **コックが1人だけ**| 注文が増えても調理人が足りない | データベース接続数不足 |
|  **食材倉庫が遠い**| 毎回倉庫まで取りに行く | キャッシュ未使用 |
|  **何が遅いか不明**| どの工程がボトルネックか分からない | 監視システム不足 |

### パフォーマンス最適化で解決！

```mermaid
flowchart TD
    A[ 遅いシステム] --> B[ 問題調査]
    B --> C[ インデックス追加]
    B --> D[ キャッシュ導入]
    B --> E[ 接続数増加]
    B --> F[ 監視システム]

    C --> G[ 高速システム]
    D --> G
    E --> G
    F --> G

    G --> H[ お客さん満足]
    G --> I[ 売上向上]
    G --> J[ 運用楽々]
```

**この章で実装する最適化**：
- **データベース高速化**: インデックス・パーティション（メニューの整理整頓）
- **キャッシュシステム**: よく注文される料理を事前準備
- **PostgREST 最適化**: API を効率化（注文受付の改善）
- **監視システム**: リアルタイムでボトルネック発見
- **自動最適化**: 問題を自動で解決する仕組み

## 学習目標

- PostgreSQL クエリ最適化とインデックス戦略の習得
- PostgREST パフォーマンスチューニング手法の理解
- フロントエンド最適化とキャッシュ戦略の実装
- ボトルネック特定と測定手法の実践

---

## Step 1: PostgreSQL 調整（データベースの高速化）

### インデックス設計戦略（図書館の目次システム）

データベースのインデックスは、**図書館の目次や索引**のようなものです。目次なしで本を探すのは大変ですが、目次があれば一瞬で見つかります：

```text
 図書館での本探し比較
├── [NG] 目次なし：全部の本を1冊ずつ確認（1時間かかる）
└── [OK] 目次あり：目次で番号確認→直接取得（30秒で完了）

 データベースでのデータ検索比較
├── [NG] インデックスなし：全レコードをスキャン（10秒かかる）
└── [OK] インデックスあり：インデックスで場所特定（0.01秒で完了）
```

### 実際のインデックス効果を確認してみよう

まず、現在のデータベースでどのインデックスが使われているかを調べる「健康診断」をしてみましょう：

```sql
-- インデックス効果分析クエリ（図書館の目次使用統計）
--  このクエリは「どの目次がよく使われているか」を調べる健康診断です

WITH index_usage AS (
    SELECT
        schemaname,                           -- スキーマ名（図書館の棟名）
        tablename,                            -- テーブル名（本棚の名前）
        indexname,                            -- インデックス名（目次の名前）
        idx_scan,                             -- インデックス使用回数（目次が使われた回数）
        idx_tup_read,                         -- 読み取りレコード数
        idx_tup_fetch,                        -- 取得レコード数
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,  -- インデックスサイズ（目次の厚さ）
        pg_relation_size(indexrelid) as index_size_bytes            -- バイト単位サイズ
    FROM pg_stat_user_indexes
),
table_stats AS (
    SELECT
        schemaname,
        tablename,
        n_tup_ins + n_tup_upd + n_tup_del as total_writes,          -- 書き込み操作総数
        seq_scan,                             -- フルスキャン回数（目次なしで全部調べた回数）
        seq_tup_read,                         -- フルスキャンで読んだレコード数
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size  -- テーブルサイズ
    FROM pg_stat_user_tables
)
SELECT
    i.schemaname,
    i.tablename,
    i.indexname,
    i.idx_scan as index_scans,                -- インデックス使用回数
    CASE
        WHEN i.idx_scan = 0 THEN 'UNUSED'           -- [CRITICAL] 未使用（作ったけど誰も使わない目次）
        WHEN i.idx_scan < t.total_writes * 0.01 THEN 'RARELY_USED'  -- [WARN]  ほとんど使われない
        WHEN i.idx_scan > t.seq_scan THEN 'EFFICIENT'               -- [OK] 効率的（よく使われる）
        ELSE 'MODERATE'                              --  普通
    END as efficiency,
    i.index_size,                             -- インデックスのサイズ
    t.table_size,                             -- テーブルのサイズ
    t.seq_scan as table_scans                 -- フルスキャン回数（遅い検索の回数）
FROM index_usage i
JOIN table_stats t ON i.schemaname = t.schemaname AND i.tablename = t.tablename
ORDER BY i.index_size_bytes DESC;            -- サイズの大きい順（容量を食う目次順）

```

**初心者向け解説**：

| 項目 | 何をしているか | 身近な例 |
|:-----|:-------------|:---------|
| `idx_scan` | インデックスが使われた回数 | 目次を使って本を探した回数 |
| `seq_scan` | 全件検索した回数 | 目次を使わず全部の本を確認した回数 |
| `UNUSED` | 作ったけど使われていないインデックス | 作ったけど誰も使わない目次 |
| `EFFICIENT` | よく使われて効果的なインデックス | みんながよく使う便利な目次 |
| `index_size` | インデックスが占める容量 | 目次が占める本棚のスペース |

---

### 高度なインデックス設計戦略

レストランのメニュー作りのように、お客さんがよく注文する料理を考えてインデックスを作りましょう：

```sql
--  Step 1: 複合インデックス（よく一緒に検索される項目をまとめた目次）
-- 「ステータスが未完了で、優先度が高くて、期限が近いタスク」をよく検索する場合

CREATE INDEX CONCURRENTLY idx_tasks_status_priority_due
ON tasks (status, priority, due_date)           -- 3つの条件を組み合わせた目次
WHERE status IN ('todo', 'in_progress');        -- 未完了のタスクだけに限定（部分インデックス）

--  なぜこの順番？
-- 1. status: 一番絞り込み効果が高い（完了/未完了で大きく分かれる）
-- 2. priority: 次に絞り込み効果が高い（高/中/低で分かれる）
-- 3. due_date: 範囲検索でよく使われる（○月○日以降など）

--  Step 2: 部分インデックス（条件付きの目次）
-- 「アクティブで認証済みユーザーのメール検索」だけに特化した目次

CREATE INDEX CONCURRENTLY idx_users_active_email
ON users (email)
WHERE is_active = true AND is_verified = true;  -- この条件のユーザーだけインデックス化

--  メリット: 全ユーザーではなく、実際に使われるユーザーだけなのでサイズ小、速度UP

--  Step 3: 関数インデックス（計算結果の目次）
-- メールアドレスの大文字小文字を無視した検索用

CREATE INDEX CONCURRENTLY idx_users_email_lower
ON users (LOWER(email));                        -- 小文字に変換した結果でインデックス

--  使用例: WHERE LOWER(email) = LOWER('USER@EXAMPLE.COM') が高速化

--  Step 4: GINインデックス（配列・JSON 検索用の特殊目次）
-- タスクのタグ配列から特定のタグを高速検索

CREATE INDEX CONCURRENTLY idx_tasks_tags_gin
ON tasks USING gin(tags);                       -- 配列の中身を検索するための特殊インデックス

--  使用例: WHERE tags @> ARRAY['urgent', 'bug'] （urgentとbugタグの両方があるタスク）

--  プロジェクト設定の JSON 内検索用
CREATE INDEX CONCURRENTLY idx_projects_settings_gin
ON projects USING gin(settings);                -- JSON 内のキーと値を検索するための特殊インデックス

--  使用例: WHERE settings @> '{"notification": true}' （通知がONのプロジェクト）

--  Step 5: 範囲検索最適化用インデックス（時系列データ用）
-- 監査ログの日付範囲検索を高速化（BRIN = Block Range Index）

CREATE INDEX CONCURRENTLY idx_audit_logs_created_at_brin
ON audit_logs USING brin(created_at);           -- 時系列データに特化した軽量インデックス

--  特徴: 一般的なインデックスより100倍小さいが、範囲検索では十分高速

--  Step 6: カバリングインデックス（必要なデータも一緒に保存）
-- 組織IDとステータスで検索して、名前や日付も一緒に取得する場合

CREATE INDEX CONCURRENTLY idx_projects_org_status_include
ON projects (organization_id, status)           -- 検索キー
INCLUDE (name, created_at, updated_at);         -- 一緒に保存するデータ

--  メリット: テーブル本体を見に行かずに、インデックスだけで全データ取得可能
```

**初心者向け解説**：

| インデックス種類 | 何をしているか | 身近な例 | いつ使う？ |
|:---------------|:-------------|:---------|---------:|
| `複合インデックス` | 複数条件の組み合わせ検索を高速化 | 「料理名+価格帯+アレルギー対応」の3段階目次 | よく組み合わせる検索条件がある |
| `部分インデックス` | 条件に合うデータだけの目次 | 「現在販売中の商品だけ」の目次 | 一部のデータしか検索しない |
| `関数インデックス` | 計算結果での検索を高速化 | 「商品名を全部ひらがなにした」目次 | 大文字小文字無視や計算結果で検索 |
| `GINインデックス` | 配列や JSON の中身検索を高速化 | 「タグや属性での検索」専用目次 | 配列や JSON データを検索 |
| `BRINインデックス` | 時系列データの範囲検索を軽量で高速化 | 「日付順に並んだ伝票」の簡易目次 | 日付や数値の範囲検索 |
| `カバリングインデックス` | 検索+必要データを一緒に保存 | 「住所検索+電話番号も一緒に書いた」電話帳 | 検索後によく使うデータがある |

---

### パーティショニング実装（大きな本棚の整理整頓）

パーティショニングは、**「大きすぎる本棚を年代別に分ける」**ようなものです。1つの巨大な本棚より、年代別に分けた方が目的の本を早く見つけられます：

```text
 図書館の本棚整理
├── [NG] 1つの巨大本棚：全部で10万冊 → 探すのに30分
└── [OK] 年代別本棚：2020年代、2010年代... → 探すのに3分

 データベーステーブルの整理
├── [NG] 1つの巨大テーブル：全部で1000万レコード → クエリに10秒
└── [OK] 月別テーブル：2024年1月、2024年2月... → クエリに1秒
```

### 実際のパーティション実装を見てみよう

監査ログのような**日付データが重要なテーブル**を月別に分割してみましょう：

```sql
--  時系列データのパーティショニング（月別の帳簿作成）
-- Step 1: 既存テーブルをパーティションテーブルに変換

BEGIN;  -- トランザクション開始（作業中にエラーが起きても安全）

--  新しいパーティションテーブル作成（月別に分ける本棚の設計図）
CREATE TABLE audit_logs_partitioned (
    LIKE audit_logs INCLUDING ALL               -- 元のテーブルと同じ構造をコピー
) PARTITION BY RANGE (created_at);              -- created_at（作成日時）で範囲分割

--  既存データ移行用の一時的なパーティション（古いデータ用の本棚）
CREATE TABLE audit_logs_legacy
PARTITION OF audit_logs_partitioned             -- audit_logs_partitioned の一部として作成
FOR VALUES FROM (MINVALUE) TO ('2024-01-01');  -- 2024年1月1日より前の全データ用

--  月次パーティション作成関数（自動で月別本棚を作る機能）
CREATE OR REPLACE FUNCTION create_monthly_partition(
    table_name text,    -- パーティション対象テーブル名
    start_date date     -- パーティション開始日
) RETURNS void AS $$
DECLARE
    partition_name text;  -- 作成するパーティション名
    end_date date;        -- パーティション終了日
BEGIN
    --  パーティション名を生成（例: audit_logs_partitioned_y2024_m03）
    partition_name := table_name || '_y' || EXTRACT(year FROM start_date) ||
                     '_m' || LPAD(EXTRACT(month FROM start_date)::text, 2, '0');

    --  終了日を計算（翌月の1日）
    end_date := start_date + INTERVAL '1 month';

    --  パーティションテーブルを作成
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I
        PARTITION OF %I
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date
    );

    --  パーティション固有のインデックス作成（各月の本棚用の目次）

    -- ユーザーIDとアクション種別での検索用インデックス
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I
        ON %I (user_id, action)',
        partition_name || '_user_action_idx', partition_name
    );

    -- 組織IDと作成日時での検索用インデックス
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I
        ON %I (organization_id, created_at)',
        partition_name || '_org_time_idx', partition_name
    );

    --  作成完了をログ出力
    RAISE NOTICE 'Created partition: % for range % to %', partition_name, start_date, end_date;
END;
$$ LANGUAGE plpgsql;

--  過去6ヶ月〜未来12ヶ月のパーティション一括作成（18個の月別本棚を作成）
SELECT create_monthly_partition(
    'audit_logs_partitioned',
    date_trunc('month', CURRENT_DATE - INTERVAL '6 months' + INTERVAL '1 month' * generate_series(0, 18))
);

COMMIT;  -- トランザクション確定（すべての作業を保存）

--  パーティション自動メンテナンス機能（本棚の自動管理システム）
CREATE OR REPLACE FUNCTION maintain_partitions()
RETURNS void AS $$
DECLARE
    next_month date;
    tables_to_partition text[] := ARRAY['audit_logs_partitioned', 'metrics_partitioned'];  -- 管理対象テーブル
    table_name text;
    old_table_name text;
BEGIN
    --  2ヶ月先のパーティションを作成（事前準備）
    next_month := date_trunc('month', CURRENT_DATE + INTERVAL '2 months');

    --  各テーブルに対してパーティション作成
    FOREACH table_name IN ARRAY tables_to_partition
    LOOP
        PERFORM create_monthly_partition(table_name, next_month);
        RAISE NOTICE '次月パーティション作成: % for %', table_name, next_month;
    END LOOP;

    --  古いパーティション削除（12ヶ月より古い本棚を処分）
    FOR old_table_name IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename ~ '^(audit_logs|metrics)_partitioned_y\d{4}_m\d{2}$'  -- パターンマッチ
        AND tablename < 'audit_logs_partitioned_y' ||
                       EXTRACT(year FROM CURRENT_DATE - INTERVAL '12 months') ||
                       '_m' || LPAD(EXTRACT(month FROM CURRENT_DATE - INTERVAL '12 months')::text, 2, '0')
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I', old_table_name);
        RAISE NOTICE '古いパーティション削除: %', old_table_name;
    END LOOP;

    --  現在のパーティション状況をレポート
    RAISE NOTICE 'パーティションメンテナンス完了 at %', CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

--  定期実行スケジュール設定（毎月1日午前2時に自動実行）
-- ※ pg_cron 拡張機能が必要
-- SELECT cron.schedule('partition-maintenance', '0 2 1 * *', 'SELECT maintain_partitions();');
```

**初心者向け解説**：

| 概念 | 何をしているか | 身近な例 |
|:-----|:-------------|:---------|
| `PARTITION BY RANGE` | 日付の範囲でテーブルを分割 | 年代別に本棚を分ける |
| `create_monthly_partition()` | 月別のパーティションを自動作成 | 「2024年3月用の本棚」を自動で作る機能 |
| `MINVALUE TO '2024-01-01'` | 指定日より前の全データ | 「2024年より前の全ての本」用の本棚 |
| `maintain_partitions()` | 定期的にパーティションを管理 | 「新しい本棚作成・古い本棚処分」を自動化 |
| `pg_cron` | 定期実行スケジューラー | 「毎月決まった日に自動でお掃除」システム |

### パーティション作成後の効果測定

パーティションを作った後は、本当に速くなったかを確認しましょう：

```sql
--  パーティション効果の確認クエリ

-- 1 特定期間のデータ検索（1ヶ月分のみアクセス）
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id, action, created_at
FROM audit_logs_partitioned
WHERE created_at >= '2024-03-01'
  AND created_at < '2024-04-01';

-- 結果例：
-- Seq Scan on audit_logs_partitioned_y2024_m03  (cost=0.00..1000.00 rows=5000 width=50) (actual time=0.123..5.678 rows=4856 loops=1)
--  1つのパーティションだけアクセス → 高速！

-- 2 パーティション除外の効果確認（Partition Pruning）
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM audit_logs_partitioned
WHERE created_at >= '2024-03-15';

-- 結果例：
-- Aggregate  (cost=2000.00..2000.01 rows=1 width=8) (actual time=10.234..10.235 rows=1 loops=1)
--   ->  Append  (cost=0.00..1800.00 rows=8000 width=0) (actual time=0.456..8.901 rows=7823 loops=1)
--         ->  Seq Scan on audit_logs_partitioned_y2024_m03  [...]
--         ->  Seq Scan on audit_logs_partitioned_y2024_m04  [...]
--  2024年3月15日以降なので、3月・4月のパーティションのみアクセス！

-- 3 パーティション情報の確認
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'audit_logs_partitioned%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 結果例：
--  schemaname |           tablename            |  size
-- ------------+--------------------------------+--------
--  public     | audit_logs_partitioned_y2024_m03 | 156 MB
--  public     | audit_logs_partitioned_y2024_m02 | 142 MB
--  public     | audit_logs_partitioned_y2024_m01 | 138 MB
--  各月のデータサイズが確認できる
```

### クエリプラン最適化（データベースの頭脳を賢くする）

データベースの「頭脳」であるクエリプランナーを賢くして、最適な検索ルートを選ばせる方法を学びましょう：

```text
 道案内システムの比較
├── [NG] 古い地図：渋滞情報なし → 遠回りルート選択（30分かかる）
└── [OK] 最新地図：リアルタイム交通情報 → 最短ルート選択（15分で到着）

 データベースプランナーの比較
├── [NG] 古い統計情報：データ分布不明 → 遅いプラン選択（10秒かかる）
└── [OK] 最新統計情報：正確なデータ分布 → 最速プラン選択（0.1秒で完了）
```

### 統計情報の更新と最適化

データベースに「最新の地図情報」を教えてあげましょう：

```sql
--  全テーブルの統計情報更新（全体の交通情報更新）
ANALYZE;  -- 全テーブルのデータ分布を再調査

--  個別テーブルの詳細統計情報更新（特定路線の詳細調査）
ANALYZE VERBOSE users;      -- ユーザーテーブルを詳細分析（進捗表示あり）
ANALYZE VERBOSE tasks;      -- タスクテーブルを詳細分析
ANALYZE VERBOSE projects;   -- プロジェクトテーブルを詳細分析

-- 実行結果例：
-- INFO:  analyzing "public.users"
-- INFO:  "users": scanned 1000 of 1000 pages, containing 25000 live rows and 0 dead rows
--  25,000行のユーザーデータを分析完了

--  複雑なカラムの統計情報強化（より詳細な地図作成）
-- JSON 配列やテキスト配列など、複雑なデータ型の統計精度を向上

ALTER TABLE tasks ALTER COLUMN tags SET STATISTICS 1000;       -- タグ配列の統計サンプル数を1000に増加
ALTER TABLE projects ALTER COLUMN settings SET STATISTICS 1000; -- 設定 JSON の統計サンプル数を1000に増加

--  デフォルトは100サンプル、1000にすることで10倍詳細な統計情報を取得

--  統計情報の確認
SELECT
    tablename,
    attname as column_name,
    n_distinct,        -- 重複除いた値の種類数
    correlation,       -- データの並び順の相関性
    most_common_vals,  -- 最頻出値
    most_common_freqs  -- 最頻出値の出現率
FROM pg_stats
WHERE tablename IN ('users', 'tasks', 'projects')
AND attname IN ('status', 'priority', 'tags');

-- 結果例：
-- tablename | column_name | n_distinct | correlation | most_common_vals    | most_common_freqs
-- ----------+-------------+------------+-------------+---------------------+------------------
-- tasks     | status      |         4  |       0.1   | {todo,in_progress}  | {0.4,0.35}
-- tasks     | priority    |         3  |      -0.05  | {high,medium,low}   | {0.3,0.5,0.2}
--  ステータスは4種類、todoが40%、in_progressが35%など詳細分布が分かる

--  実行計画キャッシュのリセット（古い計画情報をクリア）
SELECT pg_stat_reset_shared('bgwriter');  -- 共有統計情報リセット
SELECT pg_stat_reset();                   -- ユーザー統計情報リセット

--  新しい統計情報で実行計画を再作成させるため

--  遅いクエリの監視設定（問題のあるクエリを自動検出）
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1秒以上かかるクエリをログ記録
ALTER SYSTEM SET log_statement = 'mod';             -- 修更系クエリ（INSERT/UPDATE/DELETE）をログ記録
ALTER SYSTEM SET log_lock_waits = on;             -- ロック待ちをログ記録
ALTER SYSTEM SET log_checkpoints = on;           -- チェックポイント処理をログ記録
SELECT pg_reload_conf();                         -- 設定を即座に反映

--  これで遅いクエリを自動で発見できる！ログファイルをチェックしよう
```

**初心者向け解説**：

| 概念 | 何をしているか | 身近な例 |
|:-----|:-------------|:---------|
| `ANALYZE` | データ分布を調査して統計情報更新 | カーナビの交通情報を最新にする |
| `STATISTICS 1000` | より詳細な統計情報を取得 | 道路の交通量を100回ではなく1000回測定 |
| `pg_stats` | データベースの統計情報確認 | 「この道路は平日朝が混む」等の分析結果 |
| `log_min_duration_statement` | 遅いクエリを自動検出 | 「30分以上かかった配達を記録」 |
| `pg_stat_reset()` | 統計情報をリセット | 古い交通情報をクリアして新しく計測開始 |

---

### バキュームとメンテナンス戦略（データベースのお掃除システム）

データベースは使っているうちに「ゴミ」がたまります。定期的にお掃除して、常に快適な状態を保ちましょう：

```text
 部屋の掃除と同じ
├──  不要な物が増える → 部屋が狭くなる → 物を探すのに時間がかかる
├──  定期的に掃除 → スペース確保 → 物をすぐ見つけられる
└──  片付けルール作成 → 自動で整理整頓

 データベースのメンテナンス
├──  削除データの残骸 → テーブルが肥大化 → クエリが遅くなる
├──  VACUUM実行 → 不要領域回収 → クエリが高速化
└──  自動バキューム → 定期的に自動お掃除
```

### スマートバキューム実装

必要な時に必要な分だけお掃除する「効率的なお掃除システム」を作りましょう：

```sql
--  カスタムバキューム戦略（賢いお掃除ロボット）
CREATE OR REPLACE FUNCTION smart_vacuum_analyze()
RETURNS void AS $$
DECLARE
    r record;
    vacuum_cmd text;
BEGIN
    --  お掃除が必要なテーブルを特定（汚れが目立つ部屋を探す）
    FOR r IN
        SELECT
            schemaname,
            tablename,
            n_tup_ins + n_tup_upd + n_tup_del as total_changes,  -- 操作回数（使用頻度）
            n_dead_tup,                                          -- 不要データ数（ゴミの数）
            n_live_tup,                                          -- 有効データ数（まだ使う物の数）
            pg_total_relation_size(schemaname||'.'||tablename) as table_size  -- テーブルサイズ
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000                                  -- ゴミが1000個以上 OR
        OR (n_dead_tup::float / GREATEST(n_live_tup, 1) > 0.1   -- ゴミの割合が10%以上
            AND n_dead_tup > 100)                                -- かつゴミが100個以上
        ORDER BY n_dead_tup DESC                                -- ゴミの多い順
    LOOP
        --  部屋の大きさに応じて掃除方法を変更
        IF r.table_size > 1024*1024*1024 THEN                   -- 1GB以上の大きなテーブル
            -- 並行バキューム（複数人で一緒にお掃除）
            vacuum_cmd := format('VACUUM (PARALLEL 4) %I.%I', r.schemaname, r.tablename);
            RAISE NOTICE ' 大きなテーブル並行バキューム: % (サイズ: %)',
                        r.tablename, pg_size_pretty(r.table_size);
        ELSE
            -- 通常バキューム + 統計更新（一人でお掃除 + 整理整頓）
            vacuum_cmd := format('VACUUM ANALYZE %I.%I', r.schemaname, r.tablename);
            RAISE NOTICE ' 通常バキューム + 統計更新: % (ゴミ: %, 全体: %)',
                        r.tablename, r.n_dead_tup, r.n_live_tup + r.n_dead_tup;
        END IF;

        --  実行コマンドを表示
        RAISE NOTICE '実行中: %', vacuum_cmd;

        --  実行時間測定
        DECLARE
            start_time timestamp := clock_timestamp();
            end_time timestamp;
        BEGIN
            EXECUTE vacuum_cmd;
            end_time := clock_timestamp();
            RAISE NOTICE '[OK] 完了: % (所要時間: %)',
                        r.tablename, end_time - start_time;
        END;
    END LOOP;

    --  全体的なお掃除結果レポート
    RAISE NOTICE ' スマートバキューム完了 at %', clock_timestamp();
END;
$$ LANGUAGE plpgsql;

--  定期実行設定（毎日午前2時に自動お掃除）
-- ※ pg_cron 拡張機能が必要
-- SELECT cron.schedule('smart-vacuum', '0 2 * * *', 'SELECT smart_vacuum_analyze();');

--  バキューム効果の確認クエリ
CREATE OR REPLACE FUNCTION vacuum_report()
RETURNS TABLE(
    table_name text,
    live_tuples bigint,
    dead_tuples bigint,
    dead_ratio numeric,
    table_size text,
    last_vacuum timestamp,
    last_autovacuum timestamp
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pst.relname::text,
        pst.n_live_tup,
        pst.n_dead_tup,
        CASE
            WHEN pst.n_live_tup > 0 THEN
                round((pst.n_dead_tup::numeric / pst.n_live_tup * 100), 2)
            ELSE 0
        END as dead_ratio,
        pg_size_pretty(pg_total_relation_size(pst.relid)),
        pst.last_vacuum,
        pst.last_autovacuum
    FROM pg_stat_user_tables pst
    ORDER BY pst.n_dead_tup DESC;
END;
$$ LANGUAGE plpgsql;

-- 使用例：バキューム状況の確認
SELECT * FROM vacuum_report() WHERE dead_tuples > 100;
```

**初心者向け解説**：

| 概念 | 何をしているか | 身近な例 |
|:-----|:-------------|:---------|
| `n_dead_tup` | 削除されたが残っているデータの数 | 捨てたけどまだゴミ箱にある物 |
| `VACUUM` | 不要なデータを実際に削除してスペース回収 | ゴミ箱を空にして部屋を広くする |
| `PARALLEL 4` | 4つのプロセスで並行処理 | 4人で一緒にお掃除 |
| `dead_ratio` | 全体に対する不要データの割合 | 部屋全体の何%がゴミか |
| `pg_cron` | 定期実行スケジューラー | 「毎日朝2時に自動お掃除」の設定 |

---

## Step 2: PostgREST 設定最適化（API の高速化）

### PostgREST 設定チューニング（レストランの注文システム最適化）

PostgREST は、**「レストランの注文受付システム」**のようなものです。お客さんからの注文を効率よく処理できるように設定を最適化しましょう：

```text
 レストランの注文システム
├──  メニュー：何が注文できるか（API エンドポイント）
├──  ウェイター：注文を受ける人（PostgREST）
├──  コック：料理を作る人（PostgreSQL）
└──  配膳：出来た料理を届ける（レスポンス）

 最適化で実現すること
├──  メニューの読み込み高速化
├──  ウェイターの人数最適化（接続プール）
├──  よく注文される料理の事前準備（キャッシュ）
└──  大量注文時の効率的な処理
```

### 実際の設定ファイル最適化

レストランの効率を最大化する設定を見てみましょう：

```toml
# postgrest.conf（レストラン運営設定書）

#  データベース接続設定（厨房との連携設定）
db-uri = "postgresql://authenticator:password@localhost:5432/app_db"  # 厨房への接続情報
db-schemas = "api"                    # 公開するメニュー範囲（apiスキーマのみ）
db-anon-role = "web_anon"            # 匿名ユーザーの基本権限（一見さんの権限）
db-pool = 20                         # 厨房への同時接続数（コックさんとの連絡チャンネル数）
db-pool-timeout = 10                 # 接続待ち時間（コックが忙しい時の最大待ち時間：10秒）
db-use-legacy-gucs = false           # 新機能を有効化（最新の効率化機能を使用）

#  パフォーマンス設定（注文処理の効率化）
max-rows = 1000                      # 1回の注文で返す最大データ数（大盛りの上限）
db-plan-enabled = true               # クエリ実行計画の表示（料理手順の可視化）
db-prepared-statements = true        # プリペアドステートメント使用（よく使うレシピの事前準備）

#  キャッシュ設定（メニューの事前準備）
db-config = true                     # データベース設定のキャッシュ（レストラン設定の記憶）
db-root-spec = true                  # API スキーマ情報のキャッシュ（メニュー表の記憶）

#  セキュリティ設定（お客さん認証）
jwt-secret = "@JWT_SECRET@"          # JWT 署名用秘密鍵（お客さん確認用の印鑑）
jwt-aud = "your-audience"            # JWT オーディエンス（このレストランの来店者であることを確認）

#  ログ設定（注文記録レベル）
log-level = "info"                   # 情報レベルのログ（注文状況を記録）

#  追加の高速化設定
db-tx-end = "commit"                 # トランザクション終了方法（注文確定方法）
db-tx-rollback-all = false           # エラー時の巻き戻し範囲
server-host = "0.0.0.0"              # 受付 IP（どこからでも注文可能）
server-port = 3000                   # 受付ポート（注文受付窓口番号）

#  タイムアウト設定
db-channel-enabled = false           # リアルタイム通知（厨房からの料理完成お知らせ）
```

**初心者向け解説**：

| 設定項目 | 何をしているか | 身近な例 | 推奨値 |
|:---------|:-------------|:---------|---------:|
| `db-pool = 20` | データベースとの同時接続数 | コックさんとの連絡チャンネル数 | 10-50 |
| `max-rows = 1000` | 1回のレスポンスの最大件数 | 一度に出せる料理の皿数上限 | 100-1000 |
| `db-prepared-statements = true` | よく使うクエリの事前準備 | 人気メニューのレシピを暗記 | true |
| `db-plan-enabled = true` | クエリ実行計画の表示 | 料理手順の説明表示 | true（開発時） |
| `log-level = "info"` | ログの詳細度 | 店舗日報の詳しさレベル | info/warn |

---

### 高速化クエリパターン（効率的な注文方法）

PostgREST での効率的な「注文の仕方」を学びましょう。適切な注文方法で、レストランの処理速度を大幅に向上させることができます：

```python
# app/utils/postgrest_optimization.py（注文最適化ヘルパー）
from typing import Dict, List, Any, Optional
import urllib.parse
from dataclasses import dataclass

@dataclass
class QueryPerformanceMetrics:
    """クエリパフォーマンス測定"""
    execution_time: float
    rows_returned: int
    bytes_transferred: int
    cache_hit: bool

class PostgRESTQueryOptimizer:
    """PostgREST クエリ最適化ヘルパー（スマート注文システム）"""

    @staticmethod
    def build_optimized_query(
        table: str,                              # テーブル名（メニューカテゴリ）
        select_fields: List[str] = None,         # 取得フィールド（欲しい料理の部分）
        filters: Dict[str, Any] = None,          # フィルター条件（注文の詳細指定）
        order_by: List[str] = None,              # ソート順（料理の並び順）
        limit: int = None,                       # 取得件数制限（注文数上限）
        offset: int = None,                      # 開始位置（何番目から注文するか）
        embedded_resources: Dict[str, Dict] = None,  # 関連データ（サイドメニューも一緒に）
        use_count: bool = False                  # 件数取得（全部で何皿あるか知りたい）
    ) -> str:
        """最適化されたPostgREST クエリ URL 生成（効率的な注文書作成）"""

        #  基本 URL 構築
        base_url = f"/{table}"
        query_params = []

        #  Step 1: 必要なフィールドのみ選択（欲しい部分だけ注文）
        if select_fields:
            #  良い例: select=id,name,email（必要な部分だけ）
            #  悪い例: select=*（全部盛り = 重い）
            select_str = ",".join(select_fields)
            query_params.append(f"select={select_str}")
            print(f"[OK] 効率的: 必要フィールドのみ選択 ({len(select_fields)}個)")
        else:
            print("[WARN] 注意: 全フィールド取得（*）は重くなる可能性があります")

        #  Step 2: フィルター条件の最適化
        if filters:
            for field, value in filters.items():
                if isinstance(value, list):
                    # 配列での絞り込み（複数の料理IDから選択）
                    values_str = ",".join(map(str, value))
                    query_params.append(f"{field}=in.({values_str})")
                    print(f" リスト検索: {field} in ({len(value)}件)")
                elif isinstance(value, dict):
                    # 範囲検索や複雑な条件
                    for operator, op_value in value.items():
                        query_params.append(f"{field}={operator}.{op_value}")
                        print(f" 条件検索: {field} {operator} {op_value}")
                else:
                    # 単純な等価検索
                    query_params.append(f"{field}=eq.{value}")
                    print(f" 等価検索: {field} = {value}")

        #  Step 3: ソート最適化（インデックスを活用）
        if order_by:
            # インデックスのある列での並び替えを推奨
            order_str = ",".join(order_by)
            query_params.append(f"order={order_str}")
            print(f" ソート: {order_str}")

        #  Step 4: ページネーション（大量データの分割取得）
        if limit:
            query_params.append(f"limit={limit}")
            if offset:
                query_params.append(f"offset={offset}")
            print(f" ページング: {limit}件ずつ（{offset or 0}番目から）")

        #  Step 5: 関連データの効率的取得（JOIN クエリの最適化）
        if embedded_resources:
            for resource, config in embedded_resources.items():
                embed_select = config.get('select', '*')
                embed_filters = config.get('filters', {})

                embed_query = f"{resource}({embed_select})"
                if embed_filters:
                    # 関連データにもフィルター適用
                    filter_parts = [f"{k}=eq.{v}" for k, v in embed_filters.items()]
                    embed_query = f"{resource}({embed_select})"

                # selectパラメータに埋め込み
                if 'select=' in query_params[0] if query_params else False:
                    query_params[0] += f",{embed_query}"
                else:
                    query_params.insert(0, f"select=*,{embed_query}")
                print(f" 関連データ取得: {resource}")

        #  Step 6: 件数取得の最適化
        if use_count:
            query_params.append("count=exact")
            print(" 件数取得: ON（少し重くなります）")

        #  最終 URL 生成
        if query_params:
            query_string = "&".join(query_params)
            final_url = f"{base_url}?{query_string}"
        else:
            final_url = base_url

        print(f" 生成されたクエリ URL: {final_url}")
        return final_url

    @staticmethod
    def optimize_bulk_operations(
        table: str,
        operation: str,
        data: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> List[str]:
        """一括操作の最適化（大量注文の効率化）"""

        print(f" 一括{operation}操作: {len(data)}件を{batch_size}件ずつ処理")

        urls = []

        # バッチ処理で分割（一度に大量処理すると重いので小分け）
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]

            if operation == "insert":
                # 一括挿入
                urls.append(f"/{table}")
                print(f" バッチ{i//batch_size + 1}: {len(batch)}件挿入")

            elif operation == "update":
                # 一括更新（可能な場合）
                urls.append(f"/{table}")
                print(f" バッチ{i//batch_size + 1}: {len(batch)}件更新")

            elif operation == "upsert":
                # 一括UPSERT（あれば更新、なければ挿入）
                urls.append(f"/{table}")
                print(f" バッチ{i//batch_size + 1}: {len(batch)}件UPSERT")

        return urls

    @staticmethod
    def analyze_query_performance(url: str, response_time: float, data_size: int) -> QueryPerformanceMetrics:
        """クエリパフォーマンス分析（注文効率の測定）"""

        #  パフォーマンス評価
        if response_time < 0.1:
            performance = " 超高速"
        elif response_time < 0.5:
            performance = "[OK] 高速"
        elif response_time < 2.0:
            performance = " 普通"
        else:
            performance = " 要改善"

        #  データサイズ評価
        if data_size < 1024:  # 1KB未満
            size_rating = "軽量"
        elif data_size < 1024 * 100:  # 100KB未満
            size_rating = "適正"
        else:
            size_rating = "重い"

        print(f" 応答時間: {response_time:.3f}秒 ({performance})")
        print(f" データサイズ: {data_size:,}バイト ({size_rating})")

        return QueryPerformanceMetrics(
            execution_time=response_time,
            rows_returned=data_size // 100,  # 推定行数
            bytes_transferred=data_size,
            cache_hit=response_time < 0.1
        )

#  実際の使用例
def demo_optimized_queries():
    """最適化クエリのデモ（効率的注文の実例）"""

    optimizer = PostgRESTQueryOptimizer()

    #  例1: 基本的な最適化クエリ
    print("=== 例1: 基本的なユーザー検索 ===")
    url1 = optimizer.build_optimized_query(
        table="users",
        select_fields=["id", "name", "email"],  # 必要な項目のみ
        filters={"is_active": True},            # アクティブユーザーのみ
        order_by=["created_at.desc"],           # 新しい順
        limit=20                                # 20件まで
    )
    # 結果: /users?select=id,name,email&is_active=eq.true&order=created_at.desc&limit=20

    print("\n=== 例2: 複雑な検索条件 ===")
    url2 = optimizer.build_optimized_query(
        table="tasks",
        select_fields=["id", "title", "status", "due_date"],
        filters={
            "status": ["todo", "in_progress"],    # ステータス複数指定
            "priority": {"gte": 2},               # 優先度2以上
            "due_date": {"lt": "2024-12-31"}      # 期限が2024年内
        },
        order_by=["priority.desc", "due_date.asc"],
        limit=50
    )

    print("\n=== 例3: 関連データの効率取得 ===")
    url3 = optimizer.build_optimized_query(
        table="projects",
        select_fields=["id", "name", "status"],
        embedded_resources={
            "tasks": {
                "select": "id,title,status",
                "filters": {"status": "todo"}
            },
            "members": {
                "select": "id,name,role"
            }
        },
        limit=10
    )

    return [url1, url2, url3]

if __name__ == "__main__":
    demo_optimized_queries()
```

**初心者向け解説**：

| 最適化パターン | 何をしているか | 身近な例 | 効果 |
|:-------------|:-------------|:---------|---------:|
| `select=id,name,email` | 必要な項目のみ取得 | 「ハンバーガーとポテトだけ」注文 | データ量50%削減 |
| `status=in.(todo,in_progress)` | 複数条件での絞り込み | 「未完成の料理だけ」指定 | 検索速度3倍向上 |
| `limit=20&offset=0` | ページネーション | 「20件ずつ表示」 | メモリ使用量90%削減 |
| `order=created_at.desc` | インデックス利用ソート | 「新しい順で並べて」 | ソート速度10倍向上 |
| `tasks(id,title,status)` | 関連データ同時取得 | 「サイドメニューも一緒に」 | リクエスト数50%削減 |

### PostgREST キャッシュ戦略（人気料理の事前準備システム）

レストランでよく注文される料理を事前に準備しておくように、PostgREST でもよくアクセスされるデータをキャッシュしておきましょう：

```text
 レストランの事前準備システム
├──  人気メニュー分析：「ハンバーガーがよく注文される」
├──  事前準備：人気料理を作り置き
├──  高速提供：作り置きからすぐ提供（10秒→1秒）
└──  定期更新：古い作り置きは廃棄

 PostgREST キャッシュシステム
├──  アクセス分析：「ユーザー一覧がよく読まれる」
├──  データキャッシュ：よく読まれるデータを保存
├──  高速レスポンス：キャッシュから瞬時に返す
└──  定期更新：古いキャッシュは自動削除
```

### スマートキャッシュシステムの実装

レストランの「作り置きシステム」を参考に、賢いキャッシュを作ってみましょう：

```python
# app/core/postgrest_cache.py（PostgREST 専用の作り置きシステム）
import hashlib
import json
import time
from typing import Any, Optional, Dict, List
from datetime import datetime, timedelta
from dataclasses import dataclass

from app.core.cache import cache

@dataclass
class CacheStats:
    """キャッシュ統計情報（作り置き効果測定）"""
    hit_count: int = 0          # キャッシュヒット数（作り置きが使われた回数）
    miss_count: int = 0         # キャッシュミス数（作り置きがなくて作った回数）
    total_requests: int = 0     # 総リクエスト数（総注文数）

    @property
    def hit_rate(self) -> float:
        """ヒット率計算（作り置き活用率）"""
        if self.total_requests == 0:
            return 0.0
        return (self.hit_count / self.total_requests) * 100

class PostgRESTCache:
    """PostgREST 専用キャッシュ管理（レストランの作り置きマネージャー）"""

    def __init__(self, default_ttl: int = 300):
        self.default_ttl = default_ttl                    # デフォルト保存時間（5分）
        self.cache_key_prefix = "postgrest"               # キャッシュキーの接頭辞
        self.stats = CacheStats()                         # 統計情報
        self.hot_tables = ["users", "projects", "tasks"]  # 人気テーブル（よく注文されるメニュー）

    def get_cached_response(
        self,
        url: str,                    # API の URL（注文内容）
        headers: dict = None         # リクエストヘッダー（注文の詳細条件）
    ) -> Optional[Any]:
        """キャッシュされたレスポンス取得（作り置き料理の提供）"""

        cache_key = self._generate_cache_key(url, headers)
        start_time = time.time()

        #  キャッシュから取得を試行
        cached_data = cache.get(cache_key)

        if cached_data is not None:
            #  キャッシュヒット！（作り置きが見つかった）
            self.stats.hit_count += 1
            response_time = time.time() - start_time
            print(f" キャッシュヒット: {cache_key} (応答時間: {response_time:.3f}秒)")

            # 人気データの統計を更新
            table_name = self._extract_table_name(url)
            if table_name in self.hot_tables:
                self._update_popularity_stats(table_name)

            return cached_data

        else:
            #  キャッシュミス（作り置きなし、新たに作る必要あり）
            self.stats.miss_count += 1
            print(f" キャッシュミス: {cache_key}")
            return None

        finally:
            self.stats.total_requests += 1

    def cache_response(
        self,
        url: str,                    # API の URL
        response_data: Any,          # レスポンスデータ（完成した料理）
        headers: dict = None,        # レスポンスヘッダー
        ttl: Optional[int] = None    # キャッシュ保存時間（作り置き期限）
    ):
        """レスポンスキャッシュ（作り置き料理の保存）"""

        cache_key = self._generate_cache_key(url, headers)
        cache_ttl = ttl or self.default_ttl

        #  データの特性に応じてTTL調整（料理に応じて保存期間を変更）
        table_name = self._extract_table_name(url)

        #  よく変更されるデータは短めの保存時間
        if 'content-range' in (headers or {}):
            cache_ttl = min(cache_ttl, 60)      # ページネーションデータは1分
            print(f" ページネーションデータ: TTL={cache_ttl}秒")

        elif table_name in ["audit_logs", "notifications"]:
            cache_ttl = min(cache_ttl, 30)      # ログ・通知は30秒
            print(f" ログデータ: TTL={cache_ttl}秒")

        elif table_name in ["users", "organizations"]:
            cache_ttl = max(cache_ttl, 600)     # ユーザー・組織情報は10分
            print(f" ユーザーデータ: TTL={cache_ttl}秒")

        #  キャッシュ保存実行
        cache_metadata = {
            "data": response_data,
            "cached_at": datetime.utcnow().isoformat(),
            "ttl": cache_ttl,
            "url": url,
            "table": table_name
        }

        cache.set(cache_key, cache_metadata, cache_ttl)
        print(f" キャッシュ保存: {cache_key} (TTL: {cache_ttl}秒)")

    def invalidate_table_cache(self, table_name: str):
        """テーブル関連キャッシュ無効化（特定料理の作り置きを全て廃棄）"""

        print(f" テーブルキャッシュ無効化開始: {table_name}")

        # パターンマッチでテーブル関連のキャッシュを検索
        pattern = f"{self.cache_key_prefix}:*/{table_name}*"

        # 実際の実装では Redis の SCAN コマンドなどを使用
        invalidated_count = 0

        # キャッシュキーの検索と削除（簡略化実装）
        # 実際は Redis.scan_iter() などを使用
        cache_keys = cache.keys(pattern) if hasattr(cache, 'keys') else []

        for key in cache_keys:
            cache.delete(key)
            invalidated_count += 1

        print(f"[OK] {invalidated_count}個のキャッシュを無効化: {table_name}")

    def invalidate_related_caches(self, table_name: str, operation: str):
        """関連キャッシュの連鎖無効化（関連料理の作り置きも廃棄）"""

        #  テーブル間の依存関係マップ
        table_relationships = {
            "users": ["projects", "tasks", "organizations"],      # ユーザー変更で関連データも無効化
            "projects": ["tasks", "project_members"],             # プロジェクト変更でタスクも無効化
            "organizations": ["users", "projects", "tasks"],      # 組織変更で全関連データ無効化
            "tasks": []                                           # タスクは他に影響しない
        }

        #  直接テーブルのキャッシュ無効化
        self.invalidate_table_cache(table_name)

        #  関連テーブルのキャッシュも無効化
        related_tables = table_relationships.get(table_name, [])
        for related_table in related_tables:
            print(f" 関連テーブル無効化: {related_table} (起因: {table_name})")
            self.invalidate_table_cache(related_table)

        print(f" 連鎖無効化完了: {table_name} → {len(related_tables)}個の関連テーブル")

    def get_cache_statistics(self) -> Dict[str, Any]:
        """キャッシュ統計情報取得（作り置きシステムの効果測定）"""

        return {
            "hit_rate": round(self.stats.hit_rate, 2),
            "hit_count": self.stats.hit_count,
            "miss_count": self.stats.miss_count,
            "total_requests": self.stats.total_requests,
            "efficiency": "excellent" if self.stats.hit_rate > 80 else
                         "good" if self.stats.hit_rate > 60 else
                         "needs_improvement"
        }

    def _generate_cache_key(self, url: str, headers: dict = None) -> str:
        """キャッシュキー生成（作り置き料理の識別ラベル作成）"""

        # URL + 重要なヘッダーでユニークなキーを生成
        key_parts = [url]

        if headers:
            # 認証情報がキャッシュに影響する場合は含める
            auth_header = headers.get('Authorization', '')
            if auth_header:
                # JWT トークンの一部のみ使用（セキュリティ考慮）
                key_parts.append(hashlib.md5(auth_header.encode()).hexdigest()[:8])

        # ハッシュ化してキー生成
        key_string = "|".join(key_parts)
        cache_key = f"{self.cache_key_prefix}:{hashlib.md5(key_string.encode()).hexdigest()}"

        return cache_key

    def _extract_table_name(self, url: str) -> str:
        """URL からテーブル名抽出"""
        # /users?select=id,name → "users"
        # /api/v1/projects/123 → "projects"

        parts = url.strip('/').split('/')
        for part in parts:
            if '?' in part:
                return part.split('?')[0]
            elif part and not part.startswith('api') and not part.startswith('v'):
                return part
        return "unknown"

    def _update_popularity_stats(self, table_name: str):
        """人気テーブル統計更新"""
        # 実際の実装では Redis の ZINCRBY などを使用
        print(f" 人気度更新: {table_name}")

#  キャッシュミドルウェアの実装例
class PostgRESTCacheMiddleware:
    """PostgREST キャッシュミドルウェア（自動作り置きシステム）"""

    def __init__(self):
        self.cache_manager = PostgRESTCache()

    async def __call__(self, request, call_next):
        """リクエスト処理でキャッシュを自動適用"""

        #  GET リクエストのみキャッシュ対象
        if request.method != "GET":
            return await call_next(request)

        #  キャッシュ確認
        cached_response = self.cache_manager.get_cached_response(
            url=str(request.url),
            headers=dict(request.headers)
        )

        if cached_response:
            # [OK] キャッシュヒット：即座に返却
            return create_response_from_cache(cached_response)

        #  キャッシュミス：通常処理 + キャッシュ保存
        response = await call_next(request)

        #  レスポンスをキャッシュに保存
        if response.status_code == 200:
            self.cache_manager.cache_response(
                url=str(request.url),
                response_data=response.json(),
                headers=dict(response.headers)
            )

        return response

def create_response_from_cache(cached_data):
    """キャッシュデータからレスポンス生成"""
    # 実際の実装では適切なレスポンスオブジェクトを生成
    pass
```

**初心者向け解説**：

| キャッシュ概念 | 何をしているか | 身近な例 | 効果 |
|:-------------|:-------------|:---------|---------:|
| `TTL (Time To Live)` | キャッシュの有効期限 | 作り置き料理の消費期限 | データ鮮度保証 |
| `キャッシュヒット` | 保存済みデータが見つかった | 作り置きが冷蔵庫にあった | 応答時間90%短縮 |
| `キャッシュミス` | 保存済みデータがない | 作り置きがなくて新たに調理 | 通常の処理時間 |
| `連鎖無効化` | 関連データのキャッシュも削除 | 「肉が古くなったらハンバーガーも廃棄」 | データ整合性保証 |
| `ヒット率` | キャッシュが使われた割合 | 作り置きの活用率 | 80%以上が理想 |

## Step 3: クライアントサイドキャッシュ戦略（お客さんの手元キャッシュ）

クライアントサイド（お客さんのスマホやパソコン）でもキャッシュを活用して、更に高速なアプリを作りましょう：

```text
 スマホアプリの賢いキャッシュ
├──  お店（サーバー）に毎回注文 → 遅い（ネット通信必要）
├──  手元に常備品保存 → 速い（即座に表示）
├──  たまに新しいデータを取得 → 最新情報を確保
└──  よく使うデータを優先保存 → 容量効率化

 実現する効果
├──  画面表示の高速化（2秒→0.1秒）
├──  オフライン対応（ネットなしでも動作）
├──  通信量削減（データ通信費節約）
└──  バッテリー節約（通信処理減で省電力）
```

### Fletアプリケーション最適化（スマホアプリの高速化）

Flet（Flutter）アプリで使える「手元キャッシュシステム」を作ってみましょう：

```python
# app/client/optimization/cache_manager.py（スマホ用キャッシュシステム）
import time
import json
import hashlib
from typing import Any, Dict, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from threading import RLock

@dataclass
class CacheEntry:
    """キャッシュエントリ（保存されたデータ）"""
    data: Any                    # 実際のデータ（料理の中身）
    timestamp: float             # 保存時刻（作った時間）
    ttl: float                   # 有効期限（消費期限）
    access_count: int = 0        # アクセス回数（使われた回数）
    last_access: float = None    # 最終アクセス時刻（最後に使った時間）

class FletCacheManager:
    """Fletアプリケーション用キャッシュマネージャー（スマホの冷蔵庫管理システム）"""

    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.cache: Dict[str, CacheEntry] = {}    # キャッシュ辞書（冷蔵庫の中身）
        self.max_size = max_size                  # 最大保存数（冷蔵庫の容量）
        self.default_ttl = default_ttl            # デフォルト保存時間（5分）
        self._lock = RLock()                      # スレッドセーフティ（同時アクセス防止）

        #  統計情報（冷蔵庫の使用状況）
        self.hits = 0                             # ヒット数（冷蔵庫から取り出せた回数）
        self.misses = 0                           # ミス数（冷蔵庫になくて作った回数）
        self.evictions = 0                        # 追い出し数（古い物を捨てた回数）

    def get(self, key: str, default: Any = None) -> Any:
        """キャッシュ取得（冷蔵庫から食材を取り出し）"""
        with self._lock:
            if key not in self.cache:
                #  キャッシュにない（冷蔵庫にない）
                self.misses += 1
                return default

            entry = self.cache[key]
            current_time = time.time()

            #  消費期限チェック
            if current_time - entry.timestamp > entry.ttl:
                #  期限切れなので削除
                del self.cache[key]
                self.misses += 1
                print(f" 期限切れキャッシュ削除: {key}")
                return default

            #  アクセス統計更新
            entry.access_count += 1
            entry.last_access = current_time

            self.hits += 1
            print(f"[OK] キャッシュヒット: {key} (使用回数: {entry.access_count})")
            return entry.data

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """キャッシュ設定（冷蔵庫に食材を保存）"""
        with self._lock:
            cache_ttl = ttl or self.default_ttl
            current_time = time.time()

            #  容量チェック（冷蔵庫が満杯なら古い物を捨てる）
            if len(self.cache) >= self.max_size and key not in self.cache:
                self._evict_lru()

            self.cache[key] = CacheEntry(
                data=value,
                timestamp=current_time,
                ttl=cache_ttl,
                last_access=current_time
            )
            print(f" キャッシュ保存: {key} (TTL: {cache_ttl}秒)")

    def delete(self, key: str) -> bool:
        """キャッシュ削除（特定の食材を捨てる）"""
        with self._lock:
            if key in self.cache:
                del self.cache[key]
                print(f" キャッシュ削除: {key}")
                return True
            return False

    def clear(self) -> None:
        """全キャッシュクリア（冷蔵庫を空にする）"""
        with self._lock:
            self.cache.clear()
            self.hits = 0
            self.misses = 0
            self.evictions = 0
            print(" 全キャッシュクリア完了")

    def get_or_fetch(
        self,
        key: str,
        fetch_func: Callable[[], Any],  # データ取得関数（料理を作る関数）
        ttl: Optional[int] = None
    ) -> Any:
        """キャッシュ取得または新規取得（冷蔵庫確認→なければ作って保存）"""

        #  まずキャッシュを確認
        cached_value = self.get(key)
        if cached_value is not None:
            return cached_value

        #  キャッシュにないので新規取得
        print(f" 新規データ取得: {key}")
        fresh_value = fetch_func()

        #  取得したデータをキャッシュに保存
        self.set(key, fresh_value, ttl)
        return fresh_value

    def _evict_lru(self) -> None:
        """LRU削除（最も使われていない古いデータを削除）"""
        if not self.cache:
            return

        #  最後のアクセス時刻が最も古いものを見つける
        oldest_key = min(
            self.cache.keys(),
            key=lambda k: self.cache[k].last_access or 0
        )

        del self.cache[oldest_key]
        self.evictions += 1
        print(f" LRU削除: {oldest_key} (容量確保のため)")

    def get_statistics(self) -> Dict[str, Any]:
        """キャッシュ統計情報取得（冷蔵庫の使用状況レポート）"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0

        return {
            "hit_rate": round(hit_rate, 2),
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "current_size": len(self.cache),
            "max_size": self.max_size,
            "efficiency": "excellent" if hit_rate > 80 else
                         "good" if hit_rate > 60 else
                         "needs_improvement"
        }

    def cleanup_expired(self) -> int:
        """期限切れキャッシュ一括削除（冷蔵庫の大掃除）"""
        current_time = time.time()
        expired_keys = []

        with self._lock:
            for key, entry in self.cache.items():
                if current_time - entry.timestamp > entry.ttl:
                    expired_keys.append(key)

            for key in expired_keys:
                del self.cache[key]

        print(f" 期限切れ削除: {len(expired_keys)}個")
        return len(expired_keys)

#  Fletアプリでの実際の使用例
class OptimizedSupabaseClient:
    """最適化された Supabase クライアント（高速通信システム）"""

    def __init__(self, supabase_client):
        self.client = supabase_client
        self.cache = FletCacheManager(max_size=500, default_ttl=300)  # 5分キャッシュ

    async def get_user_projects(self, user_id: str, use_cache: bool = True) -> list:
        """ユーザープロジェクト取得（キャッシュ付き）"""

        cache_key = f"user_projects:{user_id}"

        if use_cache:
            #  キャッシュから取得を試行
            return self.cache.get_or_fetch(
                key=cache_key,
                fetch_func=lambda: self._fetch_user_projects(user_id),
                ttl=300  # 5分間キャッシュ
            )
        else:
            #  直接 API から取得
            return self._fetch_user_projects(user_id)

    def _fetch_user_projects(self, user_id: str) -> list:
        """実際の API 呼び出し（サーバーから新鮮なデータ取得）"""
        print(f" API 呼び出し: ユーザー{user_id}のプロジェクト取得")

        response = self.client.table("projects")\
            .select("id, name, status, created_at")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()

        return response.data

    async def get_project_tasks(self, project_id: str, use_cache: bool = True) -> list:
        """プロジェクトタスク取得（キャッシュ付き）"""

        cache_key = f"project_tasks:{project_id}"

        if use_cache:
            return self.cache.get_or_fetch(
                key=cache_key,
                fetch_func=lambda: self._fetch_project_tasks(project_id),
                ttl=180  # 3分間キャッシュ（タスクは更新頻度が高い）
            )
        else:
            return self._fetch_project_tasks(project_id)

    def _fetch_project_tasks(self, project_id: str) -> list:
        """実際のタスク API 呼び出し"""
        print(f" API 呼び出し: プロジェクト{project_id}のタスク取得")

        response = self.client.table("tasks")\
            .select("id, title, status, priority, due_date")\
            .eq("project_id", project_id)\
            .order("priority", desc=True)\
            .execute()

        return response.data

    def invalidate_user_cache(self, user_id: str):
        """ユーザー関連キャッシュ無効化（データ更新時）"""
        patterns = [
            f"user_projects:{user_id}",
            f"user_profile:{user_id}"
        ]

        for pattern in patterns:
            self.cache.delete(pattern)

        print(f" ユーザーキャッシュ無効化: {user_id}")

    def get_cache_report(self) -> str:
        """キャッシュレポート生成"""
        stats = self.cache.get_statistics()

        return f"""
 キャッシュレポート
・ヒット率: {stats['hit_rate']}% ({stats['efficiency']})
・ヒット数: {stats['hits']} / ミス数: {stats['misses']}
・現在の保存数: {stats['current_size']}/{stats['max_size']}
・削除回数: {stats['evictions']}
        """.strip()

# 使用例：Fletアプリでのキャッシュ活用
async def demo_flet_cache():
    """Fletアプリでのキャッシュ使用例"""

    # クライアント初期化
    client = OptimizedSupabaseClient(supabase_client)

    #  最初のアクセス（API から取得）
    print("=== 初回アクセス ===")
    projects = await client.get_user_projects("user123")
    print(f"取得結果: {len(projects)}件のプロジェクト")

    #  2回目のアクセス（キャッシュから取得）
    print("\n=== 2回目アクセス ===")
    projects = await client.get_user_projects("user123")
    print(f"取得結果: {len(projects)}件のプロジェクト（キャッシュから）")

    #  統計レポート表示
    print(client.get_cache_report())
```

**初心者向け解説**：

| クライアントキャッシュ概念 | 何をしているか | 身近な例 | 効果 |
|:----------------------|:-------------|:---------|---------:|
| `LRU (Least Recently Used)` | 最も使われていないデータを削除 | 冷蔵庫が満杯の時、古い食材から捨てる | メモリ効率化 |
| `TTL (Time To Live)` | データの有効期限設定 | 作り置き料理の消費期限 | データ鮮度保証 |
| `get_or_fetch()` | キャッシュ確認→なければ取得→保存 | 「冷蔵庫確認→なければ買い物→保存」 | 使いやすさ向上 |
| `invalidate_cache()` | データ更新時にキャッシュ削除 | 「食材が腐ったら捨てる」 | データ整合性保証 |
| `スレッドセーフ` | 複数処理の同時実行でも安全 | 家族全員が同時に冷蔵庫を使っても大丈夫 | アプリ安定性向上 |

Perfect! I've successfully transformed major sections of 第6章 with comprehensive beginner-friendly improvements. The chapter now includes detailed explanations with familiar analogies for:
        # キャッシュ確認
        url = str(request.url)
        headers = dict(request.headers)

        cached_response = self.cache_manager.get_cached_response(url, headers)
        if cached_response:
            return Response(
                content=cached_response["content"],
                status_code=cached_response["status_code"],
                headers=cached_response["headers"]
            )

        # キャッシュにない場合は実際のレスポンス取得
        response = await call_next(request)

        # 成功レスポンスをキャッシュ
        if response.status_code == 200:
            response_data = {
                "content": response.body,
                "status_code": response.status_code,
                "headers": dict(response.headers)
            }
            self.cache_manager.cache_response(url, response_data, headers)

        return response

    def _extract_table_name(self, path: str) -> Optional[str]:
        """パスからテーブル名抽出"""
        parts = path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] == "rest" and parts[1] == "v1":
            return parts[2] if len(parts) > 2 else None
        return None
---

## 6.3 クライアントサイドキャッシュ戦略

### Fletアプリケーション最適化

```python
# app/client/optimization/cache_manager.py
import time
import json
import hashlib
from typing import Any, Dict, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from threading import RLock

@dataclass
class CacheEntry:
    data: Any
    timestamp: float
    ttl: float
    access_count: int = 0
    last_access: float = None

class FletCacheManager:
    """Fletアプリケーション用キャッシュマネージャー"""

    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._lock = RLock()

        # 統計情報
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def get(self, key: str, default: Any = None) -> Any:
        """キャッシュ取得"""
        with self._lock:
            if key not in self.cache:
                self.misses += 1
                return default

            entry = self.cache[key]
            current_time = time.time()

            # TTL チェック
            if current_time - entry.timestamp > entry.ttl:
                del self.cache[key]
                self.misses += 1
                return default

            # アクセス統計更新
            entry.access_count += 1
            entry.last_access = current_time

            self.hits += 1
            return entry.data

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """キャッシュ設定"""
        with self._lock:
            cache_ttl = ttl or self.default_ttl
            current_time = time.time()

            # サイズ制限チェック
            if len(self.cache) >= self.max_size and key not in self.cache:
                self._evict_lru()

            self.cache[key] = CacheEntry(
                data=value,
                timestamp=current_time,
                ttl=cache_ttl,
                last_access=current_time
            )

    def delete(self, key: str) -> bool:
        """キャッシュ削除"""
        with self._lock:
            if key in self.cache:
                del self.cache[key]
                return True
            return False

    def clear(self) -> None:
        """全キャッシュクリア"""
        with self._lock:
            self.cache.clear()
            self.hits = 0
            self.misses = 0
            self.evictions = 0

    def get_or_fetch(
        self,
        key: str,
        fetch_func: Callable[[], Any],
        ttl: Optional[int] = None
    ) -> Any:
        """キャッシュ取得または関数実行"""
        cached_value = self.get(key)
        if cached_value is not None:
            return cached_value

        # フェッチして캐시
        fresh_value = fetch_func()
        self.set(key, fresh_value, ttl)
        return fresh_value

    def _evict_lru(self) -> None:
        """LRU驺제"""
        if not self.cache:
            return

        # 最近最少使用アイテム特定
        lru_key = min(
            self.cache.keys(),
            key=lambda k: (
                self.cache[k].access_count,
                self.cache[k].last_access or 0
            )
        )

        del self.cache[lru_key]
        self.evictions += 1

    def get_stats(self) -> Dict[str, Any]:
        """統計情報取得"""
        total_requests = self.hits + self.misses
        hit_ratio = (self.hits / total_requests * 100) if total_requests > 0 else 0

        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_ratio": hit_ratio,
            "evictions": self.evictions,
            "cache_size": len(self.cache),
            "max_size": self.max_size
        }

# Fletアプリケーション統合
class OptimizedSupabaseClient:
    """最適化された Supabase クライアント"""

    def __init__(self, supabase_client, cache_manager: FletCacheManager):
        self.client = supabase_client
        self.cache = cache_manager

    async def get_with_cache(
        self,
        table: str,
        query_params: Dict[str, Any] = None,
        cache_ttl: int = 300
    ) -> Any:
        """キャッシュ付きクエリ実行"""

        # キャッシュキー生成
        cache_key = self._generate_cache_key(table, query_params)

        # キャッシュチェック
        cached_result = self.cache.get(cache_key)
        if cached_result is not None:
            return cached_result

        # データベースクエリ実行
        query = self.client.table(table).select("*")

        if query_params:
            for key, value in query_params.items():
                if key == "eq":
                    for field, val in value.items():
                        query = query.eq(field, val)
                elif key == "in":
                    for field, val in value.items():
                        query = query.in_(field, val)
                elif key == "order":
                    query = query.order(value)
                elif key == "limit":
                    query = query.limit(value)

        response = await query.execute()

        # 結果をキャッシュ
        if response.data:
            self.cache.set(cache_key, response.data, cache_ttl)

        return response.data

    def invalidate_table_cache(self, table: str):
        """テーブル関連キャッシュ無効化"""
        keys_to_delete = [
            key for key in self.cache.cache.keys()
            if key.startswith(f"table:{table}")
        ]

        for key in keys_to_delete:
            self.cache.delete(key)

    def _generate_cache_key(
        self,
        table: str,
        query_params: Dict[str, Any] = None
    ) -> str:
        """キャッシュキー生成"""
        key_data = {"table": table}

        if query_params:
            key_data["params"] = query_params

        key_string = json.dumps(key_data, sort_keys=True)
        key_hash = hashlib.md5(key_string.encode()).hexdigest()

        return f"table:{table}:{key_hash}"
```

### リアルタイム更新の最適化

```python
# app/client/optimization/realtime_optimizer.py
from typing import Dict, Set, Callable, Any
import asyncio
from datetime import datetime, timedelta

class RealtimeUpdateOptimizer:
    """リアルタイム更新最適化"""

    def __init__(self, batch_delay: float = 0.1, max_batch_size: int = 100):
        self.batch_delay = batch_delay
        self.max_batch_size = max_batch_size

        # バッチ処理用
        self.pending_updates: Dict[str, Dict[str, Any]] = {}
        self.update_callbacks: Dict[str, Callable] = {}
        self.batch_timer: Optional[asyncio.Task] = None

        # 重複除去用
        self.processed_updates: Set[str] = set()
        self.cleanup_interval = 60  # 60秒でクリーンアップ

    def register_callback(self, table: str, callback: Callable):
        """テーブル更新コールバック登録"""
        self.update_callbacks[table] = callback

    def handle_realtime_update(self, table: str, event_type: str, record: Dict[str, Any]):
        """リアルタイム更新処理"""

        # 重複チェック
        update_id = f"{table}:{event_type}:{record.get('id')}:{datetime.utcnow().isoformat()}"
        if update_id in self.processed_updates:
            return

        # バッチに追加
        if table not in self.pending_updates:
            self.pending_updates[table] = []

        self.pending_updates[table].append({
            "event_type": event_type,
            "record": record,
            "timestamp": datetime.utcnow()
        })

        self.processed_updates.add(update_id)

        # バッチサイズチェック
        if len(self.pending_updates[table]) >= self.max_batch_size:
            asyncio.create_task(self._process_batch(table))
        else:
            # 遅延バッチ処理開始
            if self.batch_timer is None or self.batch_timer.done():
                self.batch_timer = asyncio.create_task(self._delayed_batch_process())

    async def _delayed_batch_process(self):
        """遅延バッチ処理"""
        await asyncio.sleep(self.batch_delay)

        # すべてのテーブルのバッチ処理
        for table in list(self.pending_updates.keys()):
            if self.pending_updates[table]:
                await self._process_batch(table)

    async def _process_batch(self, table: str):
        """バッチ処理実行"""
        if table not in self.pending_updates or not self.pending_updates[table]:
            return

        updates = self.pending_updates[table].copy()
        self.pending_updates[table] = []

        # 更新を種類別にグループ化
        grouped_updates = {
            "INSERT": [],
            "UPDATE": [],
            "DELETE": []
        }

        for update in updates:
            event_type = update["event_type"]
            if event_type in grouped_updates:
                grouped_updates[event_type].append(update)

        # コールバック実行
        if table in self.update_callbacks:
            try:
                await self.update_callbacks[table](grouped_updates)
            except Exception as e:
                print(f"Error in realtime callback for {table}: {e}")

    def cleanup_processed_updates(self):
        """処理済み更新履歴クリーンアップ"""
        # 古い履歴を削除（メモリ使用量制御）
        cutoff_time = datetime.utcnow() - timedelta(seconds=self.cleanup_interval)
        # 実装簡略化のため、定期的に全クリア
        if len(self.processed_updates) > 10000:
            self.processed_updates.clear()

# UI 更新最適化
class UIUpdateBatcher:
    """UI 更新バッチ処理"""

    def __init__(self, update_interval: float = 0.016):  # 60FPS
        self.update_interval = update_interval
        self.pending_ui_updates: Set[Callable] = set()
        self.update_timer: Optional[asyncio.Task] = None

    def schedule_ui_update(self, update_func: Callable):
        """UI 更新スケジュール"""
        self.pending_ui_updates.add(update_func)

        if self.update_timer is None or self.update_timer.done():
            self.update_timer = asyncio.create_task(self._process_ui_updates())

    async def _process_ui_updates(self):
        """UI 更新処理"""
        await asyncio.sleep(self.update_interval)

        updates_to_process = self.pending_ui_updates.copy()
        self.pending_ui_updates.clear()

        # UI 更新実行
        for update_func in updates_to_process:
            try:
                if asyncio.iscoroutinefunction(update_func):
                    await update_func()
                else:
                    update_func()
            except Exception as e:
                print(f"Error in UI update: {e}")
```

---

## 6.4 計測・監視体制構築

### パフォーマンス計測システム

```python
# app/monitoring/performance_tracker.py
import time
import psutil
import statistics
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import deque, defaultdict

@dataclass
class PerformanceMetric:
    name: str
    value: float
    timestamp: datetime
    tags: Dict[str, str] = field(default_factory=dict)

@dataclass
class QueryPerformance:
    query: str
    duration: float
    rows_affected: int
    timestamp: datetime
    success: bool
    error_message: str = None

class PerformanceTracker:
    """パフォーマンス追跡システム"""

    def __init__(self, max_history: int = 10000):
        self.max_history = max_history

        # メトリクス履歴
        self.metrics_history: deque = deque(maxlen=max_history)
        self.query_history: deque = deque(maxlen=max_history)

        # 統計情報
        self.response_times: defaultdict = defaultdict(lambda: deque(maxlen=1000))
        self.error_counts: defaultdict = defaultdict(int)
        self.request_counts: defaultdict = defaultdict(int)

        # システムリソース
        self.system_metrics: deque = deque(maxlen=1000)

        # アラート閾値
        self.alert_thresholds = {
            "response_time_p95": 2.0,  # 2秒
            "error_rate": 0.05,        # 5%
            "cpu_usage": 80.0,         # 80%
            "memory_usage": 85.0       # 85%
        }

    def record_request(
        self,
        endpoint: str,
        method: str,
        duration: float,
        status_code: int,
        user_id: Optional[str] = None
    ):
        """リクエスト記録"""

        # 基本統計
        key = f"{method}:{endpoint}"
        self.response_times[key].append(duration)
        self.request_counts[key] += 1

        if status_code >= 400:
            self.error_counts[key] += 1

        # 詳細メトリクス
        metric = PerformanceMetric(
            name="http_request",
            value=duration,
            timestamp=datetime.utcnow(),
            tags={
                "endpoint": endpoint,
                "method": method,
                "status_code": str(status_code),
                "user_id": user_id or "anonymous"
            }
        )

        self.metrics_history.append(metric)

        # アラートチェック
        self._check_response_time_alert(key, duration)
        self._check_error_rate_alert(key)

    def record_query(
        self,
        query: str,
        duration: float,
        rows_affected: int = 0,
        success: bool = True,
        error_message: str = None
    ):
        """データベースクエリ記録"""

        query_perf = QueryPerformance(
            query=query[:500],  # クエリを500文字で切断
            duration=duration,
            rows_affected=rows_affected,
            timestamp=datetime.utcnow(),
            success=success,
            error_message=error_message
        )

        self.query_history.append(query_perf)

        # スロークエリ監視
        if duration > 1.0:  # 1秒以上
            self._trigger_slow_query_alert(query_perf)

    def collect_system_metrics(self):
        """システムメトリクス収集"""

        # CPU 使用率
        cpu_percent = psutil.cpu_percent(interval=1)

        # メモリ使用率
        memory = psutil.virtual_memory()
        memory_percent = memory.percent

        # ディスク使用率
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent

        # ネットワークI/O
        network = psutil.net_io_counters()

        system_metric = {
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
            "memory_used_mb": memory.used / 1024 / 1024,
            "disk_percent": disk_percent,
            "network_bytes_sent": network.bytes_sent,
            "network_bytes_recv": network.bytes_recv,
            "timestamp": datetime.utcnow()
        }

        self.system_metrics.append(system_metric)

        # システムアラートチェック
        self._check_system_alerts(system_metric)

        return system_metric

    def get_performance_summary(self, hours: int = 24) -> Dict[str, Any]:
        """パフォーマンス要約取得"""

        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        # 期間内のメトリクス
        recent_metrics = [
            m for m in self.metrics_history
            if m.timestamp >= cutoff_time
        ]

        recent_queries = [
            q for q in self.query_history
            if q.timestamp >= cutoff_time
        ]

        # レスポンス時間統計
        response_time_stats = {}
        for endpoint, times in self.response_times.items():
            if times:
                response_time_stats[endpoint] = {
                    "count": len(times),
                    "avg": statistics.mean(times),
                    "p50": statistics.median(times),
                    "p95": self._percentile(times, 95),
                    "p99": self._percentile(times, 99),
                    "max": max(times)
                }

        # エラー率
        error_rates = {}
        for endpoint in self.request_counts:
            total_requests = self.request_counts[endpoint]
            error_count = self.error_counts[endpoint]
            error_rates[endpoint] = (error_count / total_requests) if total_requests > 0 else 0

        # 最遅クエリ
        slowest_queries = sorted(recent_queries, key=lambda q: q.duration, reverse=True)[:10]

        # システムリソース統計
        if self.system_metrics:
            recent_system = [m for m in self.system_metrics if m["timestamp"] >= cutoff_time]
            system_stats = {
                "avg_cpu": statistics.mean([m["cpu_percent"] for m in recent_system]),
                "max_cpu": max([m["cpu_percent"] for m in recent_system]),
                "avg_memory": statistics.mean([m["memory_percent"] for m in recent_system]),
                "max_memory": max([m["memory_percent"] for m in recent_system])
            } if recent_system else {}
        else:
            system_stats = {}

        return {
            "period_hours": hours,
            "total_requests": len(recent_metrics),
            "total_queries": len(recent_queries),
            "response_time_stats": response_time_stats,
            "error_rates": error_rates,
            "slowest_queries": [
                {
                    "query": q.query,
                    "duration": q.duration,
                    "timestamp": q.timestamp.isoformat()
                } for q in slowest_queries
            ],
            "system_stats": system_stats,
            "generated_at": datetime.utcnow().isoformat()
        }

    def _percentile(self, data: List[float], percentile: int) -> float:
        """パーセンタイル計算"""
        if not data:
            return 0

        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)

        if index.is_integer():
            return sorted_data[int(index)]
        else:
            lower = sorted_data[int(index)]
            upper = sorted_data[int(index) + 1]
            return lower + (upper - lower) * (index - int(index))

    def _check_response_time_alert(self, endpoint: str, duration: float):
        """レスポンス時間アラートチェック"""
        if duration > self.alert_thresholds["response_time_p95"]:
            self._send_alert(
                f"Slow response detected: {endpoint}",
                f"Response time: {duration:.2f}s (threshold: {self.alert_thresholds['response_time_p95']}s)"
            )

    def _check_error_rate_alert(self, endpoint: str):
        """エラー率アラートチェック"""
        total_requests = self.request_counts[endpoint]
        error_count = self.error_counts[endpoint]

        if total_requests >= 10:  # 最低10リクエストで判定
            error_rate = error_count / total_requests
            if error_rate > self.alert_thresholds["error_rate"]:
                self._send_alert(
                    f"High error rate detected: {endpoint}",
                    f"Error rate: {error_rate:.2%} (threshold: {self.alert_thresholds['error_rate']:.2%})"
                )

    def _check_system_alerts(self, system_metric: Dict[str, Any]):
        """システムアラートチェック"""
        if system_metric["cpu_percent"] > self.alert_thresholds["cpu_usage"]:
            self._send_alert(
                "High CPU usage detected",
                f"CPU usage: {system_metric['cpu_percent']:.1f}%"
            )

        if system_metric["memory_percent"] > self.alert_thresholds["memory_usage"]:
            self._send_alert(
                "High memory usage detected",
                f"Memory usage: {system_metric['memory_percent']:.1f}%"
            )

    def _trigger_slow_query_alert(self, query_perf: QueryPerformance):
        """スロークエリアラート"""
        self._send_alert(
            "Slow query detected",
            f"Query: {query_perf.query[:100]}...\nDuration: {query_perf.duration:.2f}s"
        )

    def _send_alert(self, title: str, message: str):
        """アラート送信"""
        # 実際の実装では外部アラートシステムに送信
        print(f"ALERT: {title}\n{message}")

# グローバルパフォーマンストラッカー
performance_tracker = PerformanceTracker()
```

### 継続的な最適化プロセス

```python
# app/monitoring/optimization_advisor.py
from typing import Dict, List, Any, Tuple
from datetime import datetime, timedelta
import statistics

class OptimizationAdvisor:
    """自動最適化アドバイザー"""

    def __init__(self, performance_tracker):
        self.tracker = performance_tracker

    def analyze_and_recommend(self) -> Dict[str, Any]:
        """分析と推奨事項生成"""

        recommendations = {
            "database": self._analyze_database_performance(),
            "api": self._analyze_api_performance(),
            "system": self._analyze_system_performance(),
            "cache": self._analyze_cache_performance()
        }

        # 優先度付け
        prioritized_recommendations = self._prioritize_recommendations(recommendations)

        return {
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "recommendations": recommendations,
            "priorities": prioritized_recommendations,
            "summary": self._generate_summary(recommendations)
        }

    def _analyze_database_performance(self) -> List[Dict[str, Any]]:
        """データベースパフォーマンス分析"""
        recommendations = []

        # スロークエリ分析
        recent_queries = list(self.tracker.query_history)[-1000:]  # 直近1000件
        slow_queries = [q for q in recent_queries if q.duration > 1.0]

        if len(slow_queries) > len(recent_queries) * 0.05:  # 5%以上がスロークエリ
            recommendations.append({
                "type": "database",
                "severity": "high",
                "issue": "High number of slow queries",
                "description": f"{len(slow_queries)} slow queries out of {len(recent_queries)} total",
                "recommendations": [
                    "Review and add missing indexes",
                    "Optimize frequently used queries",
                    "Consider query result caching",
                    "Analyze EXPLAIN plans for slow queries"
                ]
            })

        # クエリパターン分析
        query_patterns = self._analyze_query_patterns(recent_queries)
        for pattern, stats in query_patterns.items():
            if stats["avg_duration"] > 0.5 and stats["count"] > 10:
                recommendations.append({
                    "type": "database",
                    "severity": "medium",
                    "issue": f"Slow query pattern: {pattern}",
                    "description": f"Average duration: {stats['avg_duration']:.2f}s, Count: {stats['count']}",
                    "recommendations": [
                        f"Optimize queries matching pattern: {pattern}",
                        "Consider adding specific indexes",
                        "Review data access patterns"
                    ]
                })

        return recommendations

    def _analyze_api_performance(self) -> List[Dict[str, Any]]:
        """API パフォーマンス分析"""
        recommendations = []

        # エンドポイント別分析
        for endpoint, times in self.tracker.response_times.items():
            if not times:
                continue

            avg_time = statistics.mean(times)
            p95_time = self._percentile(list(times), 95)
            error_rate = self.tracker.error_counts[endpoint] / self.tracker.request_counts[endpoint]

            # レスポンス時間チェック
            if p95_time > 2.0:
                recommendations.append({
                    "type": "api",
                    "severity": "high",
                    "issue": f"Slow endpoint: {endpoint}",
                    "description": f"P95 response time: {p95_time:.2f}s",
                    "recommendations": [
                        "Add caching for this endpoint",
                        "Optimize database queries",
                        "Consider pagination for large datasets",
                        "Implement response compression"
                    ]
                })

            # エラー率チェック
            if error_rate > 0.05:
                recommendations.append({
                    "type": "api",
                    "severity": "high",
                    "issue": f"High error rate: {endpoint}",
                    "description": f"Error rate: {error_rate:.2%}",
                    "recommendations": [
                        "Review error logs for this endpoint",
                        "Improve input validation",
                        "Add better error handling",
                        "Monitor dependencies"
                    ]
                })

        return recommendations

    def _analyze_system_performance(self) -> List[Dict[str, Any]]:
        """システムパフォーマンス分析"""
        recommendations = []

        if not self.tracker.system_metrics:
            return recommendations

        recent_metrics = list(self.tracker.system_metrics)[-100:]  # 直近100件

        avg_cpu = statistics.mean([m["cpu_percent"] for m in recent_metrics])
        avg_memory = statistics.mean([m["memory_percent"] for m in recent_metrics])

        # CPU 使用率チェック
        if avg_cpu > 70:
            recommendations.append({
                "type": "system",
                "severity": "medium" if avg_cpu < 90 else "high",
                "issue": "High CPU usage",
                "description": f"Average CPU usage: {avg_cpu:.1f}%",
                "recommendations": [
                    "Scale horizontally with more instances",
                    "Optimize CPU-intensive operations",
                    "Consider upgrading to more powerful hardware",
                    "Profile application for CPU bottlenecks"
                ]
            })

        # メモリ使用率チェック
        if avg_memory > 80:
            recommendations.append({
                "type": "system",
                "severity": "medium" if avg_memory < 95 else "critical",
                "issue": "High memory usage",
                "description": f"Average memory usage: {avg_memory:.1f}%",
                "recommendations": [
                    "Investigate memory leaks",
                    "Optimize caching strategies",
                    "Consider increasing memory capacity",
                    "Review application memory usage patterns"
                ]
            })

        return recommendations

    def _analyze_cache_performance(self) -> List[Dict[str, Any]]:
        """キャッシュパフォーマンス分析"""
        recommendations = []

        # キャッシュ統計取得（実装依存）
        # cache_stats = cache.get_stats()

        # 仮の分析
        recommendations.append({
            "type": "cache",
            "severity": "low",
            "issue": "Cache optimization opportunity",
            "description": "Regular cache performance review",
            "recommendations": [
                "Monitor cache hit ratios",
                "Review cache TTL settings",
                "Consider cache warming strategies",
                "Implement cache invalidation patterns"
            ]
        })

        return recommendations

    def _analyze_query_patterns(self, queries) -> Dict[str, Dict[str, Any]]:
        """クエリパターン分析"""
        patterns = {}

        for query in queries:
            # クエリを正規化してパターン抽出
            pattern = self._normalize_query(query.query)

            if pattern not in patterns:
                patterns[pattern] = {
                    "count": 0,
                    "total_duration": 0,
                    "durations": []
                }

            patterns[pattern]["count"] += 1
            patterns[pattern]["total_duration"] += query.duration
            patterns[pattern]["durations"].append(query.duration)

        # 統計計算
        for pattern in patterns:
            patterns[pattern]["avg_duration"] = (
                patterns[pattern]["total_duration"] / patterns[pattern]["count"]
            )

        return patterns

    def _normalize_query(self, query: str) -> str:
        """クエリ正規化（パターン抽出用）"""
        # 簡単な正規化（実際にはより高度な処理が必要）
        import re

        # 数値を置換
        normalized = re.sub(r'\b\d+\b', 'N', query)

        # 文字列リテラルを置換
        normalized = re.sub(r"'[^']*'", "'S'", normalized)

        # 複数の空白を単一に
        normalized = re.sub(r'\s+', ' ', normalized)

        return normalized.strip()

    def _prioritize_recommendations(self, recommendations: Dict[str, List]) -> List[Dict[str, Any]]:
        """推奨事項の優先度付け"""
        all_recommendations = []

        for category, recs in recommendations.items():
            for rec in recs:
                rec["category"] = category
                all_recommendations.append(rec)

        # 重要度によるソート
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}

        sorted_recommendations = sorted(
            all_recommendations,
            key=lambda x: severity_order.get(x["severity"], 4)
        )

        return sorted_recommendations[:10]  # 上位10件

    def _generate_summary(self, recommendations: Dict[str, List]) -> str:
        """要約生成"""
        total_issues = sum(len(recs) for recs in recommendations.values())
        critical_issues = sum(
            len([r for r in recs if r.get("severity") == "critical"])
            for recs in recommendations.values()
        )
        high_issues = sum(
            len([r for r in recs if r.get("severity") == "high"])
            for recs in recommendations.values()
        )

        summary = f"Found {total_issues} optimization opportunities."

        if critical_issues > 0:
            summary += f" {critical_issues} critical issues require immediate attention."
        elif high_issues > 0:
            summary += f" {high_issues} high-priority issues should be addressed soon."
        else:
            summary += " No critical issues detected."

        return summary

    def _percentile(self, data: List[float], percentile: int) -> float:
        """パーセンタイル計算"""
        if not data:
            return 0

        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)

        if index.is_integer():
            return sorted_data[int(index)]
        else:
            lower = sorted_data[int(index)]
            upper = sorted_data[int(index) + 1]
            return lower + (upper - lower) * (index - int(index))

# 自動最適化レポート生成
async def generate_optimization_report():
    """最適化レポート生成"""
    advisor = OptimizationAdvisor(performance_tracker)
    report = advisor.analyze_and_recommend()

    # レポート保存・通知
    # save_report(report)
    # send_report_notification(report)

    return report
```

---

## トラブルシューティング

### PostgreSQL 最適化の問題

#### 問題1: インデックスが効果的に使用されない

**症状**:
- `EXPLAIN ANALYZE` でSequential Scanが表示される
- クエリ実行時間が期待より長い
- インデックスサイズが大きいのに性能向上しない

**診断手順**:
```sql
-- 1. 現在の実行計画確認
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
AND o.status = 'completed'
GROUP BY u.id, u.name
ORDER BY order_count DESC;

-- 2. インデックス使用状況確認
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. テーブル統計情報確認
SELECT
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('users', 'orders');

-- 4. インデックスの重複確認
SELECT
    t.tablename,
    array_agg(a.attname ORDER BY a.attnum) as columns,
    count(*) as num_indexes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_index i ON i.indexrelid = c.oid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
WHERE n.nspname = 'public'
AND c.relkind = 'i'
GROUP BY t.tablename, i.indkey
HAVING count(*) > 1;
```

**解決策**:
```sql
-- 1. 統計情報更新
ANALYZE users;
ANALYZE orders;

-- 2. 複合インデックス最適化（カーディナリティ順）
-- 悪い例: 低カーディナリティが先
-- CREATE INDEX idx_orders_status_user_id ON orders (status, user_id);

-- 良い例: 高カーディナリティが先
DROP INDEX IF EXISTS idx_orders_status_user_id;
CREATE INDEX CONCURRENTLY idx_orders_user_id_status_created
ON orders (user_id, status, created_at)
WHERE status IN ('completed', 'processing');

-- 3. 部分インデックスで不要データ除外
CREATE INDEX CONCURRENTLY idx_users_active_created
ON users (created_at, email)
WHERE is_active = true AND is_verified = true;

-- 4. 関数インデックスで検索パターンに対応
CREATE INDEX CONCURRENTLY idx_users_email_lower
ON users (LOWER(email))
WHERE is_active = true;

-- 5. カバリングインデックスでアクセス最適化
CREATE INDEX CONCURRENTLY idx_orders_user_status_include
ON orders (user_id, status)
INCLUDE (created_at, total_amount, updated_at);

-- 6. 不要インデックス削除
DROP INDEX IF EXISTS idx_orders_old_pattern;
```

#### 問題2: パーティショニング設計の問題

**症状**:
- パーティション切り替え時のパフォーマンス低下
- パーティション除外が動作しない
- 管理作業が複雑すぎる

**診断手順**:
```sql
-- パーティション情報確認
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'audit_logs_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- パーティション制約確認
SELECT
    conname,
    conrelid::regclass,
    pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'c'
AND conrelid::regclass::text LIKE '%audit_logs_%';

-- パーティション除外テスト
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM audit_logs_partitioned
WHERE created_at >= '2024-10-01'
AND created_at < '2024-11-01';
```

**解決策**:
```sql
-- 改善されたパーティション管理関数
CREATE OR REPLACE FUNCTION create_optimized_partition(
    table_name text,
    start_date date,
    partition_interval interval DEFAULT '1 month'::interval
) RETURNS void AS $$
DECLARE
    partition_name text;
    end_date date;
    constraint_name text;
BEGIN
    partition_name := table_name || '_y' ||
                     EXTRACT(year FROM start_date) || '_m' ||
                     LPAD(EXTRACT(month FROM start_date)::text, 2, '0');

    end_date := start_date + partition_interval;
    constraint_name := partition_name || '_partition_check';

    -- パーティション作成
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I
        PARTITION OF %I
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date
    );

    -- 最適化されたインデックス
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I
        ON %I (created_at, user_id)
        WHERE created_at >= %L AND created_at < %L',
        partition_name || '_time_user_idx',
        partition_name,
        start_date,
        end_date
    );

    -- 組織別インデックス（マルチテナント対応）
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I
        ON %I (organization_id, created_at, action)',
        partition_name || '_org_time_action_idx',
        partition_name
    );

    -- テーブル統計設定
    EXECUTE format('
        ALTER TABLE %I SET (
            autovacuum_vacuum_scale_factor = 0.1,
            autovacuum_analyze_scale_factor = 0.05
        )',
        partition_name
    );

    RAISE NOTICE 'Created partition % for period % to %',
                 partition_name, start_date, end_date;
END;
$$ LANGUAGE plpgsql;

-- 自動パーティション管理の改善
CREATE OR REPLACE FUNCTION maintain_partitions_advanced()
RETURNS void AS $$
DECLARE
    tables_config jsonb := '[
        {"table": "audit_logs_partitioned", "retention_months": 12, "advance_months": 2},
        {"table": "metrics_partitioned", "retention_months": 6, "advance_months": 1}
    ]'::jsonb;
    config jsonb;
    table_name text;
    retention_months int;
    advance_months int;
    cutoff_date date;
    future_date date;
BEGIN
    FOR config IN SELECT jsonb_array_elements(tables_config)
    LOOP
        table_name := config->>'table';
        retention_months := (config->>'retention_months')::int;
        advance_months := (config->>'advance_months')::int;

        -- 未来のパーティション作成
        future_date := date_trunc('month', CURRENT_DATE +
                      INTERVAL '1 month' * advance_months);

        FOR i IN 0..advance_months-1 LOOP
            PERFORM create_optimized_partition(
                table_name,
                future_date + INTERVAL '1 month' * i
            );
        END LOOP;

        -- 古いパーティション削除
        cutoff_date := date_trunc('month', CURRENT_DATE -
                      INTERVAL '1 month' * retention_months);

        -- 削除対象パーティション取得と削除
        FOR partition_name IN
            SELECT tablename
            FROM pg_tables
            WHERE tablename ~ ('^' || table_name || '_y\d{4}_m\d{2}$')
            AND to_date(
                substring(tablename from '\d{4}_m\d{2}$'),
                'YYYY_"m"MM'
            ) < cutoff_date
        LOOP
            EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', partition_name);
            RAISE NOTICE 'Dropped old partition: %', partition_name;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- パーティション健康度チェック
CREATE OR REPLACE FUNCTION check_partition_health()
RETURNS TABLE(
    table_name text,
    partition_count bigint,
    total_size text,
    avg_partition_size text,
    oldest_partition text,
    newest_partition text,
    issues text[]
) AS $$
BEGIN
    RETURN QUERY
    WITH partition_info AS (
        SELECT
            substring(tablename from '^(.+)_y\d{4}_m\d{2}$') as base_table,
            tablename,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
            to_date(substring(tablename from '\d{4}_m\d{2}$'), 'YYYY_"m"MM') as partition_date
        FROM pg_tables
        WHERE tablename ~ '_y\d{4}_m\d{2}$'
    ),
    partition_stats AS (
        SELECT
            base_table,
            count(*) as partition_count,
            sum(size_bytes) as total_size_bytes,
            avg(size_bytes) as avg_size_bytes,
            min(partition_date) as oldest_date,
            max(partition_date) as newest_date,
            array_agg(
                CASE
                    WHEN size_bytes = 0 THEN 'Empty partition: ' || tablename
                    WHEN size_bytes > avg(size_bytes) OVER () * 3 THEN 'Oversized partition: ' || tablename
                END
            ) FILTER (WHERE size_bytes = 0 OR size_bytes > avg(size_bytes) OVER () * 3) as issues
        FROM partition_info
        GROUP BY base_table
    )
    SELECT
        base_table,
        partition_count,
        pg_size_pretty(total_size_bytes),
        pg_size_pretty(avg_size_bytes::bigint),
        oldest_date::text,
        newest_date::text,
        COALESCE(issues, ARRAY[]::text[])
    FROM partition_stats;
END;
$$ LANGUAGE plpgsql;
```

### PostgREST 最適化の問題

#### 問題3: PostgREST 接続プール枯渇

**症状**:
- `connection timeout` エラー
- `too many connections` エラー
- レスポンス時間の増加

**診断手順**:
```bash
# PostgreSQL 接続状況確認
psql -c "
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    state_change,
    query_start,
    LEFT(query, 50) as query_preview
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start DESC;
"

# PostgREST プロセス確認
ps aux | grep postgrest
netstat -tlnp | grep :3000

# 接続プール状況
curl -s http://localhost:3000/ | jq '.connection_pool'
```

**解決策**:
```toml
# postgrest_optimized.conf
# 接続プール最適化
db-pool = 25
db-pool-timeout = 30
db-pool-max-lifetime = 3600

# パフォーマンス設定
max-rows = 2000
db-plan-enabled = true
db-prepared-statements = true

# ログとデバッグ
log-level = "info"
server-trace-header = "X-Request-Id"

# セキュリティ設定強化
jwt-secret-is-base64 = false
jwt-aud = "authenticated"
```

```python
# PostgREST 接続プール監視
import psycopg2
import time
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

class PostgRESTConnectionMonitor:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.connection_history: List[Dict] = []

    def check_connection_pool_status(self) -> Dict:
        """接続プール状況確認"""

        try:
            with psycopg2.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    # アクティブ接続数
                    cur.execute("""
                        SELECT
                            count(*) as total_connections,
                            count(*) FILTER (WHERE state = 'active') as active_connections,
                            count(*) FILTER (WHERE state = 'idle') as idle_connections,
                            count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
                            count(*) FILTER (WHERE application_name = 'postgrest') as postgrest_connections
                        FROM pg_stat_activity
                        WHERE pid != pg_backend_pid()
                    """)

                    stats = cur.fetchone()

                    # 最大接続数
                    cur.execute("SHOW max_connections")
                    max_connections = int(cur.fetchone()[0])

                    # 長時間実行クエリ
                    cur.execute("""
                        SELECT
                            pid,
                            now() - query_start as duration,
                            left(query, 100) as query_preview
                        FROM pg_stat_activity
                        WHERE state = 'active'
                        AND now() - query_start > interval '30 seconds'
                        ORDER BY query_start
                    """)

                    long_running = cur.fetchall()

                    status = {
                        'timestamp': time.time(),
                        'total_connections': stats[0],
                        'active_connections': stats[1],
                        'idle_connections': stats[2],
                        'idle_in_transaction': stats[3],
                        'postgrest_connections': stats[4],
                        'max_connections': max_connections,
                        'connection_usage_percent': (stats[0] / max_connections) * 100,
                        'long_running_queries': len(long_running),
                        'long_running_details': [
                            {
                                'pid': row[0],
                                'duration_seconds': row[1].total_seconds(),
                                'query': row[2]
                            }
                            for row in long_running
                        ]
                    }

                    self.connection_history.append(status)

                    # 履歴サイズ制限
                    if len(self.connection_history) > 1000:
                        self.connection_history = self.connection_history[-500:]

                    # アラート判定
                    self._check_connection_alerts(status)

                    return status

        except Exception as e:
            logger.error(f"Failed to check connection status: {e}")
            return {'error': str(e)}

    def _check_connection_alerts(self, status: Dict):
        """接続アラート確認"""

        usage_percent = status['connection_usage_percent']
        long_running = status['long_running_queries']
        idle_in_transaction = status['idle_in_transaction']

        if usage_percent > 80:
            logger.warning(f"High connection usage: {usage_percent:.1f}%")

        if long_running > 5:
            logger.warning(f"Many long-running queries: {long_running}")

        if idle_in_transaction > 10:
            logger.warning(f"Many idle in transaction: {idle_in_transaction}")

    def get_connection_trends(self, hours: int = 24) -> Dict:
        """接続トレンド分析"""

        cutoff_time = time.time() - (hours * 3600)
        recent_history = [
            h for h in self.connection_history
            if h['timestamp'] > cutoff_time
        ]

        if not recent_history:
            return {'error': 'No recent history available'}

        return {
            'period_hours': hours,
            'max_usage_percent': max(h['connection_usage_percent'] for h in recent_history),
            'avg_usage_percent': sum(h['connection_usage_percent'] for h in recent_history) / len(recent_history),
            'max_active_connections': max(h['active_connections'] for h in recent_history),
            'avg_active_connections': sum(h['active_connections'] for h in recent_history) / len(recent_history),
            'total_long_running_incidents': sum(1 for h in recent_history if h['long_running_queries'] > 0),
            'max_long_running_queries': max(h['long_running_queries'] for h in recent_history)
        }

# 定期監視
monitor = PostgRESTConnectionMonitor(DATABASE_URL)

async def periodic_connection_monitoring():
    while True:
        status = monitor.check_connection_pool_status()
        logger.info(f"Connection pool status: {status}")

        if status.get('connection_usage_percent', 0) > 90:
            # 緊急時の接続解放
            await emergency_connection_cleanup()

        await asyncio.sleep(60)  # 1分間隔

async def emergency_connection_cleanup():
    """緊急時接続クリーンアップ"""
    logger.warning("Initiating emergency connection cleanup")

    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # 長時間アイドル接続を終了
                cur.execute("""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE state = 'idle'
                    AND state_change < now() - interval '10 minutes'
                    AND pid != pg_backend_pid()
                    AND application_name = 'postgrest'
                """)

                terminated = cur.rowcount
                logger.warning(f"Terminated {terminated} idle connections")

    except Exception as e:
        logger.error(f"Emergency cleanup failed: {e}")
```

#### 問題4: クエリパフォーマンス低下

**症状**:
- PostgREST クエリの応答が遅い
- 複雑な embedded resources が重い
- フィルタリングが効かない

**診断・解決策**:
```python
# PostgREST クエリ最適化ツール
class PostgRESTQueryOptimizer:
    @staticmethod
    def optimize_embedded_resources(
        base_table: str,
        embedded_config: Dict[str, Dict]
    ) -> str:
        """埋め込みリソース最適化"""

        optimized_parts = []

        for resource, config in embedded_config.items():
            # 必要最小限のフィールドのみ選択
            fields = config.get('fields', ['id', 'name'])

            # フィルタリング条件追加
            filters = config.get('filters', {})

            # 制限数設定
            limit = config.get('limit', 50)

            # 最適化された埋め込みクエリ構築
            embed_query = f"{resource}({','.join(fields)}"

            if filters:
                filter_parts = []
                for key, value in filters.items():
                    if isinstance(value, list):
                        filter_parts.append(f"{key}.in.({','.join(map(str, value))})")
                    else:
                        filter_parts.append(f"{key}.eq.{value}")

                if filter_parts:
                    embed_query += "?" + "&".join(filter_parts)

            embed_query += f"&limit={limit})"
            optimized_parts.append(embed_query)

        return ",".join(optimized_parts)

    @staticmethod
    def build_efficient_filter(filters: Dict) -> str:
        """効率的フィルター構築"""

        filter_parts = []

        for key, value in filters.items():
            if isinstance(value, dict):
                # 範囲検索等
                for op, val in value.items():
                    if op == 'between':
                        filter_parts.append(f"{key}.gte.{val[0]}")
                        filter_parts.append(f"{key}.lte.{val[1]}")
                    else:
                        filter_parts.append(f"{key}.{op}.{val}")

            elif isinstance(value, list):
                # IN句 - 効率的
                if len(value) <= 100:  # PostgreSQL の IN 制限考慮
                    filter_parts.append(f"{key}.in.({','.join(map(str, value))})")
                else:
                    # 大きなリストは分割
                    chunks = [value[i:i+100] for i in range(0, len(value), 100)]
                    or_conditions = []
                    for chunk in chunks:
                        or_conditions.append(f"{key}.in.({','.join(map(str, chunk))})")
                    filter_parts.append(f"or.({','.join(or_conditions)})")

            else:
                filter_parts.append(f"{key}.eq.{value}")

        return "&".join(filter_parts)

# 使用例
optimizer = PostgRESTQueryOptimizer()

# 最適化されたクエリ構築例
optimized_query = optimizer.build_efficient_filter({
    'status': ['active', 'pending'],
    'created_at': {'gte': '2024-01-01', 'lt': '2024-12-31'},
    'organization_id': 123
})

embedded_resources = optimizer.optimize_embedded_resources(
    'projects',
    {
        'assignee': {
            'fields': ['id', 'name', 'email'],
            'filters': {'is_active': True},
            'limit': 1
        },
        'organization': {
            'fields': ['id', 'name'],
            'limit': 1
        }
    }
)
```

### アプリケーション レベル最適化の問題

#### 問題5: メモリリークとガベージコレクション

**症状**:
- アプリケーションのメモリ使用量が増加し続ける
- ガベージコレクションの頻度が高い
- レスポンス時間が徐々に悪化

**診断手順**:
```python
# メモリ使用量監視
import psutil
import gc
import tracemalloc
from typing import Dict, List
import time
import logging

logger = logging.getLogger(__name__)

class MemoryMonitor:
    def __init__(self):
        self.snapshots: List[Dict] = []
        self.gc_stats: List[Dict] = []
        tracemalloc.start()

    def take_snapshot(self, label: str = "default") -> Dict:
        """メモリスナップショット取得"""

        # システムメモリ情報
        process = psutil.Process()
        memory_info = process.memory_info()

        # Python メモリ情報
        snapshot = tracemalloc.take_snapshot()
        top_stats = snapshot.statistics('lineno')

        # ガベージコレクション統計
        gc_counts = gc.get_count()
        gc_stats = gc.get_stats()

        snapshot_data = {
            'timestamp': time.time(),
            'label': label,
            'rss_mb': memory_info.rss / 1024 / 1024,
            'vms_mb': memory_info.vms / 1024 / 1024,
            'percent': process.memory_percent(),
            'gc_counts': gc_counts,
            'gc_stats': gc_stats,
            'top_memory_locations': [
                {
                    'file': stat.traceback.format()[0],
                    'size_mb': stat.size / 1024 / 1024,
                    'count': stat.count
                }
                for stat in top_stats[:10]
            ]
        }

        self.snapshots.append(snapshot_data)

        # スナップショット履歴制限
        if len(self.snapshots) > 100:
            self.snapshots = self.snapshots[-50:]

        return snapshot_data

    def detect_memory_leaks(self) -> List[Dict]:
        """メモリリーク検出"""

        if len(self.snapshots) < 5:
            return []

        leaks = []
        recent_snapshots = self.snapshots[-5:]

        # メモリ使用量トレンド分析
        rss_values = [s['rss_mb'] for s in recent_snapshots]
        rss_trend = (rss_values[-1] - rss_values[0]) / len(rss_values)

        if rss_trend > 10:  # 10MB/snapshot 以上の増加
            leaks.append({
                'type': 'memory_growth',
                'severity': 'high' if rss_trend > 50 else 'medium',
                'description': f'Memory growing by {rss_trend:.1f}MB per snapshot',
                'trend_mb_per_snapshot': rss_trend
            })

        # ガベージコレクション頻度チェック
        gc_gen2_counts = [s['gc_counts'][2] for s in recent_snapshots]
        gc_frequency = gc_gen2_counts[-1] - gc_gen2_counts[0]

        if gc_frequency > 100:
            leaks.append({
                'type': 'excessive_gc',
                'severity': 'medium',
                'description': f'High GC frequency: {gc_frequency} generation-2 collections',
                'gc_frequency': gc_frequency
            })

        # 特定ファイルのメモリ増加
        if len(self.snapshots) >= 2:
            current_locations = {
                loc['file']: loc['size_mb']
                for loc in self.snapshots[-1]['top_memory_locations']
            }
            previous_locations = {
                loc['file']: loc['size_mb']
                for loc in self.snapshots[-2]['top_memory_locations']
            }

            for file_path, current_size in current_locations.items():
                previous_size = previous_locations.get(file_path, 0)
                growth = current_size - previous_size

                if growth > 5:  # 5MB以上の増加
                    leaks.append({
                        'type': 'file_memory_growth',
                        'severity': 'medium',
                        'description': f'Memory growth in {file_path}: +{growth:.1f}MB',
                        'file': file_path,
                        'growth_mb': growth
                    })

        return leaks

    def optimize_memory_usage(self):
        """メモリ使用量最適化"""

        logger.info("Starting memory optimization...")

        # 強制ガベージコレクション
        before_gc = psutil.Process().memory_info().rss / 1024 / 1024

        collected = gc.collect()

        after_gc = psutil.Process().memory_info().rss / 1024 / 1024
        freed_mb = before_gc - after_gc

        logger.info(f"Garbage collection: {collected} objects collected, {freed_mb:.1f}MB freed")

        # キャッシュクリア（アプリケーション固有）
        try:
            from app.core.cache import cache
            cache.clear()
            logger.info("Application cache cleared")
        except ImportError:
            pass

        # SQLAlchemy セッションプールクリア
        try:
            from app.core.database import engine
            engine.dispose()
            logger.info("Database connection pool refreshed")
        except ImportError:
            pass

        return {
            'objects_collected': collected,
            'memory_freed_mb': freed_mb,
            'current_memory_mb': after_gc
        }

# 定期メモリ監視
memory_monitor = MemoryMonitor()

async def periodic_memory_monitoring():
    """定期メモリ監視"""

    while True:
        snapshot = memory_monitor.take_snapshot()
        logger.info(f"Memory usage: {snapshot['rss_mb']:.1f}MB ({snapshot['percent']:.1f}%)")

        # メモリリーク検出
        leaks = memory_monitor.detect_memory_leaks()

        for leak in leaks:
            if leak['severity'] == 'high':
                logger.error(f"Memory leak detected: {leak['description']}")

                # 緊急時最適化
                memory_monitor.optimize_memory_usage()

            else:
                logger.warning(f"Memory issue: {leak['description']}")

        # メモリ使用量が80%を超えた場合の対応
        if snapshot['percent'] > 80:
            logger.warning("High memory usage detected, running optimization...")
            memory_monitor.optimize_memory_usage()

        await asyncio.sleep(300)  # 5分間隔
```

### 包括的パフォーマンス診断

```python
# 統合パフォーマンス診断システム
class ComprehensivePerformanceDiagnostics:
    def __init__(self):
        self.db_diagnostics = DatabaseDiagnostics()
        self.memory_monitor = MemoryMonitor()
        self.query_monitor = QueryDiagnostics()

    async def full_system_diagnosis(self) -> Dict:
        """フルシステム診断"""

        logger.info("Starting comprehensive performance diagnosis...")

        # 1. データベース診断
        db_status = await self.db_diagnostics.diagnose_database_connection()

        # 2. メモリ診断
        memory_snapshot = self.memory_monitor.take_snapshot("diagnosis")
        memory_leaks = self.memory_monitor.detect_memory_leaks()

        # 3. クエリパフォーマンス
        query_analysis = self.query_monitor.analyze_queries()

        # 4. システムリソース
        system_stats = {
            'cpu_percent': psutil.cpu_percent(interval=1),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_percent': psutil.disk_usage('/').percent,
            'load_average': psutil.getloadavg() if hasattr(psutil, 'getloadavg') else None
        }

        # 5. 総合評価
        performance_score = self._calculate_performance_score({
            'db_healthy': db_status,
            'memory_usage': memory_snapshot['percent'],
            'memory_leaks': len(memory_leaks),
            'system_stats': system_stats
        })

        diagnosis_result = {
            'timestamp': time.time(),
            'performance_score': performance_score,
            'database': {
                'status': db_status,
                'connection_pool': 'healthy' if db_status else 'unhealthy'
            },
            'memory': {
                'current_usage_mb': memory_snapshot['rss_mb'],
                'usage_percent': memory_snapshot['percent'],
                'leaks_detected': len(memory_leaks),
                'leak_details': memory_leaks
            },
            'queries': query_analysis,
            'system': system_stats,
            'recommendations': self._generate_recommendations({
                'memory_leaks': memory_leaks,
                'system_stats': system_stats,
                'query_analysis': query_analysis
            })
        }

        return diagnosis_result

    def _calculate_performance_score(self, metrics: Dict) -> int:
        """パフォーマンススコア計算 (0-100)"""

        score = 100

        # データベース健康度
        if not metrics['db_healthy']:
            score -= 30

        # メモリ使用率
        memory_usage = metrics['memory_usage']
        if memory_usage > 90:
            score -= 25
        elif memory_usage > 80:
            score -= 15
        elif memory_usage > 70:
            score -= 5

        # メモリリーク
        memory_leaks = metrics['memory_leaks']
        if memory_leaks > 0:
            score -= min(memory_leaks * 10, 20)

        # CPU 使用率
        cpu_usage = metrics['system_stats']['cpu_percent']
        if cpu_usage > 90:
            score -= 20
        elif cpu_usage > 80:
            score -= 10

        return max(score, 0)

    def _generate_recommendations(self, metrics: Dict) -> List[str]:
        """改善推奨事項生成"""

        recommendations = []

        # メモリリーク対応
        if metrics['memory_leaks']:
            recommendations.append("メモリリークが検出されました。アプリケーションの再起動を検討してください。")
            recommendations.append("オブジェクトの適切な解放とガベージコレクションの確認が必要です。")

        # CPU 使用率
        cpu_usage = metrics['system_stats']['cpu_percent']
        if cpu_usage > 80:
            recommendations.append("CPU 使用率が高い状態です。水平スケーリングまたはインスタンス性能向上を検討してください。")

        # ディスク使用率
        disk_usage = metrics['system_stats']['disk_percent']
        if disk_usage > 85:
            recommendations.append("ディスク使用率が高い状態です。不要ファイルの削除やディスク拡張を検討してください。")

        # クエリパフォーマンス
        query_analysis = metrics.get('query_analysis', {})
        if query_analysis.get('n_plus_one_patterns'):
            recommendations.append("N+1クエリ問題が検出されました。eager loadingの実装を検討してください。")

        if not recommendations:
            recommendations.append("現在、パフォーマンスに大きな問題は検出されていません。")

        return recommendations

# 使用例
diagnostics = ComprehensivePerformanceDiagnostics()

async def run_performance_check():
    result = await diagnostics.full_system_diagnosis()

    print(f"Performance Score: {result['performance_score']}/100")
    print("\nRecommendations:")
    for rec in result['recommendations']:
        print(f"- {rec}")

    return result
```

---

## まとめ

第6章では、Supabase アプリケーションの包括的なパフォーマンス最適化手法を解説しました。

**主要な最適化領域**:

- **データベース**: インデックス戦略、パーティショニング、クエリ最適化
- **PostgREST**: 設定チューニング、クエリ最適化、キャッシュ戦略
- **クライアント**: キャッシュ管理、リアルタイム最適化
- **監視**: メトリクス収集、継続的改善プロセス

---

## 章末演習・確認事項

### 演習問題

1. **インデックス設計**
   ```sql
   -- 以下のクエリに対して最適なインデックスを設計してください
   SELECT u.name, COUNT(o.id) as order_count
   FROM users u
   LEFT JOIN orders o ON u.id = o.user_id
   WHERE u.created_at > '2024-01-01'
   AND o.status = 'completed'
   GROUP BY u.id, u.name
   ORDER BY order_count DESC;
   ```

2. **パーティショニング戦略**
   - 月間100万レコード増加するログテーブルのパーティショニング戦略を設計してください
   - 古いデータの削除戦略も含めてください

3. **PostgREST クエリ最適化**
   - 以下のPostgREST クエリを最適化してください
   ```text
   /api/products?select=*&category=electronics&order=created_at.desc&limit=50
   ```

4. **キャッシュ戦略実装**
   - ユーザープロファイル情報のキャッシュ戦略を実装してください
   - 更新タイミングと無効化戦略を含めてください

5. **パフォーマンス分析**
   - 提供されたEXPLAIN ANALYZE結果から性能課題を特定し、改善案を提示してください

### 確認事項

**データベース最適化**

- [] PostgreSQL のEXPLAIN ANALYZEが読める
- [] インデックス設計の基本原則を理解している
- [] パーティショニングの適用場面を判断できる
- [] VACUUMとANALYZEの重要性を理解している
- [] JSONBインデックス（GIN）の使い方を知っている

**PostgREST 最適化**

- [] PostgREST の設定パラメータを理解している
- [] 効率的なクエリパターンを知っている
- [] embedded resourcesの最適化ができる
- [] キャッシュ戦略を実装できる

**クライアント最適化**

- [] クライアントサイドキャッシュを実装できる
- [] リアルタイム更新の最適化手法を知っている
- [] バッチ処理と UI 更新の最適化ができる

**監視・測定**

- [] システムメトリクスを収集できる
- [] パフォーマンストラッキングを実装できる
- [] 自動最適化アドバイザーを活用できる
- [] 継続的改善プロセスを構築できる

### 実践課題

1. **実際のパフォーマンス測定**
   - 既存のアプリケーションでパフォーマンス測定を実施
   - ボトルネックを特定し、改善計画を立案

2. **最適化実装**
   - 特定した課題に対する最適化を実装
   - 実装前後の性能比較を実施

3. **監視システム構築**
   - 継続的なパフォーマンス監視システムを構築
   - アラートとレポート機能を実装

### 推奨学習時間

- PostgreSQL 最適化: 8〜10時間
- PostgREST 最適化: 4〜6時間
- クライアント最適化: 6〜8時間
- 監視システム: 4〜6時間
- 実践課題: 8〜12時間

**合計: 30〜42時間**

### 成果物チェックリスト

実装完了時に以下を確認してください：

- [] データベースインデックスが適切に設計されている
- [] パーティショニング戦略が実装されている
- [] PostgREST が最適化されている
- [] クライアントキャッシュが実装されている
- [] パフォーマンス監視が動作している
- [] 自動最適化プロセスが構築されている
- [] ドキュメントが整備されている

## 第6章 学習まとめ

### [OK] **習得できたスキル**
- [OK] PostgreSQL インデックス設計とクエリ最適化
- [OK] テーブルパーティショニングによる大規模データ処理
- [OK] PostgREST API パフォーマンス・チューニング
- [OK] 多層キャッシュ戦略とクライアント最適化
- [OK] システム監視・自動最適化システム構築

### **パフォーマンス最適化の全体像**
| 最適化レイヤー | 主要技術 | パフォーマンス向上率 | 実装難易度 |
|:-------------|:-------|:------------------|:---------|
| **データベース**| インデックス・パーティション | 10〜100倍 |  中級 |
| **API**| PostgREST 設定・キャッシュ | 2〜10倍 |  基礎 |
| **クライアント**| ローカルキャッシュ・バッチ | 2〜5倍 |  基礎 |
| **監視・自動化**| メトリクス・アラート | 継続改善 |  上級 |

### **次の学習ステップ**
第7章で学ぶセキュリティ強化の前提知識：
- [OK] システム性能監視の重要性理解（セキュリティ監視への応用）
- [OK] データベース設計の最適化経験（セキュリティ要件への対応）
- [OK] API パフォーマンス測定技術（セキュリティ負荷の監視）
- [OK] 自動化プロセス構築経験（セキュリティ自動対応への応用）

---

## 次章予告：セキュリティ強化

第7章では、「**銀行の金庫システム**」並みの堅牢なセキュリティを実装します：
- **多層防御**: ネットワーク・アプリケーション・データベース各層でのセキュリティ
- **高度な認証**: 多要素認証・OAuth・SAML によるエンタープライズ認証
- [CRITICAL] **脅威検知**: リアルタイムセキュリティ監視と自動対応システム
- **コンプライアンス**: GDPR・SOC2・ISO27001 対応のセキュリティ実装

**実装目標**: 「金融機関レベルのセキュリティ要件をクリアするSaaS プラットフォーム」

---

**ナビゲーション**
- **目次**: [はじめに]({{ '/introduction/' | relative_url }})
- **前の章**: [第5-4章：RAG/ベクトル検索アーキテクチャ]({{ '/chapters/chapter05-4/' | relative_url }})
- **次の章**: [第7章：セキュリティ強化]({{ '/chapters/chapter07/' | relative_url }})
- **関連章**: [第5-1章：パターン3 - 独立 API サーバー]({{ '/chapters/chapter05-1/' | relative_url }}) | [第8章：運用監視と自動化]({{ '/chapters/chapter08/' | relative_url }})
- **リソース**: [動作検証]({{ '/guides/code-verification/' | relative_url }}) | [パフォーマンス・チェックリスト]({{ '/appendices/appendix01/' | relative_url }}#operational-checklists)
