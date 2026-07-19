# Chapter 4: local-only Edge Function 教材

Chapter 4 の注文処理を、ローカル Supabase で確認するための最小教材です。リポジトリルートの
`package.json` は Supabase CLI `2.109.1` と Deno `2.9.3` を exact pin しています。

## 同梱範囲

- `supabase/config.toml`: local-only プロジェクトと `process-order` の設定
- `supabase/migrations/20260719000000_create_order_example.sql`: 商品・注文の最小スキーマ
- `supabase/seed.sql`: ローカル確認用の商品データ
- `supabase/functions/process-order/index.ts`: HTTP エントリーポイント
- `supabase/functions/process-order/handler.ts`: `Request` / `Response` のHTTP handler
- `supabase/functions/process-order/catalog.json`: server-owned local商品catalog
- `supabase/functions/process-order/catalog.ts`: catalog lookup
- `supabase/functions/process-order/order.ts`: 注文検証と合計計算の純粋ロジック
- `supabase/functions/process-order/order_test.ts`: catalog・注文ロジックのDeno unit test
- `supabase/functions/process-order/handler_test.ts`: HTTP handler-level Deno test

requestが受け付ける商品項目は `product_id` と `quantity` だけです。
単価と商品名はserver-owned local catalogから確定します。clientが `unit_price_yen` を送信した場合は値が正しくても拒否します。

この教材が実行するのは、入力検証とserver-sideの合計金額計算までです。注文の永続化、認証・
認可、在庫引当、決済、メール送信、ブラウザclient、remote projectへのdeployは実装して
いません。Chapter 4のStripe / SendGridコードはアーキテクチャ上の設計例であり、この教材の
実動機能ではありません。

## unit test

リポジトリルートで実行します。Deno は npm の dev dependency から起動し、テストにファイル・
ネットワーク・環境変数の権限を付与しません。

```bash
mise exec node@24 -- npm ci
mise exec node@24 -- npm run test:chapter04-example
```

`npm test` からも同じ Deno test と教材 checker が実行されます。

Dockerが利用可能で、対象portとproject IDが未使用の場合だけlocal stack smokeを実行できます。
Dockerへ接続できない場合は安全にskipし、`npm test`には含めません。

```bash
mise exec node@24 -- npm run smoke:chapter04-local
```

## ローカル Supabase での実行

前提は、Docker または Docker 互換のコンテナランタイムが起動していることです。remote project、
Supabase のログイン、API key、`.env` は不要です。

```bash
cd examples/chapter04-ecommerce

# local stackを起動し、migrationとseedを再適用する
mise exec node@24 -- npx supabase start
mise exec node@24 -- npx supabase db reset

# 別ターミナルで起動する。config.tomlのlocal-only設定によりJWT検証は無効
mise exec node@24 -- npx supabase functions serve process-order
```

別ターミナルから入力検証と合計計算を確認します。

```bash
curl --fail-with-body \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"items":[{"product_id":1,"quantity":2},{"product_id":3,"quantity":1}]}' \
  http://127.0.0.1:54321/functions/v1/process-order
```

レスポンスの `status` は `validated`、`total_amount_yen` は `1610` です。
レスポンスの `name` と `unit_price_yen` はclient入力ではなくlocal catalogの値です。
`persistence` が `not_performed` であることは、スキーマ教材と永続化実装の境界を表します。

## 終了

起動したターミナルで `Ctrl-C` を入力した後、この教材の project ID だけを指定して停止します。
`--no-backup` は教材用 volume も削除します。

```bash
mise exec node@24 -- npx supabase stop \
  --project-id chapter04-ecommerce \
  --no-backup
```

> **LOCAL-ONLY / NONDEPLOY**: `verify_jwt = false` は認証を扱わないローカル教材だけの設定です。
> このprojectをlinkしたり、このFunctionをremote projectへdeployしたりしないでください。

productionでは、requestの価格を信用せず、DBからauthoritativeな商品価格を同一transaction内で
取得し、在庫確認・引当・注文保存までを原子的に実行する必要があります。認証・認可、冪等性、
監査も別途必要です。local catalogはその境界を説明する教材であり、production DBの代替では
ありません。

## 一次資料

- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Getting Started with Edge Functions](https://supabase.com/docs/guides/functions/quickstart)
- [Database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Testing your Edge Functions](https://supabase.com/docs/guides/functions/unit-test)
- [Deno `test` CLI](https://docs.deno.com/runtime/reference/cli/test/)
