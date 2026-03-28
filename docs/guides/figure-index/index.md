---
layout: book
order: 13
title: "図版索引"
---
# 図版索引

## このページの使い方

本書で使っている主要な概念図を、章ごとに一覧できます。  
設計判断を振り返るときや、章の関連図を素早く確認したいときに参照してください。

## 図版一覧

| 図版 | 主な用途 | 関連章 | ファイル |
|---|---|---|---|
| Supabase 全体像 | 3 層構成の全体把握 | 第1章 | [supabase-architecture.svg]({{ '/assets/images/diagrams/supabase-architecture.svg' | relative_url }}) |
| 認証フローと RLS | 認証と行レベル権限の関係確認 | 第2章 | [auth-flow-rls.svg]({{ '/assets/images/diagrams/auth-flow-rls.svg' | relative_url }}) |
| RLS セキュリティ | 行レベル権限の防御モデル確認 | 第2章 / 第7章 | [rls-security.svg]({{ '/assets/images/diagrams/rls-security.svg' | relative_url }}) |
| クライアント・Edge・API 比較 | パターン選定の比較確認 | 第3章〜第5章 | [architecture-comparison.svg]({{ '/assets/images/diagrams/architecture-comparison.svg' | relative_url }}) |
| マルチテナンシーモデル | SaaS 向け分離設計の確認 | 第5-2章 | [multi-tenancy-model.svg]({{ '/assets/images/diagrams/multi-tenancy-model.svg' | relative_url }}) |
| キャッシュ戦略 | パフォーマンス最適化の整理 | 第5-3章 / 第6章 | [caching-strategy.svg]({{ '/assets/images/diagrams/caching-strategy.svg' | relative_url }}) |
| Realtime アーキテクチャ | リアルタイム更新の流れ確認 | 第1章 / 第5-4章 | [realtime-architecture.svg]({{ '/assets/images/diagrams/realtime-architecture.svg' | relative_url }}) |

## 参照のポイント

- 図版は本文の補助として使い、実装手順は各章本文を優先して確認してください。
- 章末や付録から図版を確認したい場合は、このページから該当章へ戻ると整理しやすくなります。
- 変更が入った場合は、図版そのものよりも「何を比較し、何を判断する図か」を優先して読み直してください。

## 関連ガイド

- [設計パターン選定ガイド]({{ '/guides/pattern-selection/' | relative_url }})
- [エラーハンドリングガイド]({{ '/guides/error-handling/' | relative_url }})
- [トラブルシューティングガイド]({{ '/guides/troubleshooting/' | relative_url }})
- [コード検証ガイド]({{ '/guides/code-verification/' | relative_url }})
