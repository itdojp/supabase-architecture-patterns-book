---
layout: book
order: 14
title: "概念マップ"
---
# 概念マップ

## このページの目的

このページは、本書の主要概念について、**誰が何を担当し、どの層に依存し、どの章を読めば設計判断を深められるか**を一つの関係マップとして示します。実装パターンの採否や用語の定義をここで完結させるのではなく、設計対象を俯瞰して次に読むべき章へ移動するために使います。

## 読み方と責務境界

| 知りたいこと | この概念マップで確認すること | 専用ガイドで行うこと |
|---|---|---|
| どの図を見ればよいか | 図が扱う概念と関連章 | [図版索引]({{ '/guides/figure-index/' | relative_url }})で公開済みの図版を探す。図版を追加・再分類しない。 |
| どの実装パターンを採用するか | パターンが置かれる責務層と依存先 | [設計パターン選定ガイド]({{ '/guides/pattern-selection/' | relative_url }})で要件、制約、トレードオフから採否を決める。 |
| 用語の意味を確認するか | 用語が関係する層と章 | [用語集]({{ '/guides/glossary/' | relative_url }})で定義、表記、実用例を検索する。 |

## 関係マップ

### 責務層

| 責務層 | 主な概念 | 担当すること | 主な依存先・関連章 |
|---|---|---|---|
| 利用者・クライアント層 | Flet などのクライアント、UI、セッション | 利用者の操作を受け、公開可能な API を呼び出す。秘密鍵を保持しない。 | [第3章：クライアントサイド実装]({{ '/chapters/chapter03/' | relative_url }})、[第7章：セキュリティ強化]({{ '/chapters/chapter07/' | relative_url }}) |
| アプリケーション境界層 | Edge Functions、独立 API サーバー、外部連携 | 入力検証、ユースケース、秘密情報を必要とする連携、複雑なビジネスロジックを隔離する。 | [第4章：Edge Functions 活用]({{ '/chapters/chapter04/' | relative_url }})、[第5-1章：独立 API サーバー]({{ '/chapters/chapter05-1/' | relative_url }}) |
| Supabase サービス層 | Auth、JWT、PostgREST、Storage、Realtime | 認証済みの主体を API とデータサービスへ接続し、保存・配信・ファイル操作を提供する。 | [第1章：Supabase アーキテクチャ理解]({{ '/chapters/chapter01/' | relative_url }})、[第2章：認証・認可設計]({{ '/chapters/chapter02/' | relative_url }}) |
| データ・テナント層 | PostgreSQL、SQL、RLS、組織 ID、ベクトル検索 | 永続データ、テナント分離、行単位のアクセス制御、検索用データを管理する。 | [第5-2章：マルチテナンシー]({{ '/chapters/chapter05-2/' | relative_url }})、[第5-4章：RAG/ベクトル検索]({{ '/chapters/chapter05-4/' | relative_url }}) |
| 運用・改善層 | 監視、ログ、バックアップ、キャッシュ、CI/CD | 可観測性、復旧、性能の継続的な検証と改善を担う。 | [第5-3章：拡張性設計とパフォーマンス最適化]({{ '/chapters/chapter05-3/' | relative_url }})、[第6章：パフォーマンス最適化]({{ '/chapters/chapter06/' | relative_url }})、[第8章：運用監視と自動化]({{ '/chapters/chapter08/' | relative_url }}) |

### 依存関係

主要な依存関係は、次の順序で読みます。

1. **利用者の操作**は、クライアント層で UI とセッションに変換されます。
2. クライアントは **Supabase Auth が発行・検証に関わる JWT** を使い、公開 API を呼び出します。クライアントから直接到達させる操作も、データ層の制約を省略しません。
3. 操作の複雑さ、秘密情報、外部連携が必要になった場合は、**Edge Functions** または **独立 API サーバー**をアプリケーション境界として置きます。どちらも Supabase の認証・データサービスに依存します。
4. **PostgREST、Storage、Realtime** は Supabase サービス層の入口であり、**PostgreSQL** が永続データの基盤です。認可は JWT の主体と **RLS** を結び、データ到達時に適用します。
5. **マルチテナント設計、キャッシュ、監視、バックアップ、CI/CD** は特定の一層だけで完結しません。各層の変更を運用・改善層で観測し、設計へフィードバックします。

| 起点 | 依存する概念 | 設計上の確認事項 | 関連章 |
|---|---|---|---|
| クライアント直結 | Auth、公開 API、PostgreSQL の RLS | 公開可能なキーだけを扱い、利用者ごとのデータ範囲を RLS で制御できるか。 | [第2章]({{ '/chapters/chapter02/' | relative_url }})、[第3章]({{ '/chapters/chapter03/' | relative_url }}) |
| Edge Functions | Auth/JWT、Supabase API、外部サービス | 関数側で検証・署名確認・秘密情報の境界を明示できるか。 | [第4章]({{ '/chapters/chapter04/' | relative_url }})、[第7章]({{ '/chapters/chapter07/' | relative_url }}) |
| 独立 API サーバー | Auth/JWT、PostgreSQL、キャッシュ、外部サービス | ドメインロジック、接続管理、監視を API 境界へ集約する必要があるか。 | [第5-1章]({{ '/chapters/chapter05-1/' | relative_url }})、[第5-3章]({{ '/chapters/chapter05-3/' | relative_url }}) |
| Realtime / RAG | Realtime、WAL、ベクトル検索、データ分離 | 配信対象・検索対象のテナント境界、性能、運用監視を同時に満たせるか。 | [第5-2章]({{ '/chapters/chapter05-2/' | relative_url }})、[第5-4章]({{ '/chapters/chapter05-4/' | relative_url }})、[第6章]({{ '/chapters/chapter06/' | relative_url }}) |

### 横断関心事

| 横断関心事 | 関係する層 | 俯瞰時の問い | 深掘り先 |
|---|---|---|---|
| セキュリティ | クライアント、アプリケーション境界、サービス、データ | 秘密鍵は境界の内側だけにあり、認証後のデータ操作を RLS と操作別ポリシーで拒否できるか。 | [第2章：認証・認可設計]({{ '/chapters/chapter02/' | relative_url }})、[第7章：セキュリティ強化]({{ '/chapters/chapter07/' | relative_url }}) |
| テナント分離 | データ、サービス、アプリケーション境界 | 組織 ID と RLS の条件が読み取り・更新・Storage・検索に一貫しているか。 | [第5-2章：マルチテナンシー]({{ '/chapters/chapter05-2/' | relative_url }}) |
| 性能・拡張性 | アプリケーション境界、サービス、データ、運用 | キャッシュ、接続、クエリ、Realtime、ベクトル検索の負荷を観測し、ボトルネックを層ごとに切り分けられるか。 | [第5-3章]({{ '/chapters/chapter05-3/' | relative_url }})、[第6章]({{ '/chapters/chapter06/' | relative_url }}) |
| 運用・品質 | 全層 | migration、テスト、ログ、監視、バックアップ、復旧手順を変更の一部として検証できるか。 | [第8章：運用監視と自動化]({{ '/chapters/chapter08/' | relative_url }})、[第10章：統合実践プロジェクト]({{ '/chapters/chapter10/' | relative_url }}) |
| 設計選択 | 全層 | 要件と制約から、クライアント直結・Edge Functions・独立 API サーバーのどれを採るか。 | [第9章：アーキテクチャ選択演習]({{ '/chapters/chapter09/' | relative_url }})、[設計パターン選定ガイド]({{ '/guides/pattern-selection/' | relative_url }}) |

## 次に読む場所

- 構成要素と Supabase の全体像を確認する: [第1章：Supabase アーキテクチャ理解]({{ '/chapters/chapter01/' | relative_url }})
- 認証、JWT、RLS の責任分担を確認する: [第2章：認証・認可設計]({{ '/chapters/chapter02/' | relative_url }})
- 実装パターンの採否を決める: [設計パターン選定ガイド]({{ '/guides/pattern-selection/' | relative_url }})
- 本書の既存図版を探す: [図版索引]({{ '/guides/figure-index/' | relative_url }})
- 用語の定義を検索する: [用語集]({{ '/guides/glossary/' | relative_url }})
- 設計を統合演習で検証する: [第10章：統合実践プロジェクト]({{ '/chapters/chapter10/' | relative_url }})
