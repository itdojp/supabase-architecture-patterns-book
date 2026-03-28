# 図版索引

## このページの使い方

本書で使っている主要な概念図を、章ごとに一覧できます。  
設計判断を振り返るときや、章の関連図を素早く確認したいときに参照してください。

## 図版一覧

| 図版 | 主な用途 | 関連章 | ファイル |
|---|---|---|---|
| Supabase 全体像 | 3 層構成の全体把握 | 第1章 | `docs/assets/images/diagrams/supabase-architecture.svg` |
| 認証フローと RLS | 認証と行レベル権限の関係確認 | 第2章 | `docs/assets/images/diagrams/auth-flow-rls.svg` |
| RLS セキュリティ | 行レベル権限の防御モデル確認 | 第2章 / 第7章 | `docs/assets/images/diagrams/rls-security.svg` |
| クライアント・Edge・API 比較 | パターン選定の比較確認 | 第3章〜第5章 | `docs/assets/images/diagrams/architecture-comparison.svg` |
| マルチテナンシーモデル | SaaS 向け分離設計の確認 | 第5-2章 | `docs/assets/images/diagrams/multi-tenancy-model.svg` |
| キャッシュ戦略 | パフォーマンス最適化の整理 | 第5-3章 / 第6章 | `docs/assets/images/diagrams/caching-strategy.svg` |
| Realtime アーキテクチャ | リアルタイム更新の流れ確認 | 第1章 / 第5-4章 | `docs/assets/images/diagrams/realtime-architecture.svg` |

## 参照のポイント

- 図版は本文の補助として使い、実装手順は各章本文を優先して確認してください。
- 章末や付録から図版を確認したい場合は、このページから該当章へ戻ると整理しやすくなります。
- 変更が入った場合は、図版そのものよりも「何を比較し、何を判断する図か」を優先して読み直してください。

## 関連ガイド

- [設計パターン選定ガイド](../pattern-selection/)
- [エラーハンドリングガイド](../error-handling/)
- [トラブルシューティングガイド](../troubleshooting/)
- [コード検証ガイド](../../../docs/guides/code-verification/index.md)
