# Chapter 1: Supabaseアーキテクチャ理解 🏥

---
**📚 目次に戻る**: [📖 学習ガイド](../../introduction/)  
**⬅️ 前の章**: なし（最初の章）  
**➡️ 次の章**: [Chapter 2: 認証システムの実装](../chapter02/)  
**🎯 学習レベル**: 🌱 基礎 | 🚀 応用 | 💪 発展  
**⏱️ 推定学習時間**: 3〜5時間
---

### 🧭 この章で扱う構成
- 構成: 共通基盤（全パターン共通 / Cloud・セルフホストの基礎）
- 推奨用途: 初学者の導入・新規プロジェクトの初期設定
- 非推奨用途: 既に環境が整っている場合は要点のみ参照

## 🎯 この章で学ぶこと（初心者向け）

この章では、**「Webアプリを作るのに必要なもの」** から始めて、Supabaseがどのようにそれらを解決してくれるかを学びます。

- 🌱 **初心者**: Webアプリに必要な基本要素がわかる
- 🚀 **中級者**: Supabaseの各コンポーネントの役割がわかる  
- 💪 **上級者**: 内部の仕組みまで理解して設計に活かせる

## 💡 まずは身近な例から：「ブログアプリ」を作るとしたら？

想像してみてください。あなたが**シンプルなブログアプリ**を作りたいとします：

```
✅ 記事を書いて保存したい
✅ 保存した記事を表示したい
✅ ログインした人だけが記事を書けるようにしたい
✅ 記事が更新されたらリアルタイムで反映したい
```

### 🤔 従来の方法だと...

一つ一つ別々のサービスやツールを用意する必要がありました：

```mermaid
flowchart TD
    A[フロントエンド<br/>React/Vue] --> B[サーバー<br/>Express/FastAPI]
    B --> C[データベース<br/>MySQL/PostgreSQL]
    B --> D[認証システム<br/>自作or Auth0]
    B --> E[リアルタイム<br/>WebSocket サーバー]
    
    F[開発者😰] --> G[5つのシステムを<br/>別々に設定・管理]
```

**問題点**：
- 🔧 設定が複雑（5つのシステム × 設定ファイル）
- 🐛 バグが起きやすい（連携部分でエラー）
- ⏰ 開発に時間がかかる
- 💰 運用コストが高い

### 🎉 Supabaseなら...

```mermaid
flowchart TD
    A[フロントエンド<br/>React/Vue] --> B[Supabase<br/>統合バックエンド]
    B --> C[PostgreSQL<br/>データベース]
    B --> D[認証システム<br/>自動実装]
    B --> E[リアルタイム<br/>自動配信]
    B --> F[API<br/>自動生成]
    
    G[開発者😊] --> H[1つのサービスで<br/>すべて解決]
```

**メリット**：
- ✅ 設定が簡単（1つのサービス）
- ✅ バグが少ない（統合済み）
- ✅ 開発が早い（自動生成）
- ✅ 運用コストが安い

## 🏗️ Supabaseの内部構造を理解する

### 実際のSupabaseアーキテクチャ

```mermaid
graph TB
    subgraph "クライアント層"
        A[React/Vue/Angular<br/>フロントエンド]
        B[Mobile App<br/>Flutter/RN]
        C[サーバーサイド<br/>Node.js/Python]
    end
    
    subgraph "Supabase Edge"
        D[API Gateway<br/>Kong]
        E[認証システム<br/>GoTrue]
        F[リアルタイム<br/>Phoenix]
        G[エッジ関数<br/>Deno]
    end
    
    subgraph "Database Layer"
        H[PostgreSQL<br/>主データベース]
        I[PostgREST<br/>自動API生成]
        J[pgBouncer<br/>コネクションプール]
    end
    
    subgraph "Storage & Services"
        K[オブジェクトストレージ<br/>S3互換]
        L[バックアップ<br/>WAL-E]
        M[監視・ログ<br/>Prometheus]
    end
    
    A --> D
    B --> D
    C --> D
    
    D --> E
    D --> F
    D --> G
    D --> I
    
    E --> H
    F --> H
    G --> H
    I --> H
    
    J --> H
    K --> H
    L --> H
    M --> H
```

### 各コンポーネントの詳細説明

#### 1. 認証システム (GoTrue)
```javascript
// 実際のSupabase認証の内部フロー
const authFlow = {
  signup: async (email, password) => {
    // 1. GoTrueサーバーにリクエスト
    const response = await fetch('/auth/v1/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    // 2. PostgreSQLのauth.usersテーブルに保存
    // 3. 確認メールの送信
    // 4. JWTトークンの生成
    
    return response.json();
  },
  
  login: async (email, password) => {
    // 1. 資格情報の検証
    // 2. JWTトークンの生成
    // 3. refresh_tokenの発行
    // 4. セッション管理
  }
};
```

#### 2. 自動API生成 (PostgREST)
```sql
-- データベーステーブル
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 自動的に以下のAPIエンドポイントが生成される：
-- GET    /posts           - 一覧取得
-- GET    /posts?id=eq.xxx - 特定の投稿
-- POST   /posts           - 新規作成
-- PATCH  /posts?id=eq.xxx - 更新
-- DELETE /posts?id=eq.xxx - 削除
```

#### 3. リアルタイム機能 (Phoenix)
```javascript
// WebSocketを使用したリアルタイム接続
const realtimeClient = supabase
  .channel('posts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    console.log('新しい投稿:', payload.new);
    // UIを自動更新
  })
  .subscribe();
```

## 🔧 実践的な開発例：ブログアプリの構築

### ステップ1: プロジェクトセットアップ

```bash
# 1. Supabaseプロジェクトの作成
npx create-supabase-app my-blog
cd my-blog

# 2. 必要な依存関係のインストール
npm install @supabase/supabase-js
npm install react react-dom
npm install @types/react @types/react-dom
```

### ステップ2: データベース設計

```sql
-- users テーブル（認証で自動作成）
-- auth.users テーブルが既に存在

-- プロファイルテーブル
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 投稿テーブル
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- コメントテーブル
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### ステップ3: Row Level Security (RLS) 設定

```sql
-- テーブルでRLSを有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- プロファイルのポリシー
CREATE POLICY "プロファイルは誰でも閲覧可能"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "ユーザーは自分のプロファイルのみ更新可能"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 投稿のポリシー
CREATE POLICY "公開された投稿は誰でも閲覧可能"
  ON posts FOR SELECT
  USING (published = true);

CREATE POLICY "作者は自分の投稿を閲覧可能"
  ON posts FOR SELECT
  USING (auth.uid() = author_id);

CREATE POLICY "認証されたユーザーは投稿を作成可能"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "作者は自分の投稿を更新可能"
  ON posts FOR UPDATE
  USING (auth.uid() = author_id);

-- コメントのポリシー
CREATE POLICY "コメントは誰でも閲覧可能"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "認証されたユーザーはコメントを作成可能"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);
```

### ステップ4: フロントエンド実装

```javascript
// supabase.js - クライアント初期化
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_PUBLISHABLE_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);

// BlogApp.js - メインコンポーネント
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function BlogApp() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 認証状態の監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // 投稿の取得
    fetchPosts();

    // リアルタイム更新の設定
    const channel = supabase
      .channel('posts')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      channel.unsubscribe();
    };
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id (
            name,
            avatar_url
          )
        `)
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data);
    } catch (error) {
      console.error('投稿の取得に失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      console.log('ログイン成功:', data);
    } catch (error) {
      console.error('ログインエラー:', error);
    }
  };

  const handleSignup = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (error) throw error;
      console.log('サインアップ成功:', data);
    } catch (error) {
      console.error('サインアップエラー:', error);
    }
  };

  const handleCreatePost = async (title, content) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            title,
            content,
            author_id: user.id,
            published: true
          }
        ]);

      if (error) throw error;
      console.log('投稿作成成功:', data);
    } catch (error) {
      console.error('投稿作成エラー:', error);
    }
  };

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="blog-app">
      <header>
        <h1>My Blog</h1>
        {user ? (
          <div>
            <span>こんにちは, {user.email}</span>
            <button onClick={() => supabase.auth.signOut()}>
              ログアウト
            </button>
          </div>
        ) : (
          <AuthForm onLogin={handleLogin} onSignup={handleSignup} />
        )}
      </header>

      <main>
        {user && (
          <CreatePostForm onSubmit={handleCreatePost} />
        )}
        
        <PostList posts={posts} />
      </main>
    </div>
  );
}

// 認証フォームコンポーネント
function AuthForm({ onLogin, onSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(email, password);
    } else {
      onSignup(email, password);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">
        {isLogin ? 'ログイン' : 'サインアップ'}
      </button>
      <button type="button" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'アカウント作成' : 'ログインに戻る'}
      </button>
    </form>
  );
}

// 投稿作成フォームコンポーネント
function CreatePostForm({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(title, content);
    setTitle('');
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="投稿タイトル"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        placeholder="投稿内容"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <button type="submit">投稿する</button>
    </form>
  );
}

// 投稿一覧コンポーネント
function PostList({ posts }) {
  return (
    <div className="post-list">
      {posts.map(post => (
        <article key={post.id} className="post">
          <h2>{post.title}</h2>
          <p>{post.content}</p>
          <div className="post-meta">
            <span>投稿者: {post.profiles?.name || 'Unknown'}</span>
            <span>投稿日: {new Date(post.created_at).toLocaleDateString('ja-JP')}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export default BlogApp;
```

### 実装のポイント

1. **認証状態の管理**: `onAuthStateChange`でリアルタイムに認証状態を監視
2. **RLSによる自動権限制御**: データベースレベルでセキュリティを確保
3. **リアルタイム更新**: 新しい投稿が即座に反映される
4. **型安全性**: TypeScriptを使用することで開発効率が向上

### パフォーマンス最適化

```javascript
// 1. データの効率的な取得
const { data, error } = await supabase
  .from('posts')
  .select('id, title, created_at, profiles:author_id(name)')  // 必要な列のみ
  .range(0, 9);  // ページネーション

// 2. インデックスの作成
// データベースで実行
CREATE INDEX idx_posts_published_created 
ON posts(published, created_at DESC);

// 3. キャッシュの活用
const cachedPosts = useMemo(() => {
  return posts.filter(post => post.published);
}, [posts]);
```

## 🎯 章のまとめ

この章では、Supabaseの基本的なアーキテクチャとコンポーネントについて学びました：

- **統合バックエンド**: 複数のサービスを1つに統合
- **自動API生成**: PostgreSQLテーブルから自動的にRESTful APIを生成
- **リアルタイム機能**: WebSocketベースのリアルタイム通信
- **認証システム**: JWT-based認証と細かい権限制御
- **Row Level Security**: データベースレベルでのセキュリティ

次の章では、この基盤の上に認証システムを詳しく実装していきます。

**1つのサービス**で全て解決！

```mermaid
flowchart TD
    A[フロントエンド<br/>React/Vue] --> B[Supabase]
    B --> C[データ保存 ✅<br/>PostgreSQL]
    B --> D[認証 ✅<br/>Supabase Auth]
    B --> E[リアルタイム ✅<br/>Realtime]
    B --> F[API ✅<br/>PostgREST]
    
    G[開発者😊] --> H[1つのサービスで<br/>全部完結！]
```

**メリット**：
- ⚡ 設定が簡単（1つのダッシュボードで管理）
- 🔒 セキュリティが自動で組み込まれている
- 🚀 開発が早い（数時間でプロトタイプ完成）
- 💝 無料から始められる

---

## 🧩 Supabaseの中身を覗いてみよう

### 📱 まずは簡単に：「3つの基本機能」

Supabaseは主に**3つの機能**でできています：

```mermaid
flowchart LR
    A[あなたのアプリ] --> B[Supabase]
    
    subgraph B[Supabase]
        C[📄 データ保存<br/>PostgreSQL]
        D[🔗 API自動生成<br/>PostgREST]
        E[⚡ リアルタイム<br/>Realtime]
    end
```

**例：ブログアプリでの役割**

| 機能 | 何をするもの？ | ブログアプリでの例 |
|------|:-------------:|:------------------|
| 📄 **PostgreSQL** | データを保存する | 記事のタイトル・内容を保存 |
| 🔗 **PostgREST** | API を自動で作る | 記事の取得・保存のAPI を自動作成 |
| ⚡ **Realtime** | リアルタイム更新 | 記事が更新されると即座に画面も更新 |

### 🔍 もう少し詳しく：「内部の仕組み」

実際には、以下のような流れで動いています：

```mermaid
flowchart TB
    Client[📱 あなたのアプリ<br/>React/Vue/モバイル] --> Kong[🚪 入口<br/>Kong Gateway]
    Kong --> PostgREST[🔗 API<br/>PostgREST]
    Kong --> Realtime[⚡ リアルタイム<br/>Realtime Server]
    Kong --> Auth[🔐 認証<br/>Supabase Auth]
    
    PostgREST --> PostgreSQL[📄 データベース<br/>PostgreSQL]
    Realtime --> PostgreSQL
    Auth --> PostgreSQL
    
    PostgreSQL --> WAL[📝 変更ログ<br/>Write-Ahead Log]
    WAL --> Realtime
    
    style Client fill:#e1f5fe
    style PostgreSQL fill:#f3e5f5
    style Kong fill:#e8f5e8
```

**各コンポーネントの役割（簡単版）**：

- 🚪 **Kong Gateway**: 入口の門番（どのAPIを呼ぶかを振り分け）
- 🔗 **PostgREST**: API を自動で作成してくれる魔法のツール
- ⚡ **Realtime**: データが変わったら即座にお知らせ
- 🔐 **Supabase Auth**: ログイン・ログアウトを管理
- 📄 **PostgreSQL**: 全てのデータを保存する倉庫

## 📄 PostgreSQL：「データの倉庫」を詳しく見てみよう

### 🤔 そもそもデータベースって何？

**データベース** = あなたのアプリが使うデータを保存する場所

ブログアプリの例で考えてみましょう：

```
📝 記事のデータ
- タイトル: "初めてのSupabase"
- 内容: "今日からSupabaseを使って..."
- 作成日: 2024-06-03
- 作者: user_123

👤 ユーザーのデータ  
- 名前: "田中太郎"
- メールアドレス: "tanaka@example.com"
- パスワード: （暗号化された文字列）
```

これらのデータを整理して保存・取得するのがデータベースの仕事です。

### 🏆 なぜPostgreSQLが選ばれるの？

Supabaseが数あるデータベースの中から**PostgreSQL**を選んだ理由：

#### 🔰 初心者でもわかるメリット

| 特徴 | 初心者への影響 | 具体例 |
|------|:------------:|:-------|
| 📚 **標準SQL** | 覚えやすい | 他のシステムでも使える知識 |
| 🔒 **安全性** | 勝手にデータが消えない | バックアップ・復元が確実 |
| 🚀 **高性能** | アプリが速く動く | ユーザーを待たせない |
| 🛠️ **拡張可能** | 成長に対応できる | 小さく始めて大きく育てられる |

#### 🔧 開発者向けメリット

PostgreSQLは「**多機能なスイスアーミーナイフ**」のようなデータベースです：

- ✅ **ACID保証**: データが確実に保存される（途中で電源が切れても大丈夫）
- ✅ **高度なクエリ**: 複雑な検索・集計が簡単にできる
- ✅ **JSON対応**: 従来のデータとモダンなデータ両方を扱える
- ✅ **拡張機能**: 必要に応じて機能を追加できる

#### 他のデータベースとの違い
| 特徴 | PostgreSQL | MySQL | MongoDB | Firebase |
|------|:----------:|:-----:|:-------:|:--------:|
| ACID保証 | ✅ 完全 | ⚠️ 部分的 | ⚠️ 部分的 | ❌ なし |
| RLS対応 | ✅ ネイティブ | ❌ なし | ❌ なし | ⚠️ 限定的 |
| JSON処理 | ✅ 高性能 | ⚠️ 基本的 | ✅ 高性能 | ✅ 高性能 |
| 拡張性 | ✅ 豊富 | ⚠️ 限定的 | ⚠️ 限定的 | ❌ なし |
| SQL標準 | ✅ 高準拠 | ⚠️ 独自拡張 | ❌ なし | ❌ なし |

**Supabase固有の拡張機能**:

- `pg_graphql`: GraphQLエンドポイント自動生成により、REST APIに加えてGraphQLも利用可能
- `pgsodium`: データベースレベルでの暗号化・復号化により、機密データの安全な処理を実現
- `pg_stat_statements`: クエリパフォーマンス監視により、ボトルネックの早期発見と最適化が可能

```sql
-- 拡張機能の確認
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name IN ('pg_graphql', 'pgsodium', 'pg_stat_statements');
```

## 🔗 PostgREST：「API自動生成の魔法」

### 🤔 APIって何？そしてなぜ必要？

**API（Application Programming Interface）** = アプリとデータベースをつなぐ橋

ブログアプリの例で考えてみましょう：

```mermaid
flowchart LR
    A[📱 ブログアプリ] --> B[❓どうやって<br/>データを取得？] --> C[📄 データベース]
    
    D[記事を表示したい] --> E[API: 記事データを取得]
    F[新しい記事を保存したい] --> G[API: 記事データを保存]
```

### 😰 従来の方法：「手作業でAPI を作る」

通常、開発者がこんなコードを書く必要がありました：

```javascript
// 記事一覧を取得するAPI （手作業で作成）
app.get('/api/articles', async (req, res) => {
  try {
    // 1. データベースに接続
    const connection = await getDBConnection();
    
    // 2. SQLクエリを書く
    const query = 'SELECT * FROM articles ORDER BY created_at DESC';
    const articles = await connection.query(query);
    
    // 3. 結果を返す
    res.json(articles);
  } catch (error) {
    // 4. エラーハンドリング
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// 記事を作成するAPI （また手作業で作成）
app.post('/api/articles', async (req, res) => {
  // また同じような手順を繰り返し...
});

// 記事を更新するAPI （また手作業で作成）
app.put('/api/articles/:id', async (req, res) => {
  // また同じような手順を繰り返し...
});

// 記事を削除するAPI （また手作業で作成）
app.delete('/api/articles/:id', async (req, res) => {
  // また同じような手順を繰り返し...
});
```

**問題点**：
- 😱 **時間がかかる**: 1つのテーブルに4つのAPI × 複数テーブル = 大量のコード
- 🐛 **バグが起きやすい**: 手動でコードを書くのでミスが発生
- 🔄 **重複作業**: 似たようなコードを何度も書く

### 🎉 PostgREST：「API が自動で完成！」

PostgRESTを使えば、**コードを書かずに**APIが完成します：

```mermaid
flowchart TD
    A[📄 データベースにテーブル作成] --> B[🎯 PostgRESTが自動でAPI生成]
    B --> C[✅ 記事取得API 完成]
    B --> D[✅ 記事作成API 完成] 
    B --> E[✅ 記事更新API 完成]
    B --> F[✅ 記事削除API 完成]
    
    style A fill:#e3f2fd
    style B fill:#fff3e0
    style C fill:#e8f5e8
    style D fill:#e8f5e8
    style E fill:#e8f5e8
    style F fill:#e8f5e8
```

**魔法のような動作**：

1. 📊 **テーブルを作る** → API が自動で生成される
2. 🔄 **テーブルを変更する** → API も自動で更新される
3. 🚀 **すぐに使える** → フロントエンドから即座に呼び出し可能

**例：articlesテーブルを作ると...**

```sql
-- テーブルを作成するだけ
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLSを有効化（セキュリティ向上）
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
```

自動で以下のAPIが生成されます：

```bash
✅ GET /articles          # 記事一覧取得
✅ GET /articles?id=eq.1  # 特定記事取得  
✅ POST /articles         # 記事作成
✅ PATCH /articles?id=eq.1 # 記事更新
✅ DELETE /articles?id=eq.1 # 記事削除
```

**メリット**：
- ⚡ **即座に完成**: テーブル作成と同時にAPI完成
- 🎯 **一貫性**: 全てのAPIが同じ品質で統一
- 🔧 **自動更新**: テーブル変更でAPIも自動更新
- 🚀 **高性能**: 最適化済みのSQLクエリを直接実行

#### 従来のAPI開発手法との違い
| 項目 | PostgREST | 従来のフレームワーク |
|------|:---------:|:------------------:|
| **コード量** | ✅ ゼロ | ❌ 大量（CRUD毎に実装） |
| **開発時間** | ✅ 即時 | ❌ 数日〜数週間 |
| **一貫性** | ✅ 自動保証 | ⚠️ 手動実装が必要 |
| **バグリスク** | ✅ 最小 | ❌ 実装ミスのリスク |
| **保守性** | ✅ スキーマ駆動 | ⚠️ コードとDBの同期が必要 |
| **パフォーマンス** | ✅ 最適化済み | ⚠️ ORM経由で性能低下 |

**Express.js/FastAPIとの比較例**:

```javascript
// 従来の手法 (Express.js)
app.get('/tasks', async (req, res) => {
  const { limit, offset, completed } = req.query;
  
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  
  if (completed !== undefined) {
    query += ' AND completed = $' + (params.length + 1);
    params.push(completed === 'true');
  }
  
  if (limit) {
    query += ' LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));
  }
  
  if (offset) {
    query += ' OFFSET $' + (params.length + 1);
    params.push(parseInt(offset));
  }
  
  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PostgREST（自動生成）
// GET /tasks?completed=eq.true&limit=10&offset=0
// → 上記と同等の機能が自動で利用可能
```

```sql
-- テーブル作成でAPIが自動生成される
CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

対応するREST APIが自動生成：

```http
GET    /rest/v1/tasks           # SELECT
POST   /rest/v1/tasks           # INSERT  
PATCH  /rest/v1/tasks?id=eq.1   # UPDATE
DELETE /rest/v1/tasks?id=eq.1   # DELETE
```

**クエリ翻訳メカニズム**:

- URLパラメーター → WHERE句変換
- HTTPヘッダー → SELECT句・JOIN句構築
- JSONペイロード → INSERT/UPDATE値設定

### Realtime: リアルタイム通信

#### 何を行うものか
Supabase Realtimeは、データベースの変更をリアルタイムでクライアントアプリケーションに配信するElixir/Phoenix製のWebSocketサーバーです。PostgreSQLのWAL（Write-Ahead Log）を監視し、データ変更を即座に接続されたクライアントに通知します。

**実装基盤**: Elixir/Phoenix Channels（高並行性・耐障害性に優れたアクター　モデル）
**通信プロトコル**: WebSocket (Phoenix Socket.js)

#### 何がもたらされるか
1. **リアルタイム同期**: データ変更が全クライアントに即座に反映
2. **スケーラブル通信**: 数千〜数万の同時接続をサポート
3. **低レイテンシ**: データベース変更からクライアント反映まで数ミリ秒
4. **自動再接続**: ネットワーク障害時の自動復旧機能

#### 従来のリアルタイム実装との違い
| 項目 | Supabase Realtime | Socket.io + Redis | WebSocket + Polling |
|------|:-----------------:|:-----------------:|:-------------------:|
| **設定の複雑さ** | ✅ ゼロ設定 | ❌ 複雑な設定 | ⚠️ 中程度 |
| **データ同期** | ✅ 自動（DB駆動） | ❌ 手動実装 | ❌ 手動実装 |
| **スケーラビリティ** | ✅ 水平拡張 | ⚠️ Redis制限 | ❌ 単一サーバー |
| **障害復旧** | ✅ 自動 | ⚠️ 部分的 | ❌ 手動 |
| **メモリ効率** | ✅ 高効率 | ⚠️ 中程度 | ❌ 非効率 |

**従来手法との比較例**:

```javascript
// 従来の実装（Socket.io + 手動通知）
// 1. データ更新
await db.query('UPDATE tasks SET completed = true WHERE id = ?', [taskId]);

// 2. 手動でクライアントに通知（実装が必要）
io.emit('task_updated', { 
  id: taskId, 
  completed: true,
  updated_at: new Date()
});

// 3. クライアント側でも手動実装が必要
socket.on('task_updated', (data) => {
  // UIの更新処理を手動実装
  updateTaskInUI(data);
});
```

```javascript
// Supabase Realtime（自動）
// 1. データ更新（通常の方法）
await supabase
  .from('tasks')
  .update({ completed: true })
  .eq('id', taskId);

// 2. 通知は自動（設定のみ）
const subscription = supabase
  .channel('tasks_channel')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public', 
    table: 'tasks'
  }, (payload) => {
    // データ変更が自動で通知される
    console.log('Updated:', payload.new);
  })
  .subscribe();
// → 実装コードが90%削減
```

**データフロー（WALベース）**:

1. **PostgreSQLがWAL（Write-Ahead Log）に変更記録**: 全てのデータ変更が自動記録
2. **Realtime ServerがWALをtail監視**: リアルタイムでログを読み取り
3. **変更をWebSocketで配信**: 関連するクライアントに即座に通知
4. **クライアント側で自動反映**: アプリケーションのUIが自動更新

```javascript
// リアルタイム購読の内部実装
const subscription = supabase
  .channel('tasks_channel')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'tasks' },
    (payload) => console.log(payload)
  )
  .subscribe();
```

**WAL設定**（PostgreSQL）:

```sql
-- レプリケーション設定確認
SHOW wal_level;          -- replica以上が必要
SHOW max_replication_slots;
SHOW max_wal_senders;
```

---

## 1.2 Row Level Security (RLS) の設計思想

### セキュリティモデル

RLSはPostgreSQLの機能を活用した行レベルアクセス制御です。

**基本概念**:

- **Policy**: 行レベルでの条件式
- **Role**: PostgreSQLユーザーロール
- **Context**: `auth.uid()` などの実行時情報

### ポリシー実装パターン

#### 1. オーナーシップベース

```sql
-- テーブル設定
CREATE TABLE user_documents (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    content TEXT
);

ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- ポリシー定義
CREATE POLICY "Users can view own documents" ON user_documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON user_documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### 2. ロールベース

```sql
-- 組織テーブル
CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE user_org_roles (
    user_id UUID REFERENCES auth.users(id),
    org_id BIGINT REFERENCES organizations(id),
    role TEXT CHECK (role IN ('admin', 'member', 'viewer')),
    PRIMARY KEY (user_id, org_id)
);

-- 複合ポリシー
CREATE POLICY "Org members can view" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_org_roles 
            WHERE user_id = auth.uid() 
            AND org_id = organizations.id
        )
    );
```

### パフォーマンス考慮事項

**インデックス戦略**:

```sql
-- RLSクエリ最適化用インデックス
CREATE INDEX idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX idx_user_org_roles_user_id ON user_org_roles(user_id);
```

**実行計画確認**:

```sql
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM user_documents WHERE title ILIKE '%report%';
```

---

## 1.3 セルフホスト vs クラウドの運用観点比較

### 技術的差異

| 要素 | セルフホスト | Supabase Cloud |
|------|-------------|----------------|
| **インフラ管理** | 手動 | フルマネージド |
| **スケーリング** | 手動設定 | 自動 + 手動 |
| **バックアップ** | 独自実装必要 | 自動 + PITR |
| **監視** | Prometheus等を構築 | 組み込み済み |
| **アップデート** | 手動実行 | 自動適用 |

### コスト分析

**セルフホスト**:

```
月額運用コスト = 
    インフラ費用 + 
    運用工数 × 時間単価 + 
    可用性リスク × 影響度
```

**推定工数**:

- 初期構築: 40〜80時間
- 月次運用: 8〜16時間
- 障害対応: 不定期（2〜8時間/件）

### セキュリティ責任分界点

**セルフホスト責任範囲**:

- OS・ミドルウェア更新
- ネットワーク設定
- データ暗号化
- アクセス制御
- ログ監査

**クラウド責任範囲（Supabase）**:

- 物理インフラ
- プラットフォーム更新
- 基盤監視
- 自動バックアップ

---

## 1.4 開発環境構築（Docker Compose）

### プロジェクト構造

```
supabase-project/
├── docker-compose.yml
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
│       └── 001_initial_schema.sql
├── apps/
│   ├── flet-client/
│   ├── edge-functions/
│   └── fastapi-server/
└── scripts/
    └── setup.sh
```

### Docker Compose設定

```yaml
# docker-compose.yml
version: '3.8'

services:
  supabase-db:
    image: supabase/postgres:15.1.0.117
    environment:
      POSTGRES_PASSWORD: your-super-secret-and-long-postgres-password
      POSTGRES_DB: postgres
    volumes:
      - ./supabase/volumes/db/data:/var/lib/postgresql/data
      - ./supabase/volumes/db/init:/docker-entrypoint-initdb.d
    ports:
      - "54322:5432"

  supabase-studio:
    image: supabase/studio:20231123-fb9c70e
    environment:
      SUPABASE_URL: http://localhost:54321
      SUPABASE_PUBLISHABLE_KEY: ${SUPABASE_LEGACY_ANON_JWT}          # ローカル開発では legacy JWT の anon を指定
      SUPABASE_SECRET_KEY: ${SUPABASE_LEGACY_SERVICE_ROLE_JWT}       # ローカル開発では legacy JWT の service_role を指定
    ports:
      - "3000:3000"

  supabase-kong:
    image: kong:2.8.1
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
    volumes:
      - ./supabase/volumes/api/kong.yml:/var/lib/kong/kong.yml:ro
    ports:
      - "54321:8000"
      - "54323:8001"

  supabase-auth:
    image: supabase/gotrue:v2.99.0
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:your-super-secret-and-long-postgres-password@supabase-db:5432/postgres?search_path=auth
      GOTRUE_SITE_URL: http://localhost:3000
      GOTRUE_URI_ALLOW_LIST: http://localhost:3000
      GOTRUE_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
    depends_on:
      - supabase-db

  supabase-rest:
    image: postgrest/postgrest:v11.2.0
    environment:
      PGRST_DB_URI: postgres://postgres:your-super-secret-and-long-postgres-password@supabase-db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
    depends_on:
      - supabase-db

  supabase-realtime:
    image: supabase/realtime:v2.25.35
    environment:
      PORT: 4000
      DB_HOST: supabase-db
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: your-super-secret-and-long-postgres-password
      DB_NAME: postgres
      DB_AFTER_CONNECT_QUERY: 'SET search_path TO _realtime'
      DB_ENC_KEY: supabaserealtime
      API_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
      SECRET_KEY_BASE: UpNVntn3cDxHJpq99YMc1T1AQgQpc8kfYTuRgBiYa15BLrx8etQoXz3gZv1/u2oq
    depends_on:
      - supabase-db
    command: >
      bash -c "
        /app/bin/migrate && 
        /app/bin/realtime eval 'Realtime.Release.seeds(Realtime.Repo)' && 
        /app/bin/server
      "
```

### 初期化スクリプト

```bash
#!/bin/bash
# scripts/setup.sh

set -e

echo "🚀 Supabase開発環境セットアップ開始"

# 環境変数設定
if [ ! -f .env ]; then
    echo "📝 環境変数ファイル作成"
    cat > .env << EOF
SUPABASE_URL=http://localhost:54321
SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXXXXXXXXXX
SUPABASE_SECRET_KEY=sb_secret_XXXXXXXXXXXXXXXX
SUPABASE_LEGACY_ANON_JWT=your-legacy-anon-jwt
SUPABASE_LEGACY_SERVICE_ROLE_JWT=your-legacy-service-role-jwt
EOF
fi

# Docker環境起動
echo "🐳 Docker Compose起動"
docker-compose up -d

# データベース接続待機
echo "⏳ PostgreSQL起動待機"
until docker-compose exec supabase-db pg_isready; do
    sleep 2
done

# マイグレーション実行
echo "📊 初期スキーマ作成"
docker-compose exec supabase-db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/001_initial_schema.sql

echo "✅ セットアップ完了"
echo "🌐 Supabase Studio: http://localhost:3000"
echo "🔗 API Endpoint: http://localhost:54321"
```

### 🔑 APIキー仕様の更新（publishable/secret）

Supabase Cloud では **APIキー仕様が publishable/secret に移行**しています。  
セルフホスト環境は legacy JWT キー（`anon`/`service_role`）が前提のため、**用途ごとに区別**して扱います。

**キー種別の役割**:
- **publishable key**（`sb_publishable_`）: クライアント利用可（`apikey` ヘッダー専用）
- **secret key**（`sb_secret_`）: サーバー/Edge Functions専用（クライアント禁止）
- **legacy JWT key**（`anon`/`service_role`）: セルフホスト・旧プロジェクト向け

**使い分けの基本**:
- RESTアクセス時は **`apikey` に publishable key** を設定
- **`Authorization` はユーザーのアクセストークン（JWT）** を使用
- secret key は **サーバー側のみ**で使用し、クライアントに配布しない

**移行ガイド（Cloud）**:
1. `.env` のキー名を `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` に統一
2. `Authorization` にキーを入れていた箇所を **ユーザーJWT** に切り替え
3. 旧キーのローテーションと削除を実施（期限・手順はSupabaseの告知を確認）

### 基本スキーマ

```sql
-- supabase/migrations/001_initial_schema.sql

-- 拡張機能有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- プロファイルテーブル
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ポリシー設定
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 関数: プロファイル自動作成
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガー: ユーザー作成時の自動プロファイル作成
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 環境確認

```bash
# 各サービス状態確認
curl -s http://localhost:54321/rest/v1/ | jq '.version'
curl -s http://localhost:54321/auth/v1/settings | jq '.external'

# データベース接続確認
psql "postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:54322/postgres" -c "SELECT version();"
```

---

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. 接続エラー

**問題**: "Failed to connect to Supabase"
```javascript
// エラー例
Error: getaddrinfo ENOTFOUND your-project.supabase.co
```

**解決方法**:
```javascript
// 1. 環境変数を確認
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_PUBLISHABLE_KEY:', process.env.SUPABASE_PUBLISHABLE_KEY);

// 2. 正しい接続方法
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_PUBLISHABLE_KEY || ''
);

// 3. 接続テスト
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('Connection successful');
  } catch (error) {
    console.error('Connection failed:', error);
  }
}
```

#### 2. RLSポリシーエラー

**問題**: "new row violates row-level security policy"

**デバッグ方法**:
```sql
-- RLSポリシーの確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'your_table_name';

-- ポリシーのテスト
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claim.sub TO 'user-uuid-here';
SELECT * FROM your_table_name;
```

#### 3. Docker環境の問題

**問題**: "Container exited with code 1"

**チェックリスト**:
```bash
# 1. ログ確認
docker-compose logs supabase-db
docker-compose logs supabase-auth

# 2. ポート競合確認
sudo lsof -i :54321
sudo lsof -i :54322

# 3. 環境リセット
docker-compose down -v
docker-compose up -d

# 4. ヘルスチェック
curl http://localhost:54321/rest/v1/
```

#### 4. API認証エラー

**問題**: "Invalid API key"

**解決方法**:
> 補足: `Authorization` に設定するのは **Supabase Auth のアクセストークン（JWT）** です。  
> `SUPABASE_ACCESS_TOKEN` はログイン後に取得する値で、`.env` に固定保存しません。
```javascript
// ヘッダー確認
// - publishable key は apikey にのみ使う
// - Authorization はユーザーのアクセストークン（JWT）を使う
const headers = {
  'apikey': process.env.SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// エラーハンドリング付きリクエスト
async function apiRequest() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      headers
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}
```

### パフォーマンスのトラブルシューティング

#### 1. 遅いクエリの特定

```sql
-- 遅いクエリの確認
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100  -- 100ms以上
ORDER BY mean_time DESC
LIMIT 10;

-- インデックスの確認
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'your_table_name';
```

#### 2. リアルタイム接続の問題

```javascript
// 接続状態の監視
const subscription = supabase
  .channel('test_channel')
  .on('system', { event: '*' }, (payload) => {
    console.log('System event:', payload);
  })
  .on('postgres_changes', 
    { event: '*', schema: 'public' },
    (payload) => console.log('Change:', payload)
  )
  .subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      console.log('Successfully subscribed');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('Subscription error:', err);
      // 再接続ロジック
      setTimeout(() => {
        subscription.subscribe();
      }, 5000);
    }
  });
```

---

## まとめ

本章では、Supabaseの内部アーキテクチャと基本概念を技術的観点から解説しました。トラブルシューティングセクションで示したように、問題解決のためには各コンポーネントの役割を理解することが重要です。次章では、これらの基盤上での認証・認可設計について詳述します。

## 📝 Chapter 1 学習まとめ

### 📊 **学習進捗トラッキング**
この章の学習進捗を以下のチェックリストで確認してください：

#### 🌱 **基礎理解（必須）**
- [ ] Webアプリに必要な基本要素（データベース・API・認証・リアルタイム）を説明できる
- [ ] Supabaseの3つの基本コンポーネント（PostgreSQL・PostgREST・Realtime）の役割を理解した
- [ ] 従来の開発手法とSupabaseの違い・メリットを説明できる
- [ ] RLS（Row Level Security）の基本概念を理解した

#### 🚀 **応用理解（推奨）**
- [ ] PostgreSQLのACID保証・拡張機能の重要性を理解した
- [ ] PostgRESTのAPI自動生成メカニズムを理解した
- [ ] Realtimeのメッセージング・WebSocket通信の仕組みを理解した
- [ ] Kong Gatewayの役割・API ルーティングを理解した

#### 💪 **発展理解（上級者向け）**
- [ ] WAL（Write-Ahead Log）ベースのリアルタイム通信の仕組みを理解した
- [ ] Supabase固有の拡張機能（pg_graphql・pgsodium等）の用途を理解した
- [ ] Docker Compose環境でのSupabase開発環境を構築できる
- [ ] 他のBaaS（Firebase・AWS Amplify等）との技術的差異を説明できる

#### 🔧 **実践スキル（確認推奨）**
- [ ] Supabase Studioの基本操作ができる
- [ ] 簡単なテーブル作成・RLSポリシー設定ができる
- [ ] 環境変数・接続設定を理解した
- [ ] 基本的なSQLクエリ・PostgREST APIを試すことができる

### ✅ **習得できたスキル**
- ✅ Supabaseの基本構成（PostgreSQL + PostgREST + Realtime）理解
- ✅ Row Level Security（RLS）の基本概念理解
- ✅ Docker環境でのSupabase開発環境構築
- ✅ Webアプリケーションに必要な要素の理解

### 🎯 **重要ポイントの復習**
| 概念 | 説明 | 実際の例 |
|:-----|:-----|:---------|
| **PostgreSQL** | データベース本体（記事データ保存） | ブログ記事・ユーザー情報の保存 |
| **PostgREST** | APIサーバー（REST APIを自動生成） | `/posts` APIで記事取得 |
| **Realtime** | リアルタイム更新（変更を即座に通知） | 記事投稿の瞬間にページ更新 |
| **RLS** | 行レベルセキュリティ（データアクセス制御） | 作成者のみが自分の記事を編集可能 |

### 🔄 **次章への準備**
Chapter 2で学ぶ認証システムの基礎となる概念を確認しましょう：
- ✅ ユーザー認証の必要性理解
- ✅ JWT（JSONWebToken）の基本概念
- ✅ RLSポリシーの役割理解

### 💡 **実践演習**

#### 🌱 **基礎演習（必須）**
1. **概念整理**: 以下の用語を自分の言葉で説明してみてください
   - PostgreSQL
   - PostgREST
   - Realtime
   - RLS（Row Level Security）

2. **仕組み理解**: ブログアプリの例で、「記事を投稿してからリアルタイムで他のユーザーに表示される」までの流れを説明してください

#### 🚀 **応用演習（推奨）**
3. **比較分析**: 従来の開発手法（例：React + Express + MySQL）とSupabaseを使った開発の違いを表にまとめてください

4. **設計思考**: あなたが作りたいアプリケーションを想定して、Supabaseのどの機能が必要かリストアップしてください

#### 💪 **発展演習（上級者向け）**
5. **環境構築**: Docker Composeを使ってローカルSupabase環境を構築し、基本的な動作確認を行ってください

6. **技術調査**: Supabase以外のBaaS（Firebase・AWS Amplify等）と比較して、どのような場面でSupabaseが有利かまとめてください

#### 📝 **演習の解答例・解説**
<details>
<summary>解答例を確認（クリックして展開）</summary>

**1. 概念整理の解答例**
- **PostgreSQL**: データを保存・管理するデータベース。高機能で安全性が高い
- **PostgREST**: データベースのテーブルから自動でAPIを作ってくれるツール
- **Realtime**: データが変更されたら即座にアプリに通知してくれる仕組み
- **RLS**: データベースレベルで「誰がどのデータを見られるか」を制御する機能

**2. 仕組み理解の解答例**
1. ユーザーがブログ記事を投稿 → PostgreSQLに保存
2. PostgreSQLがWAL（変更ログ）に記録
3. Realtimeサーバーが変更を検知
4. WebSocketで他のユーザーのブラウザに通知
5. 自動でUIが更新される

</details>

---

## 🚀 次章予告：認証システムの実装

Chapter 2では、「病院のカルテシステム」を例に、以下を学習します：
- 🔐 **JWT認証**: 医師・看護師・患者の身分確認システム
- 🛡️ **RLSポリシー**: 「患者は自分のカルテのみ閲覧可能」な制御
- 👥 **ロール管理**: 医師・看護師・管理者の権限分けシステム

**💡 実用例**: 「患者Aさんは自分のカルテしか見られないが、担当医師は担当患者全員のカルテを見られる」システムを作成

---

**📍 ナビゲーション**
- **📚 目次**: [📖 学習ガイド](../../introduction/)
- **➡️ 次の章**: [Chapter 2: 認証システムの実装](../chapter02/)  
- **🏠 関連章**: [Chapter 3-5: アーキテクチャパターン](../chapter03/)
- **🔧 リソース**: [動作検証](../../examples/) | [トラブルシューティング](../../guides/troubleshooting/)
