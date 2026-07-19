---
layout: book
order: 4
title: "第2章：認証・認可設計"
---
# 第2章：認証・認可設計

---
- **目次に戻る**: [はじめに]({{ '/introduction/' | relative_url }})
- **前の章**: [第1章：Supabase アーキテクチャ理解]({{ '/chapters/chapter01/' | relative_url }})
- **次の章**: [第3章：パターン1 - クライアントサイド実装]({{ '/chapters/chapter03/' | relative_url }})
- **学習フェーズ**: Part I - 基礎編（認証・認可）
- **学習レベル**:  基礎 |  応用 |  発展
- **推定学習時間**: 3〜4時間
- **難易度**: 基礎（セキュリティ概念の理解が重要）
---

## この章で扱う構成
- 構成: 認証・認可（RLS 中心のセキュリティ設計）
- 推奨用途: ユーザー管理やマルチテナントを扱うアプリ
- 非推奨用途: 完全公開コンテンツのみで認証が不要なケース

## **前章の復習**（第1章からの継続）

第1章で学んだ**Supabase の3つの基本コンポーネント**を振り返りましょう：
- [OK] **PostgreSQL**: データを安全に保存する倉庫
- [OK] **PostgREST**: データベースから自動で API を作成
- [OK] **Realtime**: データ変更をリアルタイムで通知

これらの基盤の上に、今度は**「誰がアクセスできるか」「何をしていいか」**を制御するセキュリティの仕組みを構築します。

> **第1章の理解度確認**: PostgreSQL・PostgREST・Realtime の役割を説明できますか？不安な場合は[第1章]({{ '/chapters/chapter01/' | relative_url }})を復習してください。

## この章で学ぶこと（初心者向け）

この章では、**「誰がアプリを使えるのか」「何ができるのか」**を管理する仕組みを学びます。

- **初心者**: ログイン・ログアウトの基本的な仕組みがわかる
- **中級者**: セキュリティを保つための具体的な方法がわかる
- **上級者**: 企業レベルのセキュリティシステムが設計できる

## 身近な例から：「アパートの管理」に例えてみよう

Web アプリのセキュリティを**アパートの管理**に例えると理解しやすいです：

```mermaid
flowchart TD
    A[ アパート = あなたのWeb アプリ] --> B[ 玄関 = ログイン画面]
    B --> C{ 鍵チェック = 認証}
    C -->|正しい鍵| D[OK 入居者確認]
    C -->|間違った鍵| E[NG 入れません]

    D --> F[ 各部屋 = 機能・データ]
    F --> G{ 部屋の権限 = 認可}
    G -->|自分の部屋| H[OK 自由に使える]
    G -->|他人の部屋| I[NG 入れません]
    G -->|共用部分| J[OK みんなで使える]
```

**用語説明**：
- **認証（Authentication）**: 「あなたは誰ですか？」→ 身元確認
- **認可（Authorization）**: 「何をしていいですか？」→ 権限確認

---

## Supabase Auth：「ログイン・ログアウトを簡単に」

### 従来のログイン機能作成：「大変な手作業」

普通、ログイン機能を作るのはとても大変でした：

#### やることリスト（従来）
```bash
1.  メールアドレス・パスワードの入力画面を作る
2.  パスワードを暗号化する仕組みを作る
3.  ユーザー情報をデータベースに保存する
4.  ログイン状態を管理する仕組みを作る
5.  「ログインしているかどうか」を各画面で確認する
6.  「ログイン期限切れ」の処理を作る
7.  「パスワードを忘れた」機能を作る
8.  セキュリティの穴がないかチェックする
9.  バグがないかテストする
10.  本番環境で安全に動くか確認する
```

**時間**: 数週間〜数ヶ月

#### 実際のコード例（Express.js）

```javascript
// パスワード暗号化
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ユーザー登録（50行以上のコード）
app.post('/signup', async (req, res) => {
  // バリデーション、重複チェック、暗号化...
  // エラーハンドリング、データベース保存...
  // メール認証、レスポンス作成...
});

// ログイン（40行以上のコード）
app.post('/login', async (req, res) => {
  // 認証情報確認、パスワード照合...
  // JWT 生成、セッション管理...
});

// ログイン確認ミドルウェア（30行以上）
const authenticateToken = (req, res, next) => {
  // トークン確認、期限チェック...
  // ユーザー情報取得、権限確認...
};

// パスワードリセット（60行以上のコード）
// ... さらに続く
```

### Supabase Authなら：「3行で完成」

```javascript
// ユーザー登録
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure_password'
});

// ログイン
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure_password'
});

// ログアウト
const { error } = await supabase.auth.signOut();
```

**時間**: 数時間で完成！

### セキュリティを実装しやすくする

Supabase Authが標準機能として支援すること（RLS、API キー管理、メールテンプレート、MFA設定などはプロジェクト側で追加確認が必要）：

| セキュリティ機能 | 従来（手作業） | Supabase Auth |
|:---------------:|:-------------:|:-------------:|
|  **パスワード暗号化**| [WARN] 自分で実装（ミスのリスク） | [OK] 自動で安全な暗号化 |
|  **セッション管理**| [WARN] 複雑な仕組みを自作 | [OK] 自動で期限管理 |
|  **メール認証**| [WARN] メール送信の仕組みを構築 | [OK] 自動でメール送信 |
|  **パスワードリセット**| [WARN] 安全な仕組みを設計 | [OK] 自動で安全な仕組み |
|  **攻撃対策**| [WARN] セキュリティの穴を自分で塞ぐ | [OK] 業界標準の対策を自動実装 |

### いろいろなログイン方式も対応済み

```javascript
//  メール・パスワード
await supabase.auth.signInWithPassword({...});

//  Magic Link（パスワード不要）
await supabase.auth.signInWithOtp({
  email: 'user@example.com'
});

//  Google ログイン
await supabase.auth.signInWithOAuth({
  provider: 'google'
});

//  電話番号
await supabase.auth.signInWithOtp({
  phone: '+81901234567'
});
```

### 従来の認証実装との違い

| 項目 | Supabase Auth | 自前実装 | Firebase Auth | Auth0 |
|------|:-------------:|:--------:|:-------------:|:-----:|
| **実装時間**| [OK] 数時間 | [NG] 数週間 | [OK] 数時間 | [OK] 数時間 |
| **セキュリティ**| [OK] 企業級 | [WARN] 実装依存 | [OK] 企業級 | [OK] 企業級 |
| **カスタマイズ性**| [OK] 高い | [OK] 完全制御 | [WARN] 限定的 | [OK] 高い |
| **コスト**| [OK] 低コスト | [NG] 開発・運用コスト | [WARN] 従量課金 | [NG] 高コスト |
| **DB 統合**| [OK] 完全統合 | [WARN] 手動実装 | [NG] 別システム | [NG] 別システム |

**自前実装の課題解決例**:

```javascript
// 従来の自前実装（Express.js + bcrypt）
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

app.post('/auth/signup', async (req, res) => {
  try {
    // 1. バリデーション（手動実装が必要）
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // 2. 重複チェック（手動実装が必要）
    const existingUser = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // 3. パスワードハッシュ化（手動実装が必要）
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. ユーザー作成（手動実装が必要）
    const userId = uuid.v4();
    await db.query('INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
                   [userId, email, hashedPassword]);

    // 5. メール認証（手動実装が必要）
    const confirmationToken = jwt.sign({ userId }, EMAIL_SECRET, { expiresIn: '24h' });
    await sendConfirmationEmail(email, confirmationToken);

    // 6. レスポンス
    res.status(201).json({ message: 'Please check your email' });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ログイン機能も同様に数十行の実装が必要...
```

```javascript
// Supabase Auth（自動実装）
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure_password'
});

// → バリデーション、重複チェック、ハッシュ化、メール認証が自動実行
// → 実装コードが95%削減
```

### JWT 構造と Supabase 固有クレーム

Supabase Authは JWT RFC 7519準拠のトークンを生成し、PostgreSQL RLS との統合を最適化した独自クレームを含みます。

**標準クレーム**:
```json
{
  "iss": "https://your-project.supabase.co/auth/v1",
  "sub": "user-uuid",
  "aud": "authenticated",
  "exp": 1640995200,
  "iat": 1640908800,
  "email": "user@example.com",
  "phone": "+1234567890"
}
```

**Supabase 固有クレーム**:
```json
{
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  },
  "user_metadata": {
    "display_name": "John Doe",
    "avatar_url": "https://..."
  },
  "role": "authenticated",
  "session_id": "session-uuid"
}
```

### 認可claimの出所と鮮度契約

テナントID、テナント内ロール、権限などの**認可判断に使うclaimは、信頼済みの管理経路だけが更新する `app_metadata` に置きます**。ユーザー本人が更新できる `user_metadata` は表示名・アバター・UI設定などprofile/UI用途に限定し、RLS、Edge Function、バックエンドの認可条件には使いません。`user_metadata` に同名の `tenant_id`、`role`、`permissions` があっても、認可用のfallbackにしてはいけません。

```json
{
  "app_metadata": {
    "tenant_id": "tenant-uuid",
    "tenant_role": "member"
  },
  "user_metadata": {
    "display_name": "John Doe",
    "avatar_url": "https://..."
  }
}
```

`app_metadata` の更新は secret key を保持するサーバーまたは管理者の `supabase.auth.admin.updateUserById()` に限定します。クライアントの `supabase.auth.updateUser({ data: ... })` は `user_metadata` の更新なので、tenant/roleを渡しても認可状態を変更する管理APIとして扱いません。カスタムclaimをJWTへ追加する場合も、Custom Access Token Hookが信頼済みのmembership情報から発行時に作るものだけを用い、クライアント入力を混ぜません。

**JWT鮮度の契約**: `auth.jwt()` やJWTのローカル検証は、リクエストが提示したtokenのclaimを参照します。`app_metadata` を変更しても、既発行のJWTは **token refresh または再認証まで古いclaimを含み得ます**。通常のtenant/role変更では、管理更新の完了後にクライアントが `supabase.auth.refreshSession()` を実行するか、再認証を要求し、新しいtokenでRLSやJWT claimベースの処理を再試行することを画面・API契約に含めます。更新前tokenでの許可/拒否、refresh/re-auth後の許可/拒否をテストします。なお `supabase.auth.getUser(jwt)` はAuth serverへ問い合わせてdatabase上のuser objectを取得するため、ローカルのJWT payload読み取りとは鮮度特性が異なります。この違いを理由に、JWTベースのRLSまで即時更新されるとは扱いません。

**高リスクのtenant剥奪**: `app_metadata` の更新、refresh tokenのrevoke、sign outだけでは、既発行access tokenを即時に無効化しません。tenantからの除外、管理者権限の剥奪、データ持ち出しのように即時停止が必要な操作では、(1) 信頼済みサーバー/Edge Functionが毎回、authoritativeなmembership・revocation状態を照会して拒否する、または同等の動的RLS条件を使う、(2) 対象sessionのrefreshを停止して再認証を要求する、(3) access tokenの有効期間を残存リスクとして短く設定する、を組み合わせます。JWTだけのRLSで「即時失効」とは主張しません。

公式参照: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)、[User sessions](https://supabase.com/docs/guides/auth/sessions)、[Signing out](https://supabase.com/docs/guides/auth/signout)、[Retrieve a user](https://supabase.com/docs/reference/javascript/auth-getuser)、[Custom claims / RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac)

### 実務レビューゲート: Auth・API キー・RLS 境界

2026年5月時点の Supabase Cloud では、アプリケーションを識別する **API キー** と、利用者を識別する **Supabase Auth のユーザーJWT** を分けて考えます。

- **公開クライアント**: ブラウザ、モバイル、デスクトップ、配布済み CLI では `sb_publishable_...` を使い、データ保護は RLS とユーザーJWT で担保します。
- **バックエンド/管理処理**: `sb_secret_...` または legacy `service_role` は RLS を迂回し得るため、Edge Functions、サーバー、ジョブなどの管理された実行環境だけで使います。クライアント、URL、公開ログ、サンプルコードへ出しません。
- **legacyキー**: `anon` は publishable key、`service_role` は secret key の legacy 相当です。JWT secret に紐づく長期キーであり、Cloud では新しい publishable/secret キーを優先します。
- **RLS ロール**: 未ログインは Postgres role `anon`、ログイン済みは `authenticated` として評価されます。Supabase Auth の anonymous user は `authenticated` role であり、`anon` key とは別概念です。
- **ポリシー条件**: `auth.uid()` は未認証・期限切れセッションで `null` になるため、本人限定ポリシーでは `auth.uid() IS NOT NULL AND auth.uid() = user_id` のように意図を明示します。
- **周辺サービス**: Storage は `storage.objects`、Realtime private channel は `realtime.messages` の RLS を含めてレビューします。テーブル RLS だけで Storage/Realtime の操作権限が完了したと見なさないでください。

### 認証フロー実装

#### 1. Email/Password認証

```mermaid
sequenceDiagram
    participant C as Client
    participant SA as Supabase Auth

    C->>SA: supabase.auth.signUp(...)
    SA->>SA: 管理された Auth ユーザーを作成
    SA->>SA: 確認メール送信
    SA-->>C: 201 Created

    C->>SA: GET /auth/v1/verify
    SA->>SA: 確認トークンを検証
    SA->>SA: JWT 生成
    SA-->>C: 302 Redirect + Set-Cookie
```

**サインアップ実装**:
```typescript
// ブラウザなどの公開クライアント: publishable key と Auth API を使う
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'use-a-password-manager-generated-secret',
  options: {
    emailRedirectTo: 'https://app.example.com/auth/callback',
    data: { display_name: 'John Doe' }
  }
})

if (error) throw error

// Email confirmation が有効な場合、session は確認完了まで null になり得る。
if (!data.session) {
  console.log('確認メールを送信しました。リンクを開いて登録を完了してください。')
}
```

`auth.users` は Supabase が管理する内部スキーマです。アプリケーションから SQL で作成・更新したり、PostgREST の `.from()` で参照したりしません。サーバー側で招待・管理者プロビジョニングが必要な場合だけ、secret key を管理された Edge Function またはバックエンドに閉じ込め、`supabase.auth.admin` API を使用します。内部構造を SQL Editor で確認する read-only 診断と、`auth.users(id)` への主キー外部キー参照はこの境界と両立します。

#### 2. OAuth 実装

```typescript
// GoTrue内部実装（概念的）
interface OAuthProvider {
  name: string;
  authorize_url: string;
  token_url: string;
  user_info_url: string;
}

class GoogleProvider implements OAuthProvider {
  async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri
      })
    });
    return response.json();
  }
}
```

### 匿名サインイン → 本登録の昇格パターン（AI アプリの試用導線）

AI アプリでは「まず試す→あとで登録」の導線が一般的です。
そのため **匿名ユーザーの作業データを維持したまま正式登録へ昇格**できる設計が必要です。

**基本の流れ**:
1. 匿名セッションを作成（匿名ユーザーIDを確保）
2. そのユーザーIDに作業データ（チャット履歴・下書き・学習ログなど）を紐付け
3. 登録時に同一ユーザーとして昇格（またはデータを新アカウントへ移行）

**設計ポイント**:
- 匿名ユーザー用データには **期限（TTL）**を設ける
- RLS は **匿名ユーザーの読み書き許可範囲を最小化**
- 昇格時に **tenant_id / user_id の整合**をチェック

**実装例（概念）**:
```typescript
// 1) 匿名セッション作成（API 名はSDKバージョンで確認）
const { data: anon, error: anonError } = await supabase.auth.signInAnonymously()
if (anonError) throw anonError

const anonUserId = anon.user.id

// 2) 匿名ユーザーに作業データを紐付け
await supabase.from('drafts').insert({
  tenant_id: tenantId,
  owner_id: anonUserId,
  content: 'tmp draft'
})

// 3) 本登録（メール確認などは運用方針に従う）
const { data: registered, error: regError } = await supabase.auth.signUp({
  email,
  password
})
if (regError) throw regError

// 4) 匿名データを本登録ユーザーへ移行
await supabase.from('drafts')
  .update({ owner_id: registered.user.id })
  .eq('owner_id', anonUserId)
```

> 補足: 匿名サインインの API 名・可否はSDKのバージョン/設定に依存します。
> 利用中のSDKドキュメントで確認してください。

### LLM生成 SQL/RLS のレビュー手順（安全策）

LLMが生成した SQL や RLS はそのまま適用しない方針にします。
**実運用での安全策**として以下をチェックします：

- **deny-by-default**になっているか（無条件許可を避ける）
- **境界条件**（tenant_id / user_id / role）の漏れがないか
- `EXPLAIN` で **意図したインデックス**が使われているか
- **ステージング環境**で想定外の読み書きが起きないか

---

### AI 時代の RLS 設計（マルチテナント + 監査ログ）

AI アプリでは **RAG/ログ/評価テーブル**にも RLS を適用し、
「どのテナントのデータにアクセスしているか」を明示します。

**典型スキーマ例**:

```sql
CREATE TABLE ai_documents (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_retrieval_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  retrieved_doc_ids BIGINT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS ポリシー例（tenant_id + user_id）**:

```sql
ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_retrieval_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_owner_read" ON ai_documents
  FOR SELECT USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND owner_id = auth.uid()
  );

CREATE POLICY "tenant_user_log" ON ai_retrieval_logs
  FOR INSERT WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND user_id = auth.uid()
  );
```

### Secretsは DB に置かない

API キーや外部LLMの秘密情報は **DB に保存しない**方針にします。
必要な場合は **Vault / Edge Function Secrets**に集約し、
**ログ・監査・ローテーション**の運用フローを定義します。

### JWT 検証とミドルウェア

**PostgREST での JWT 検証**:
```haskell
-- PostgREST 内部実装（Haskell）
verifyJWT :: ByteString -> JWTSecret -> Either JWTError JWTClaims
verifyJWT token secret = do
  jwt <- decodeCompact token
  verifyClaims defaultJWTValidationSettings (view claimsSet jwt)

extractRole :: JWTClaims -> Maybe Role
extractRole claims =
  claims ^? claimSub . _Just . to parseRole
```

**カスタム JWT 検証関数**:
```sql
-- PostgreSQL 内カスタム関数
CREATE OR REPLACE FUNCTION auth.jwt_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'anon'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    '00000000-0000-0000-0000-000000000000'
  )::uuid;
$$ LANGUAGE sql STABLE;
```

---

## 2.2 RLS ポリシー設計パターン

### 階層的アクセス制御

```sql
-- 組織階層テーブル設計
CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id BIGINT REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_org_memberships (
    user_id UUID REFERENCES auth.users(id),
    org_id BIGINT REFERENCES organizations(id),
    role org_role_type NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, org_id)
);

-- カスタム型定義
CREATE TYPE org_role_type AS ENUM (
    'owner', 'admin', 'member', 'viewer'
);
```

### 継承的ポリシー

```sql
-- 再帰CTEによる階層アクセス
CREATE OR REPLACE FUNCTION user_accessible_orgs(user_uuid UUID)
RETURNS TABLE(org_id BIGINT, effective_role org_role_type) AS $$
WITH RECURSIVE org_hierarchy AS (
    -- 直接メンバーシップ
    SELECT
        m.org_id,
        m.role,
        0 as depth
    FROM user_org_memberships m
    WHERE m.user_id = user_uuid

    UNION ALL

    -- 子組織への継承
    SELECT
        o.id as org_id,
        h.role,
        h.depth + 1
    FROM organizations o
    JOIN org_hierarchy h ON o.parent_id = h.org_id
    WHERE h.depth < 10  -- 無限ループ防止
)
SELECT DISTINCT ON (org_id)
    org_id,
    role as effective_role
FROM org_hierarchy
ORDER BY org_id, depth ASC;  -- より近い階層の権限を優先
$$ LANGUAGE sql STABLE;

-- 階層ポリシー適用
CREATE POLICY "Hierarchical access" ON documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_accessible_orgs(auth.uid())
            WHERE org_id = documents.org_id
        )
    );
```

### 時間ベースアクセス制御

```sql
-- 時限付きアクセス
CREATE TABLE temp_access_grants (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    resource_id BIGINT,
    resource_type TEXT,
    permissions TEXT[],
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE POLICY "Temporary access" ON sensitive_documents
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM temp_access_grants tag
            WHERE tag.user_id = auth.uid()
            AND tag.resource_id = sensitive_documents.id
            AND tag.resource_type = 'sensitive_document'
            AND 'read' = ANY(tag.permissions)
            AND NOW() BETWEEN tag.valid_from AND tag.valid_until
        )
    );
```

### 属性ベースアクセス制御 (ABAC)

```sql
-- ユーザー属性テーブル
CREATE TABLE user_attributes (
    user_id UUID REFERENCES auth.users(id),
    attribute_name TEXT NOT NULL,
    attribute_value TEXT NOT NULL,
    valid_until TIMESTAMPTZ,
    PRIMARY KEY (user_id, attribute_name)
);

-- 動的ポリシー関数
CREATE OR REPLACE FUNCTION check_user_attribute(
    user_uuid UUID,
    attr_name TEXT,
    required_value TEXT
) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_attributes
        WHERE user_id = user_uuid
        AND attribute_name = attr_name
        AND attribute_value = required_value
        AND (valid_until IS NULL OR valid_until > NOW())
    );
$$ LANGUAGE sql STABLE;

-- ABAC適用例
CREATE POLICY "Department access" ON financial_reports
    FOR SELECT USING (
        check_user_attribute(auth.uid(), 'department', 'finance') OR
        check_user_attribute(auth.uid(), 'clearance_level', 'executive')
    );
```

### ポリシー最適化

**インデックス戦略**:
```sql
-- RLS クエリ最適化用複合インデックス
CREATE INDEX idx_user_org_memberships_lookup
ON user_org_memberships (user_id, org_id)
INCLUDE (role);

-- 部分インデックス
CREATE INDEX idx_active_temp_grants
ON temp_access_grants (user_id, resource_id, resource_type)
WHERE valid_until > NOW();

-- GIN インデックス（配列検索用）
CREATE INDEX idx_permissions_gin
ON temp_access_grants USING gin(permissions);
```

**パフォーマンス測定**:
```sql
-- ポリシー実行時間測定
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM documents WHERE title ILIKE '%budget%';

-- RLS 無効化での比較
SET row_security = off;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM documents WHERE title ILIKE '%budget%';
SET row_security = on;
```

> [WARN] `row_security = off` や `service_role` / secret key による確認は、RLS を迂回できる権限の診断専用です。通常のアプリケーション経路、公開クライアント、共有ログでは使わず、最小限の検証環境で実施してください。

---

## 2.3 組織・ロールベースアクセス制御実装

### 多テナント設計パターン

#### 1. Row-based Multi-tenancy

```sql
-- 全テーブルにtenant_id追加
CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- テナント分離ポリシー
CREATE POLICY "Tenant isolation" ON projects
    FOR ALL USING (
        tenant_id IN (
            SELECT t.id FROM tenants t
            JOIN user_tenant_memberships utm ON t.id = utm.tenant_id
            WHERE utm.user_id = auth.uid()
        )
    );
```

#### 2. Schema-based Multi-tenancy

```sql
-- 動的スキーマ作成
CREATE OR REPLACE FUNCTION create_tenant_schema(tenant_name TEXT)
RETURNS VOID AS $$
DECLARE
    schema_name TEXT := 'tenant_' || tenant_name;
BEGIN
    -- スキーマ作成
    EXECUTE format('CREATE SCHEMA %I', schema_name);

    -- テーブル作成
    EXECUTE format('
        CREATE TABLE %I.projects (
            id BIGSERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )', schema_name);

    -- RLS 有効化
    EXECUTE format('ALTER TABLE %I.projects ENABLE ROW LEVEL SECURITY', schema_name);
END;
$$ LANGUAGE plpgsql;
```

### 高度な権限モデル

**リソースベース権限**:
```sql
-- 権限定義テーブル
CREATE TABLE permissions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    resource_type TEXT NOT NULL
);

-- ロール-権限マッピング
CREATE TABLE role_permissions (
    role_id BIGINT REFERENCES roles(id),
    permission_id BIGINT REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- 動的権限チェック関数
CREATE OR REPLACE FUNCTION user_has_permission(
    user_uuid UUID,
    permission_name TEXT,
    resource_id BIGINT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_role_assignments ura
        JOIN role_permissions rp ON ura.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ura.user_id = user_uuid
        AND p.name = permission_name
        AND (resource_id IS NULL OR ura.resource_id = resource_id)
        AND ura.valid_from <= NOW()
        AND (ura.valid_until IS NULL OR ura.valid_until > NOW())
    );
END;
$$ LANGUAGE plpgsql STABLE;
```

### 監査とコンプライアンス

**操作ログテーブル**:
```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id BIGINT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 監査トリガー関数
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id,
        old_values, new_values, ip_address
    ) VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        COALESCE(
            current_setting('request.headers', true)::json->>'x-forwarded-for',
            '0.0.0.0'
        )::inet
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- トリガー適用
CREATE TRIGGER audit_trigger_projects
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### セキュリティヘッダーとCSP

**Kong設定での追加**:
```yaml
# kong.yml
_format_version: "2.1"

services:
  - name: supabase-auth
    url: http://supabase-auth:9999
    routes:
      - name: auth-route
        paths: ["/auth/v1/"]
        strip_path: true

plugins:
  - name: response-transformer
    config:
      add:
        headers:
          - "X-Content-Type-Options: nosniff"
          - "X-Frame-Options: DENY"
          - "X-XSS-Protection: 1; mode=block"
          - "Strict-Transport-Security: max-age=31536000; includeSubDomains"
          - "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'"
```

### 実装例: エンタープライズSaaS認可システム

```sql
-- 完全な認可システム実装
CREATE SCHEMA authorization;

-- 基本エンティティ
CREATE TABLE authorization.tenants (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    plan subscription_plan_type NOT NULL,
    max_users INTEGER NOT NULL,
    features TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE authorization.roles (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT REFERENCES authorization.tenants(id),
    name TEXT NOT NULL,
    is_system_role BOOLEAN DEFAULT FALSE,
    permissions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- 統合認可チェック関数
CREATE OR REPLACE FUNCTION authorization.check_access(
    user_uuid UUID,
    action TEXT,
    resource_type TEXT,
    resource_id BIGINT DEFAULT NULL,
    tenant_context BIGINT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    user_tenant_id BIGINT;
    user_roles BIGINT[];
    required_permission TEXT;
BEGIN
    -- テナントコンテキスト取得
    user_tenant_id := COALESCE(
        tenant_context,
        (SELECT tenant_id FROM authorization.user_tenants
         WHERE user_id = user_uuid LIMIT 1)
    );

    -- ユーザーロール取得
    SELECT array_agg(role_id) INTO user_roles
    FROM authorization.user_role_assignments
    WHERE user_id = user_uuid
    AND tenant_id = user_tenant_id
    AND NOW() BETWEEN valid_from AND COALESCE(valid_until, 'infinity');

    -- 権限チェック実行
    required_permission := resource_type || ':' || action;

    RETURN EXISTS (
        SELECT 1 FROM authorization.roles r
        WHERE r.id = ANY(user_roles)
        AND r.permissions ? required_permission
        AND CASE
            WHEN resource_id IS NOT NULL THEN
                r.permissions->>required_permission @> '{"scope": "all"}' OR
                r.permissions->>required_permission @> format('{"resources": [%s]}', resource_id)
            ELSE TRUE
        END
    );
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## まとめ

認証・認可システムの設計では、セキュリティと実装効率のバランスが重要です。RLS による多層防御と、柔軟な権限モデルの組み合わせにより、エンタープライズレベルの要件に対応できます。

**設計原則**:
- **最小権限の原則**: 必要最小限の権限のみ付与
- **深層防御**: 複数レイヤーでのセキュリティチェック
- **監査可能性**: すべての操作の追跡可能性確保
- **パフォーマンス考慮**: インデックス戦略による最適化

## 第2章 学習まとめ

### **学習進捗トラッキング**
この章の学習進捗を以下のチェックリストで確認してください：

#### **基礎理解（必須）**
- [] 認証（Authentication）と認可（Authorization）の違いを説明できる
- [] JWT（JSON Web Token）の基本的な仕組みを理解した
- [] RLS（Row Level Security）によるデータアクセス制御の概念を理解した
- [] Supabase Authの基本的な機能（サインアップ・ログイン）を理解した

#### **応用理解（推奨）**
- [] ロールベースアクセス制御（RBAC）の設計パターンを理解した
- [] 組織・テナント単位での権限管理設計を理解した
- [] RLS ポリシーの具体的な作成・適用方法を理解した
- [] JWT Claimsとカスタムクレームの活用方法を理解した

#### **発展理解（上級者向け）**
- [] 複雑な組織階層・権限継承システムの設計ができる
- [] セキュリティ脅威（SQL Injection・XSS・CSRF等）と対策を理解した
- [] パフォーマンスを考慮した RLS ポリシー・インデックス設計ができる
- [] OAuth・SAML等の外部認証プロバイダー連携を理解した

#### **実践スキル（確認推奨）**
- [] Supabase Authを使った基本的な認証フローを実装できる
- [] テーブルに RLS を有効化し、基本的なポリシーを作成できる
- [] JWT トークンの確認・デバッグができる
- [] 認証エラーの基本的なトラブルシューティングができる

### [OK] **習得できたスキル**
- [OK] JWT 認証・Supabase Auth による安全なユーザー管理
- [OK] RLS（Row Level Security）による行レベルアクセス制御
- [OK] ロールベース・組織ベース認可システム設計
- [OK] セキュリティとパフォーマンスを両立する実装手法

### **認証・認可の重要ポイント**
| 概念 | 説明 | 実際の例 |
|:-----|:-----|:---------:|
| **認証 (Authentication)**| 「あなたは誰ですか？」の確認 | ログイン・パスワード確認 |
| **認可 (Authorization)**| 「何をしていいですか？」の制御 | 管理者のみ削除可能など |
| **RLS**| データベースレベルでの自動制御 | 作成者のみが自分のデータ操作可能 |
| **JWT**| 安全なセッション管理 | ログイン状態の維持・API 認証 |

### **次章への準備**
第3章で学ぶクライアントサイド実装の前提知識：
- [OK] ユーザー認証の流れ理解（サインアップ・ログイン・ログアウト）
- [OK] RLS の基本概念理解（誰がどのデータにアクセス可能か）
- [OK] JWT の役割理解（安全な API 呼び出しの仕組み）

### **実践演習**

#### **基礎演習（必須）**
1. **概念確認**: 認証（Authentication）と認可（Authorization）の違いを具体例で説明してください

2. **RLS 設計**: 以下のシナリオで RLS ポリシーを設計してください
   - テーブル: `documents`（文書管理）
   - 要件: 作成者のみが自分の文書を表示・編集できる

#### **応用演習（推奨）**
3. **権限設計**: 以下の組織でのロールベース権限設計を考えてください
   - 組織: 中小企業（部長・課長・一般社員）
   - システム: 経費申請・承認システム
   - 要件: 階層的な承認フロー

4. **セキュリティ分析**: パスワード認証の脆弱性と、それに対する Supabase の対策をまとめてください

#### **発展演習（上級者向け）**
5. **複雑権限実装**: マルチテナント（複数企業）での複雑な権限システムを設計してください
   - 企業A・Bのデータは完全分離
   - 企業内での部署・役職による細かい権限制御

6. **実装演習**: Supabase Studioで実際に以下を実装してください
   - ユーザーテーブル
   - RLS ポリシー
   - 基本的な認証フロー

#### **演習の解答例・解説**
<details>
<summary>解答例を確認（クリックして展開）</summary>

**1. 概念確認の解答例**
- **認証**: 「あなたは誰ですか？」の確認（例：ログイン・パスワード入力）
- **認可**: 「何をする権限がありますか？」の制御（例：管理者のみ削除可能）

**2. RLS 設計の解答例**
```sql
-- RLS 有効化
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 作成者のみアクセス可能
CREATE POLICY "Own documents only" ON documents
  FOR ALL USING (auth.uid() = user_id);
```

</details>

---

## 次章予告：パターン1 - クライアントサイド実装

第3章では、「**診療所の電子カルテシステム**」を例に、実践的なアプリケーション開発を学習します：
- **Python Flet UI**: デスクトップアプリライクな直感的インターフェース
- **タスク管理機能**: 患者予約・診療記録・進捗管理システム
- **認証統合**: 第2章で学んだ認証機能の実装適用
- **リアルタイム**: 複数スタッフでの同時作業・即座の情報共有

**実装目標**: 「病院スタッフが使いやすく、患者情報も安全に管理できるシステム」

### **次章に向けた準備課題**

第3章のクライアントサイド実装をスムーズに進めるために、以下を確認・準備してください：

#### **必須準備**
- [] Supabase プロジェクト作成済み（無料アカウントでOK）
- [] 基本的な SQL 操作の理解（CREATE TABLE、INSERT、SELECT）
- [] JWT の概念理解（トークンベース認証の仕組み）

#### **推奨準備**
- [] Python基礎知識（変数・関数・クラスの基本）
- [] 簡単な RLS ポリシーの作成経験
- [] Supabase Studio の基本操作に慣れている

#### **準備が不安な場合**
- [Supabase公式チュートリアル](https://supabase.com/docs/guides/getting-started) を実施
- [付録：環境構築]({{ '/appendices/appendix01/' | relative_url }}#appendix-env-setup-scripts) で開発環境を準備
- 不明点は [GitHub Discussions](https://github.com/supabase/supabase/discussions) で質問

---

**ナビゲーション**
- **目次**: [はじめに]({{ '/introduction/' | relative_url }})
- **前の章**: [第1章：Supabase アーキテクチャ理解]({{ '/chapters/chapter01/' | relative_url }})
- **次の章**: [第3章：パターン1 - クライアントサイド実装]({{ '/chapters/chapter03/' | relative_url }})
- **関連章**: [第7章：セキュリティ強化]({{ '/chapters/chapter07/' | relative_url }}) | [全体設計]({{ '/guides/pattern-selection/' | relative_url }})
- **リソース**: [認証テンプレート]({{ site.repository }}/tree/main/src/examples/) | [セキュリティ・ガイド]({{ '/guides/troubleshooting/' | relative_url }})
