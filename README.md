# Supabaseアーキテクチャパターン実践技術書

スケーラブルな3層構成の設計と実装 - 初心者から上級者まで段階的に学べる、Supabase完全マスターガイド

## オンライン版（推奨）

- [Supabaseアーキテクチャパターン実践技術書](https://itdojp.github.io/supabase-architecture-patterns-book/)

## この本について

Supabase を題材に、UI クライアント / API サーバー / BaaS（Supabase）を分離した「3層構成」の設計と実装パターンを、段階的に学ぶことを目的とした技術書です。

## まず読む場所

- はじめに: `docs/introduction/index.md`
- 第1章: `docs/chapters/chapter01/index.md`

## 目次

- `docs/index.md`（オンライン版の目次ページと同内容）

## Chapter 4 local-only 教材

Edge Functions の注文検証をローカルで実行する最小教材は、
`examples/chapter04-ecommerce/` にあります。Supabase CLI、migration、seed、
`process-order`、server-owned local catalog、handler-level Deno test、実行・停止手順を
同梱しています。

- 実行手順: `examples/chapter04-ecommerce/README.md`
- 対象範囲: `product_id` / `quantity` の入力検証、catalog価格による合計計算、ローカルスキーマ・seed
- 対象外: Stripe / SendGrid、注文永続化、remote project、production deploy

## ライセンス

- `LICENSE.md`（CC BY-NC-SA 4.0（商用は別契約） / シリーズ統一ライセンス準拠）

## 品質ゲート（開発者向け）

ローカルで最小確認を行う場合は、次を実行します。

- `npm run check:metadata`
- `npm run check:security`
- `npm test`
- `bundle exec jekyll build --source docs --config docs/_config.yml --destination _site`

`check:metadata` は `book-config.json`、`package.json`、`docs/_config.yml`、`docs/index.md`、`docs/_data/navigation.yml`、公開ページ、必須アセットの整合性を検証します。
`check:security` は任意依存を除いた npm 依存関係監査を実行し、既知脆弱性が残っていないことを検証します。

## 執筆・ビルド（開発者向け）

- クイックスタート: `QUICK-START.md`
- GitHub Pages: `GITHUB-PAGES-SETUP.md`
- 移行/運用: `MIGRATION-PLAN.md` / `UPGRADE-GUIDE.md`
