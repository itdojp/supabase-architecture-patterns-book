# 技術用語索引・用語集 📚

---
**📚 目次に戻る**: [📖 学習ガイド](./textbook_index.md)  
**🎯 用途**: 学習中の技術用語の即座な確認・復習  
**📝 対象**: 全レベル（基礎〜上級）  
**⏱️ 利用方法**: 不明な用語が出てきた時に参照  
---

## 🔍 索引の使い方

この技術用語索引は、各章で登場する専門用語を体系的にまとめた学習支援リソースです：

- 📖 **アルファベット順**: 迅速な用語検索
- 🏷️ **タグ分類**: 関連概念の一括理解  
- 📍 **章リンク**: 詳細説明へのナビゲーション
- 💡 **実用例**: 具体的な使用場面

### 🏷️ タグ分類システム

| タグ | 説明 | 主要章 |
|:-----|:-----|:-------|
| `#database` | データベース関連技術 | Ch1,2,5,6 |
| `#auth` | 認証・認可技術 | Ch2,7 |
| `#api` | API・通信技術 | Ch1,3,4,5 |
| `#realtime` | リアルタイム通信 | Ch1,3,4 |
| `#security` | セキュリティ技術 | Ch2,7 |
| `#performance` | パフォーマンス技術 | Ch6,8 |
| `#architecture` | アーキテクチャ設計 | Ch3,4,5,9 |
| `#deployment` | デプロイ・運用 | Ch5,8 |

---

## 📖 技術用語索引

### A

#### **ACID**
`#database` `#transaction`
- **定義**: データベーストランザクションの4つの特性（Atomicity, Consistency, Isolation, Durability）
- **Supabaseでの実装**: PostgreSQLがACID特性を完全サポート
- **実用例**: 銀行の送金処理（途中で失敗しても中途半端な状態にならない）
- **参照章**: [Chapter 1: PostgreSQL詳細](./chapter01.md#postgresql-データの倉庫を詳しく見てみよう)

#### **API（Application Programming Interface）**
`#api` `#communication`
- **定義**: アプリケーション間でデータをやり取りする仕組み・約束事
- **Supabaseでの実装**: PostgRESTによる自動API生成
- **実用例**: フロントエンドからバックエンドへのデータ要求
- **参照章**: [Chapter 1: PostgREST](./chapter01.md#postgrest-api自動生成の魔法)

#### **Authentication（認証）**
`#auth` `#security`
- **定義**: 「あなたは誰ですか？」を確認する仕組み
- **Supabaseでの実装**: Supabase Auth + JWT
- **実用例**: ログイン・パスワード確認
- **参照章**: [Chapter 2: 認証・認可設計](./chapter02.md)

#### **Authorization（認可）**
`#auth` `#security`
- **定義**: 「何をする権限がありますか？」を制御する仕組み
- **Supabaseでの実装**: RLS（Row Level Security）
- **実用例**: 管理者のみが削除可能
- **参照章**: [Chapter 2: 認証・認可設計](./chapter02.md)

### B

#### **BaaS（Backend as a Service）**
`#architecture` `#cloud`
- **定義**: バックエンド機能をクラウドサービスとして提供する形態
- **Supabaseでの位置づけ**: オープンソースBaaS
- **実用例**: データベース・認証・ストレージを統合提供
- **参照章**: [Chapter 1: Supabase概要](./chapter01.md)

### C

#### **CRUD**
`#api` `#database`
- **定義**: Create（作成）・Read（読み取り）・Update（更新）・Delete（削除）の4つの基本操作
- **Supabaseでの実装**: PostgRESTが自動でCRUD APIを生成
- **実用例**: ブログ記事の作成・表示・編集・削除
- **参照章**: [Chapter 3: クライアントサイド実装](./chapter03.md)

#### **CI/CD**
`#deployment` `#automation`
- **定義**: 継続的インテグレーション・継続的デプロイメント
- **Supabaseでの実装**: GitHub Actions + Supabase CLI
- **実用例**: コード変更の自動テスト・自動デプロイ
- **参照章**: [Chapter 5-3: 本番運用](./chapter05-3.md)

### D

#### **Deno**
`#runtime` `#javascript`
- **定義**: TypeScript/JavaScriptのモダンなランタイム環境
- **Supabaseでの実装**: Edge Functions実行環境
- **実用例**: サーバーレス関数の実行
- **参照章**: [Chapter 4: Edge Functions](./chapter04.md)

#### **Docker**
`#containerization` `#deployment`
- **定義**: アプリケーションをコンテナ化する技術
- **Supabaseでの実装**: 開発環境・セルフホスト環境
- **実用例**: 一貫した開発環境の構築
- **参照章**: [Chapter 1: 開発環境構築](./chapter01.md#14-開発環境構築docker-compose)

### E

#### **Edge Functions**
`#serverless` `#api`
- **定義**: CDNエッジで実行されるサーバーレス関数
- **Supabaseでの実装**: Deno Runtime上で動作
- **実用例**: 決済処理・メール送信・複雑な計算
- **参照章**: [Chapter 4: Edge Functions活用](./chapter04.md)

### F

#### **FastAPI**
`#framework` `#python`
- **定義**: Python製の高性能Webフレームワーク
- **Supabaseでの組み合わせ**: 独立APIサーバーパターン
- **実用例**: 複雑なビジネスロジック・エンタープライズAPI
- **参照章**: [Chapter 5: 独立APIサーバー](./chapter05-1.md)

#### **Flet**
`#framework` `#python` `#ui`
- **定義**: PythonでネイティブUIアプリを作るフレームワーク
- **Supabaseでの組み合わせ**: クライアントサイドパターン
- **実用例**: デスクトップアプリ・内部管理ツール
- **参照章**: [Chapter 3: クライアントサイド実装](./chapter03.md)

### J

#### **JWT（JSON Web Token）**
`#auth` `#security`
- **定義**: 安全な情報交換のためのトークン形式
- **Supabaseでの実装**: 認証トークン・セッション管理
- **実用例**: ログイン状態の維持・API認証
- **参照章**: [Chapter 2: JWT詳細](./chapter02.md)

### K

#### **Kong Gateway**
`#api` `#gateway`
- **定義**: API ゲートウェイ・ルーティング・プロキシ
- **Supabaseでの実装**: 各サービスへのリクエスト振り分け
- **実用例**: API リクエストのルーティング・レート制限
- **参照章**: [Chapter 1: Supabase内部構造](./chapter01.md)

### M

#### **Multi-tenant（マルチテナント）**
`#architecture` `#saas`
- **定義**: 1つのシステムで複数の組織・顧客を安全に分離する設計
- **Supabaseでの実装**: RLS + 組織ID分離
- **実用例**: SaaS製品・複数企業の管理システム
- **参照章**: [Chapter 5-2: マルチテナンシー](./chapter05-2.md)

### P

#### **PostgreSQL**
`#database` `#sql`
- **定義**: 高機能・高信頼性のオープンソースリレーショナルデータベース
- **Supabaseでの位置づけ**: 中核データベースエンジン
- **実用例**: 全てのデータ保存・管理
- **参照章**: [Chapter 1: PostgreSQL詳細](./chapter01.md#postgresql-データの倉庫を詳しく見てみよう)

#### **PostgREST**
`#api` `#database`
- **定義**: PostgreSQLからREST APIを自動生成するツール
- **Supabaseでの実装**: API層の中核
- **実用例**: データベーススキーマからAPI自動作成
- **参照章**: [Chapter 1: PostgREST詳細](./chapter01.md#postgrest-api自動生成の魔法)

### R

#### **Realtime**
`#realtime` `#websocket`
- **定義**: データベース変更をリアルタイムで通知する仕組み
- **Supabaseでの実装**: WALベースのリアルタイム配信
- **実用例**: チャット・共同編集・ライブ更新
- **参照章**: [Chapter 1: Realtime詳細](./chapter01.md#realtime-リアルタイム通信)

#### **Redis**
`#cache` `#performance`
- **定義**: 高速インメモリデータストア・キャッシュ
- **Supabaseでの組み合わせ**: 独立APIサーバーでのキャッシュ層
- **実用例**: セッション保存・API レスポンスキャッシュ
- **参照章**: [Chapter 5-2: Redis活用](./chapter05-2.md)

#### **RLS（Row Level Security）**
`#security` `#database`
- **定義**: データベースの行レベルでアクセス制御を行う機能
- **Supabaseでの実装**: PostgreSQL RLS + JWT Claims
- **実用例**: ユーザーが自分のデータのみアクセス可能
- **参照章**: [Chapter 2: RLS実装](./chapter02.md)

### S

#### **SQL（Structured Query Language）**
`#database` `#query`
- **定義**: データベースの操作・問い合わせを行う言語
- **Supabaseでの実装**: PostgreSQL SQLの完全サポート
- **実用例**: データ取得・更新・分析
- **参照章**: 全章（特に[Chapter 1](./chapter01.md)）

#### **SQLAlchemy**
`#orm` `#python`
- **定義**: PythonのORM（オブジェクト関係マッピング）ライブラリ
- **Supabaseでの組み合わせ**: FastAPI + PostgreSQL連携
- **実用例**: Pythonコードでのデータベース操作
- **参照章**: [Chapter 5: SQLAlchemy活用](./chapter05-1.md)

### W

#### **WAL（Write-Ahead Log）**
`#database` `#realtime`
- **定義**: データベースの変更を事前にログ記録する仕組み
- **Supabaseでの実装**: Realtime機能の基盤技術
- **実用例**: データ変更のリアルタイム通知
- **参照章**: [Chapter 1: WAL機能](./chapter01.md#realtime-リアルタイム通信)

#### **WebSocket**
`#realtime` `#communication`
- **定義**: サーバーとクライアント間の双方向リアルタイム通信プロトコル
- **Supabaseでの実装**: Realtime機能の通信基盤
- **実用例**: チャット・ライブ更新・プッシュ通知
- **参照章**: [Chapter 1: WebSocket通信](./chapter01.md#realtime-リアルタイム通信)

---

## 🏷️ タグ別用語分類

### #database
- ACID, PostgreSQL, SQL, SQLAlchemy, WAL, RLS, CRUD

### #auth  
- Authentication, Authorization, JWT, RLS

### #api
- API, PostgREST, CRUD, Kong Gateway, FastAPI, Edge Functions

### #realtime
- Realtime, WAL, WebSocket

### #security
- Authentication, Authorization, RLS, JWT

### #performance  
- Redis, WAL, Edge Functions

### #architecture
- BaaS, Multi-tenant, Edge Functions, FastAPI, Flet

### #deployment
- Docker, CI/CD, Kong Gateway

---

## 📝 用語集活用まとめ

### ✅ **この用語集で得られるもの**
- ✅ 学習中の技術用語の即座な理解・確認
- ✅ 関連概念のタグベース一括学習
- ✅ 各章の詳細説明への効率的ナビゲーション
- ✅ 体系的な技術知識の整理・復習

### 🎯 **効果的な活用方法**
| 場面 | 活用方法 | 期待効果 |
|:-----|:---------|:---------|
| **章学習中** | 不明用語の即座確認 | 理解度向上・学習効率化 |
| **復習時** | タグ別一括確認 | 関連知識の体系的整理 |
| **実装時** | 技術仕様の再確認 | 正確な実装・品質向上 |
| **面接・発表** | 用語説明の準備 | 技術コミュニケーション力向上 |

---

**📍 ナビゲーション**
- **📚 目次**: [📖 学習ガイド](./textbook_index.md)
- **🏠 各章**: [Chapter 1-10](./textbook_index.md) での学習時に参照
- **🔧 関連リソース**: [付録](./appendix.md) | [トラブルシューティング](./troubleshooting_guide.md)
- **🌐 公式**: [Supabase公式ドキュメント](https://supabase.com/docs)