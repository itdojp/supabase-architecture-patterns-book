# 統合トラブルシューティング・FAQ 🔧

---
**📚 目次に戻る**: [📖 学習ガイド](./textbook_index.md)  
**🎯 用途**: 学習・開発中の問題迅速解決・エラー対応  
**📝 対象**: 全レベル（問題解決・デバッグスキル向上）  
**⏱️ 利用方法**: 問題発生時の即座参照・段階的解決  
---

## 🚨 緊急時対応フローチャート

### 💊 **症状別診断システム**

```
🏥 Supabase障害診断フローチャート

🤒 症状: アプリが動かない
├── 📡 接続エラー → [A. 接続問題](#一般的な問題と解決策)
├── 🔐 認証エラー → [B. 認証問題](#接続・認証問題)  
├── 📊 データエラー → [C. データベース問題](#row-level-security-rls-問題)
├── ⚡ 速度問題 → [D. パフォーマンス問題](#パフォーマンス問題)
└── 🔧 開発エラー → [E. 開発環境問題](#開発環境問題)

🩺 重症度判定:
🟢 軽微（自己解決可能）
🟡 中度（1〜2時間で解決）  
🔴 重大（即座対応必要）
⚫ 緊急（業務停止レベル）
```

> **Supabase実践アーキテクチャパターン** 1.0版 | 株式会社アイティードゥ | 2025年6月2日

## 目次

1. [一般的な問題と解決策](#一般的な問題と解決策)
2. [接続・認証問題](#接続・認証問題)
3. [Row Level Security (RLS) 問題](#row-level-security-rls-問題)
4. [パフォーマンス問題](#パフォーマンス問題)
5. [リアルタイム機能問題](#リアルタイム機能問題)
6. [Edge Functions問題](#edge-functions問題)
7. [デプロイメント問題](#デプロイメント問題)
8. [エラーコード一覧](#エラーコード一覧)
9. [診断ツール](#診断ツール)

---

## 一般的な問題と解決策

### 問題: Supabaseに接続できない

**症状**:
- 接続タイムアウト
- 「Failed to connect to Supabase」エラー

**原因と解決策**:

1. **URL・キーの間違い**
   ```javascript
   // ✗ 間違い
   const supabase = createClient('wrong-url', 'wrong-key')
   
   // ✓ 正しい
   const supabase = createClient(
     'https://your-project.supabase.co',
     'sb_publishable_XXXXXXXXXXXXXXXX'
   )
   ```

2. **環境変数の設定ミス**
   ```bash
   # .env.local を確認
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXXXXXXXXXX
   ```

3. **CORS設定の問題**
   - Supabaseダッシュボード → Settings → API → CORS Origins
   - 開発環境: `http://localhost:3000`
   - 本番環境: `https://yourdomain.com`

**診断コマンド**:
```bash
# 接続テスト（apikey は publishable key）
curl -H "apikey: YOUR_PUBLISHABLE_KEY" \
     "https://your-project.supabase.co/rest/v1/your_table?select=*&limit=1"
```

### 問題: 「Table doesn't exist」エラー

**症状**:
- `relation "your_table" does not exist`

**解決策**:

1. **テーブル作成確認**
   ```sql
   -- SQL Editor でテーブル存在確認
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

2. **スキーマ確認**
   ```sql
   -- 正しいスキーマでアクセス
   SELECT * FROM public.your_table;
   ```

3. **マイグレーション実行**
   ```bash
   # Supabase CLI使用時
   supabase db reset
   supabase migration up
   ```

---

## 接続・認証問題

### 問題: JWTトークンエラー

**症状**:
- `Invalid JWT token`
- `JWT expired`

**解決策**:

1. **トークン有効期限確認**
   ```javascript
   // トークンの有効期限をチェック
   const { data: { session } } = await supabase.auth.getSession()
   if (session?.expires_at) {
     const expiry = new Date(session.expires_at * 1000)
     console.log('Token expires at:', expiry)
   }
   ```

2. **自動リフレッシュ設定**
   ```javascript
   // 自動リフレッシュを有効化
   const { data: { subscription } } = supabase.auth.onAuthStateChange(
     (event, session) => {
       if (event === 'TOKEN_REFRESHED') {
         console.log('Token refreshed:', session)
       }
     }
   )
   ```

3. **手動リフレッシュ**
   ```javascript
   const { data, error } = await supabase.auth.refreshSession()
   if (error) console.error('Refresh failed:', error)
   ```

### 問題: サインアップできない

**症状**:
- `Email not confirmed`
- `Signup disabled`

**解決策**:

1. **メール確認設定チェック**
   - Dashboard → Authentication → Settings
   - "Enable email confirmations" の状態確認

2. **メールテンプレート確認**
   - Dashboard → Authentication → Email Templates
   - 正しいリダイレクトURLを設定

3. **開発環境でのメール確認スキップ**
   ```sql
   -- 開発時のみ使用
   UPDATE auth.users SET email_confirmed_at = NOW() 
   WHERE email = 'test@example.com';
   ```

---

## Row Level Security (RLS) 問題

### 問題: データが取得できない

**症状**:
- 空の結果が返される
- `Permission denied` エラー

**解決策**:

1. **RLS状態確認**
   ```sql
   -- テーブルのRLS状態確認
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'your_table';
   ```

2. **ポリシー一覧確認**
   ```sql
   -- 適用されているポリシー確認
   SELECT schemaname, tablename, policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'your_table';
   ```

3. **ポリシーテスト**
   ```sql
   -- 管理者として直接テスト
   SET LOCAL ROLE service_role;
   SELECT * FROM your_table;
   ```

4. **デバッグポリシー作成**
   ```sql
   -- 一時的にすべて許可するポリシー
   CREATE POLICY "debug_allow_all" ON your_table 
   FOR ALL USING (true);
   ```

### 問題: ポリシーが機能しない

**症状**:
- 想定と異なるアクセス制御

**診断方法**:

1. **ユーザーIDの確認**
   ```sql
   -- 現在のユーザーID確認
   SELECT auth.uid();
   ```

2. **ポリシー条件のテスト**
   ```sql
   -- ポリシー条件を個別にテスト
   SELECT auth.uid() = user_id as has_access
   FROM your_table 
   WHERE id = 'specific-record-id';
   ```

3. **段階的ポリシー作成**
   ```sql
   -- シンプルなポリシーから始める
   CREATE POLICY "simple_test" ON your_table 
   FOR SELECT USING (auth.uid() IS NOT NULL);
   ```

---

## パフォーマンス問題

### 問題: クエリが遅い

**症状**:
- リクエストに数秒かかる
- タイムアウトエラー

**診断ツール**:

1. **クエリプラン確認**
   ```sql
   -- 実行計画確認
   EXPLAIN ANALYZE SELECT * FROM your_table 
   WHERE column = 'value';
   ```

2. **スロークエリ特定**
   ```sql
   -- pg_stat_statements拡張を有効化
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   
   -- スロークエリ一覧
   SELECT query, calls, total_time, mean_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

**解決策**:

1. **インデックス追加**
   ```sql
   -- よく使用されるカラムにインデックス
   CREATE INDEX idx_your_table_column ON your_table(column);
   
   -- 複合インデックス
   CREATE INDEX idx_your_table_multi ON your_table(col1, col2);
   ```

2. **クエリ最適化**
   ```javascript
   // ✗ 非効率
   const { data } = await supabase
     .from('posts')
     .select('*')
   
   // ✓ 効率的
   const { data } = await supabase
     .from('posts')
     .select('id, title, created_at')
     .limit(10)
   ```

3. **パーティション化**
   ```sql
   -- 大きなテーブルのパーティション化
   CREATE TABLE logs_2024 PARTITION OF logs
   FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
   ```

### 問題: メモリ不足エラー

**症状**:
- `out of memory` エラー
- 接続数制限エラー

**解決策**:

1. **接続プール設定**
   ```javascript
   // 接続プール使用
   const { createClient } = require('@supabase/supabase-js')
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_SECRET_KEY,
     {
       db: {
         schema: 'public',
       },
       auth: {
         autoRefreshToken: false,
         persistSession: false
       }
     }
   )
   ```

2. **バッチ処理**
   ```javascript
   // 大量データ処理を分割
   const batchSize = 1000
   for (let i = 0; i < totalRecords; i += batchSize) {
     const batch = records.slice(i, i + batchSize)
     await supabase.from('table').insert(batch)
     await new Promise(resolve => setTimeout(resolve, 100)) // 短い休憩
   }
   ```

---

## リアルタイム機能問題

### 問題: リアルタイム更新が受信されない

**症状**:
- データ変更が即座に反映されない
- WebSocket接続エラー

**解決策**:

1. **リアルタイム設定確認**
   ```sql
   -- テーブルでリアルタイムを有効化
   ALTER TABLE your_table REPLICA IDENTITY DEFAULT;
   ```

2. **サブスクリプション確認**
   ```javascript
   // 正しいサブスクリプション設定
   const subscription = supabase
     .channel('your-channel')
     .on('postgres_changes', {
       event: '*',
       schema: 'public',
       table: 'your_table'
     }, (payload) => {
       console.log('Change received!', payload)
     })
     .subscribe((status) => {
       console.log('Subscription status:', status)
     })
   ```

3. **フィルター確認**
   ```javascript
   // フィルター付きサブスクリプション
   const subscription = supabase
     .channel('filtered-channel')
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'your_table',
       filter: 'user_id=eq.' + userId
     }, handleInsert)
     .subscribe()
   ```

### 問題: WebSocket接続が切断される

**解決策**:

1. **接続監視と再接続**
   ```javascript
   let subscription = null
   
   function setupSubscription() {
     subscription = supabase
       .channel('my-channel')
       .on('postgres_changes', { /*...*/ }, handleChange)
       .subscribe((status) => {
         if (status === 'CLOSED') {
           console.log('Connection closed, reconnecting...')
           setTimeout(setupSubscription, 1000)
         }
       })
   }
   
   setupSubscription()
   ```

2. **ハートビート実装**
   ```javascript
   // 定期的にping送信
   setInterval(() => {
     if (subscription) {
       subscription.send({
         type: 'heartbeat'
       })
     }
   }, 30000)
   ```

---

## Edge Functions問題

### 問題: Edge Functionがデプロイできない

**症状**:
- デプロイコマンドが失敗
- 関数が見つからない

**解決策**:

1. **Deno設定確認**
   ```typescript
   // deno.json確認
   {
     "compilerOptions": {
       "allowJs": true,
       "lib": ["deno.window"]
     },
     "importMap": "./import_map.json"
   }
   ```

2. **インポートマップ確認**
   ```json
   // import_map.json
   {
     "imports": {
       "https://deno.land/std@0.177.0/": "https://deno.land/std@0.177.0/"
     }
   }
   ```

3. **権限確認**
   ```bash
   # Supabase CLIでデプロイ
   supabase functions deploy your-function --verify-jwt false
   ```

### 問題: Edge Functionが実行時エラー

**解決策**:

1. **ログ確認**
   ```bash
   # ログ表示
   supabase functions logs your-function
   ```

2. **エラーハンドリング**
   ```typescript
   // エラーハンドリングの実装
   export default async function handler(req: Request) {
     try {
       // 関数の処理
       return new Response(JSON.stringify(result), {
         headers: { 'Content-Type': 'application/json' }
       })
     } catch (error) {
       console.error('Function error:', error)
       return new Response(JSON.stringify({ error: error.message }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' }
       })
     }
   }
   ```

---

## デプロイメント問題

### 問題: Vercel/Netlifyでビルドエラー

**症状**:
- 環境変数が読み込まれない
- ビルド時のエラー

**解決策**:

1. **環境変数設定**
   ```bash
   # Vercel
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   
   # Netlify
   netlify env:set NEXT_PUBLIC_SUPABASE_URL "your-url"
   ```

2. **ビルド設定**
   ```json
   // package.json
   {
     "scripts": {
       "build": "next build",
       "postbuild": "next-sitemap"
     }
   }
   ```

### 問題: 本番環境で動作しない

**解決策**:

1. **CORS設定更新**
   - Dashboard → Settings → API → CORS Origins
   - 本番ドメインを追加

2. **RLS設定確認**
   ```sql
   -- 本番環境でのRLS確認
   SELECT * FROM pg_policies WHERE tablename = 'your_table';
   ```

---

## エラーコード一覧

### 認証関連
- `PGRST301`: JWT token invalid
- `PGRST302`: JWT token expired  
- `42501`: Permission denied

### データベース関連
- `42P01`: Table doesn't exist
- `23505`: Unique violation
- `23503`: Foreign key violation
- `42703`: Column doesn't exist

### リアルタイム関連
- `REALTIME_SUBSCRIPTION_ERROR`: サブスクリプション失敗
- `REALTIME_CONNECTION_FAILED`: WebSocket接続失敗

---

## 診断ツール

### 1. 接続診断スクリプト

```javascript
// connection-test.js
import { createClient } from '@supabase/supabase-js'

async function diagnoseConnection() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY
  )

  try {
    // 1. 基本接続テスト
    const { data, error } = await supabase.from('_metadata').select('*').limit(1)
    console.log('✓ Basic connection successful')

    // 2. 認証テスト
    const { data: authData } = await supabase.auth.getSession()
    console.log('✓ Auth system accessible')

    // 3. リアルタイムテスト
    const channel = supabase.channel('test')
    channel.subscribe((status) => {
      console.log(`✓ Realtime status: ${status}`)
    })

  } catch (error) {
    console.error('✗ Connection failed:', error)
  }
}

diagnoseConnection()
```

### 2. パフォーマンス診断

```sql
-- performance-check.sql
-- 1. データベース統計
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 2. インデックス使用状況
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 3. 未使用インデックス
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

### 3. RLS診断

```sql
-- rls-check.sql
-- 1. RLS有効テーブル一覧
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE rowsecurity = true;

-- 2. ポリシー一覧
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  qual,
  with_check
FROM pg_policies
ORDER BY schemaname, tablename;

-- 3. 現在のユーザー権限確認
SELECT 
  current_user,
  session_user,
  current_setting('role'),
  current_setting('request.jwt.claims', true)::json as jwt_claims;
```

### 4. システムヘルスチェック

```bash
#!/bin/bash
# health-check.sh

echo "=== Supabase Health Check ==="

# 1. API接続確認
echo "1. Testing API connection..."
curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  "$SUPABASE_URL/rest/v1/" | grep -q "200" && echo "✓ API accessible" || echo "✗ API not accessible"

# 2. リアルタイム接続確認
echo "2. Testing Realtime connection..."
curl -s -o /dev/null -w "%{http_code}" \
  "$SUPABASE_URL/realtime/v1/websocket" | grep -q "426" && echo "✓ Realtime accessible" || echo "✗ Realtime not accessible"

# 3. Storage接続確認
echo "3. Testing Storage connection..."
curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  "$SUPABASE_URL/storage/v1/bucket" | grep -q "200" && echo "✓ Storage accessible" || echo "✗ Storage not accessible"

echo "=== Health Check Complete ==="
```

---

## よくある質問 (FAQ)

### Q: データが突然見えなくなった
**A**: RLSポリシーの変更が原因の可能性が高いです。ポリシーを確認し、必要に応じて管理者権限でデータアクセスをテストしてください。

### Q: Edge Functionが遅い
**A**: 冷機動（Cold Start）が原因の可能性があります。関数の初期化処理を最適化し、定期的なpingを検討してください。

### Q: リアルタイム更新が重複する
**A**: 重複排除ロジックを実装し、クライアント側でユニークIDベースの更新管理を行ってください。

### Q: 大量データの処理が失敗する
**A**: バッチ処理に分割し、適切な間隔を設けて処理を実行してください。また、接続プールの設定も確認してください。

---

## サポートリソース

- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Supabaseコミュニティフォーラム](https://github.com/supabase/supabase/discussions)
- [Supabase Discord](https://discord.supabase.com/)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

このトラブルシューティングガイドを参考に、問題の迅速な解決を行ってください。問題が解決しない場合は、より詳細な診断情報と共にサポートチームにお問い合わせください。
