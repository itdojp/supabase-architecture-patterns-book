---
layout: book
order: 20
title: "コード検証ガイド [OK]"
---
# コード検証ガイド [OK]

---
**目次に戻る**: [はじめに]({{ '/introduction/' | relative_url }})  
**用途**: サンプルコード/手順が動くことを確認し、差分の破綻を早期に検出する  
**対象**: 開発者・レビュー担当  
**利用方法**: 章末の「動作検証」リンクから参照し、必要なチェックのみ実行  
---

## 最小チェック（推奨）

### 1) 原稿（src/）の静的チェック

```bash
npm test
```

補足:
- `npm test` は `npm run lint` と `npm run check-links` を実行します。
- 前提: Node.js 20+

### 2) GitHub Pages（docs/）のビルド確認

```bash
bundle exec jekyll build --source docs
```

補足:
- 前提: Ruby/Bundler（`Gemfile` 参照）
- `docs/_config.yml` を使用してビルドします。

## 参照（GitHub）

- サンプルコード: {{ site.repository }}/tree/main/src/examples/
- 統合チェックリスト: {{ site.repository }}/blob/main/INTEGRATION_CHECKLIST.md
- 変更履歴: {{ site.repository }}/blob/main/CHANGELOG.md

