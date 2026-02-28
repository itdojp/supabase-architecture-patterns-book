# 第4章：パターン2 - Edge Functions活用

---
**📚 目次に戻る**: [はじめに](../../introduction/)  
**⬅️ 前の章**: [第3章：パターン1 - クライアントサイド実装](../chapter03/)  
**➡️ 次の章**: [第5-1章：パターン3 - 独立APIサーバー](../chapter05-1/)  
**🏗️ アーキテクチャ**: Edge Functions（サーバーレス関数）  
**🎯 学習レベル**: 🌱 基礎 | 🚀 応用 | 💪 発展  
**⏱️ 推定学習時間**: 4〜6時間  
**📝 難易度**: 中級（JavaScript/TypeScript知識必要）
---

## 🧭 この章で扱う構成
- 構成: Edge Functions（サーバーレス実装）
- 推奨用途: 軽量API・外部連携・低レイテンシ処理
- 非推奨用途: 長時間バッチや重い計算を前提とするケース

## 🔄 **前章の復習**（Chapter 3からの継続）

Chapter 3で学んだ**クライアントサイド実装**を振り返りましょう：
- ✅ **Python Flet**: デスクトップアプリ的なUI開発
- ✅ **Supabase Client**: データベースとの直接通信
- ✅ **リアルタイム**: データ変更の即座反映
- ✅ **適用場面**: 個人・小規模チーム（〜5,000人）の迅速開発

しかし、クライアントサイドでは**処理できない複雑な業務**があります。今度はサーバーサイドで処理する仕組みを学びます。

> 💡 **Chapter 3の理解度確認**: クライアントサイド実装のメリット・制約を説明できますか？不安な場合は[Chapter 3](../chapter03/)を復習してください。

## 🎯 この章で学ぶこと（初心者向け）

この章では、**「コンビニ弁当」**的なアプローチでSupabaseを使った本格的なECサイトを作ります。

- 🌱 **初心者**: サーバーレス関数がどのように動くかがわかる
- 🚀 **中級者**: 複雑なビジネスロジックをサーバーサイドで処理する方法がわかる  
- 💪 **上級者**: 外部API連携とトランザクション処理の設計パターンが理解できる

## 💡 まずは身近な例から：「オンラインショップ」

想像してみてください。あなたが**オンラインでお弁当を注文**するとします：

```text
🛒 オンライン弁当ショップ
├── 👤 お客さん：「から揚げ弁当 × 2」をカートに追加
├── 💳 決済：クレジットカードで支払い
├── 📧 確認：注文確認メールが届く
├── 🍱 調理：お店で弁当を作る
├── 🚚 配送：配達員が届ける
└── 📊 記録：売上と在庫の管理
```

### 🤔 なぜサーバーサイド処理が必要？

Chapter 3のクライアントサイドだけでは処理できない複雑な業務があります：

| 処理 | クライアントサイド | サーバーサイド | なぜ？ |
|:-----|:------------------|:---------------|:-------|
| 💳 **決済処理** | ❌ 危険 | ✅ 安全 | カード情報は絶対にクライアントで扱えない |
| 📦 **在庫管理** | ❌ 不正確 | ✅ 正確 | 複数人が同時注文すると売り越しリスク |
| 📧 **メール送信** | ❌ 不可能 | ✅ 可能 | 外部API連携はサーバーでのみ可能 |
| 🏪 **複雑な計算** | ⚠️ 改ざんリスク | ✅ 安全 | 税計算・割引計算は改ざんされる可能性 |

### 🎉 パターン2（Edge Functions）なら...

```mermaid
flowchart TD
    A[📱 お客さんのアプリ] --> B[🛒 注文ボタン]
    B --> C[☁️ Edge Function<br/>注文処理サーバー]
    
    C --> D[💳 決済API<br/>Stripe]
    C --> E[📦 在庫チェック<br/>PostgreSQL]
    C --> F[📧 メール送信<br/>SendGrid]
    C --> G[📊 売上記録<br/>PostgreSQL]
    
    D --> H[✅ 処理完了]
    E --> H
    F --> H
    G --> H
    H --> I[📱 お客さんに結果通知]
```

**メリット**：
- 🔒 **セキュア**: 重要な処理をサーバーサイドで安全に実行
- ⚡ **高速**: 世界中のエッジサーバーで処理（低レイテンシ）
- 🔧 **スケーラブル**: アクセス増加時も自動でスケール
- 💰 **コスト効率**: 使った分だけの従量課金

---

## 🏗️ 今回作るアプリ：「ECサイト注文処理システム」

### 📱 どんなアプリ？

**オンライン弁当ショップ**のような本格的なECサイトを作ります：

```text
🛒 オンライン弁当ショップ
├── 📱 フロントエンド：商品一覧・カート・注文画面
├── ☁️ Edge Functions：注文処理・決済・メール送信
├── 🏪 商品管理：在庫・価格・カテゴリ管理
└── 📊 管理画面：売上分析・注文状況監視
```

### ✨ 実装する機能

| 機能 | 初心者向け説明 | 技術的な説明 |
|------|:-------------:|:-------------|
| 🛒 **注文処理** | カートの商品を確定注文に変換 | Edge Function で複雑なビジネスロジック処理 |
| 💳 **決済処理** | クレジットカード決済 | Stripe API との安全な連携 |
| 📦 **在庫管理** | 注文時の在庫減算・売り越し防止 | PostgreSQL トランザクション処理 |
| 📧 **通知システム** | 注文確認・配送通知メール | SendGrid API でのメール自動送信 |
| 📊 **売上分析** | 日次・月次の売上集計 | SQL集計クエリとリアルタイム更新 |

### 🛠️ 使用技術（初心者向け説明）

```text
☁️ サーバーレス関数: Edge Functions (Deno)
   └─ 「必要な時だけ動くクラウド上の小さなプログラム」

📱 フロントエンド: TypeScript クライアント
   └─ 「ユーザーが触る画面部分」

💳 決済処理: Stripe API
   └─ 「クレジットカード決済を安全に処理する外部サービス」

📧 メール送信: SendGrid API
   └─ 「注文確認メールなどを自動送信する外部サービス」

🗄️ データベース: PostgreSQL + RLS
   └─ 「商品・注文・ユーザー情報を安全に保存」
```

### 📂 今回作成したソースコードの場所

```bash
📁 src/chapter04-ecommerce/
├── 📁 supabase/functions/           # ← サーバーレス関数
│   └── 📁 process-order/           # ← 注文処理の関数
│       ├── 📄 index.ts             # ← メイン処理（ここが一番重要！）
│       ├── 📁 handlers/            # ← 各種処理ハンドラ
│       ├── 📁 services/            # ← 外部API連携
│       └── 📁 utils/               # ← ユーティリティ
├── 📁 client/                      # ← フロントエンド
│   ├── 📄 order-client.ts          # ← 注文画面のロジック
│   └── 📄 package.json             # ← 必要なライブラリ一覧
└── 📁 database/                    # ← データベース設定
    └── 📄 order_functions.sql      # ← カスタムSQL関数
```

> 💡 **重要**: これらのコードは実際に動作する完全なECサイトです！
> Stripe（テストモード）との連携も含まれています。

---

## 🔍 実際のコードを見てみよう！

このセクションでは、作成したECサイトの**実際のソースコード**を段階的に説明します。

### 📄 Step 1: Edge Function のエントリーポイント（index.ts）

まず、注文処理を行うサーバーレス関数を見てみましょう：

```typescript
// src/chapter04-ecommerce/supabase/functions/process-order/index.ts（抜粋）

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// 注文リクエストの形を定義
interface OrderRequest {
  action: 'create' | 'update_status' | 'process_payment' | 'send_notification'
  order_data?: {
    user_id: string
    items: Array<{
      product_id: number
      quantity: number
    }>
    shipping_address: {
      name: string
      address: string
      city: string
      postal_code: string
      phone: string
    }
    payment_method: string
  }
  order_id?: string
  status?: string
}

// メイン処理関数
serve(async (req: Request): Promise<Response> => {
  try {
    // 1. 認証チェック
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('認証ヘッダーが必要です')
    }

    // 2. Supabaseに接続
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
    )

    // 3. ユーザー認証
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('無効な認証トークンです')
    }

    // 4. リクエストデータ取得
    const requestData: OrderRequest = await req.json()

    // 5. アクションに応じた処理実行
    let result
    switch (requestData.action) {
      case 'create':
        result = await createOrder(supabase, user.id, requestData.order_data!)
        break
      case 'process_payment':
        result = await processPayment(supabase, requestData.order_id!, requestData.payment_data!)
        break
      case 'send_notification':
        result = await sendNotification(supabase, requestData.order_id!)
        break
      default:
        throw new Error('無効なアクションです')
    }

    // 6. 結果をレスポンスとして返す
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    // エラーが発生した場合の処理
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
```

**🔰 初心者向け解説**：

| コード部分 | 何をしているか | 身近な例 |
|:----------|:-------------|:---------|
| `serve()` | HTTPリクエストを受け取る | コンビニの店員がお客さんの注文を聞く |
| `interface OrderRequest` | 注文データの形を決める | 注文用紙の書式を決める |
| 認証チェック | 誰が注文しているかを確認 | 会員カードの確認 |
| `switch (action)` | 要求に応じて処理を分岐 | 「購入」「返品」「問い合わせ」で対応を変える |
| `try/catch` | エラーが起きた時の対処 | 何か問題があったらお客さんに謝罪・説明 |

### 📄 Step 2: 注文作成処理（createOrder）

実際の注文処理がどのように行われるかを見てみましょう：

```typescript
// 注文作成処理（簡略化版）
async function createOrder(supabase: any, userId: string, orderData: any) {
  // 1. トランザクション開始
  const { data, error } = await supabase.rpc('create_order_transaction', {
    p_user_id: userId,
    p_items: orderData.items,
    p_shipping_address: orderData.shipping_address
  })
  
  if (error) {
    throw new Error(`注文作成エラー: ${error.message}`)
  }
  
  // 2. 在庫チェック・更新
  for (const item of orderData.items) {
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', item.product_id)
      .single()
    
    if (product.stock_quantity < item.quantity) {
      throw new Error(`商品ID ${item.product_id} の在庫が不足しています`)
    }
    
    // 在庫減算
    await supabase
      .from('products')
      .update({ 
        stock_quantity: product.stock_quantity - item.quantity 
      })
      .eq('id', item.product_id)
  }
  
  // 3. 注文レコード作成
  const { data: newOrder } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      status: 'pending',
      total_amount: calculateTotal(orderData.items),
      shipping_address: orderData.shipping_address,
      created_at: new Date().toISOString()
    })
    .select()
    .single()
  
  return { success: true, order_id: newOrder.id }
}
```

**🔰 初心者向け解説**：

| 処理 | 何をしているか | 身近な例 |
|:-----|:-------------|:---------|
| **トランザクション** | 複数の処理をまとめて実行 | 銀行振込で「引き落とし」と「入金」を同時実行 |
| **在庫チェック** | 商品の残りを確認 | 店員が「その商品、在庫ありますか？」を確認 |
| **在庫更新** | 購入分を在庫から減らす | レジで商品をスキャンして在庫から除く |
| **注文レコード作成** | 注文情報をデータベースに保存 | レシートを発行して記録を残す |

### 📄 Step 3: 決済処理との連携（processPayment）

Stripe APIとの連携部分を見てみましょう：

```typescript
// 決済処理（簡略化版）
async function processPayment(supabase: any, orderId: string, paymentData: any) {
  try {
    // 1. Stripe APIに決済リクエスト送信
    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        amount: paymentData.amount.toString(),
        currency: 'jpy',
        payment_method: paymentData.payment_method_id,
        confirm: 'true'
      })
    })
    
    const paymentResult = await stripeResponse.json()
    
    // 2. 決済成功時の処理
    if (paymentResult.status === 'succeeded') {
      // 注文ステータスを「支払い完了」に更新
      await supabase
        .from('orders')
        .update({ 
          status: 'paid',
          payment_id: paymentResult.id,
          paid_at: new Date().toISOString()
        })
        .eq('id', orderId)
      
      // 3. 注文確認メール送信
      await sendOrderConfirmationEmail(orderId)
      
      return { success: true, payment_id: paymentResult.id }
    } else {
      throw new Error('決済に失敗しました')
    }
    
  } catch (error) {
    // 決済失敗時は注文をキャンセル
    await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
    
    throw error
  }
}
```

**🔰 初心者向け解説**：

| 処理 | 何をしているか | 身近な例 |
|:-----|:-------------|:---------|
| **Stripe API呼び出し** | 外部の決済システムに依頼 | コンビニでクレジットカード端末を操作 |
| **決済確認** | 支払いが成功したかチェック | 「カードが通りました」の確認 |
| **ステータス更新** | 注文状況を「支払い完了」に変更 | レシートに「支払い済み」のスタンプ |
| **エラー処理** | 決済失敗時は注文をキャンセル | カードエラーの場合は購入をキャンセル |

---

## サンプルアプリ概要: ECサイト注文処理システム

### 機能要件

- **商品管理**: 在庫管理・価格設定・カテゴリ分類
- **注文処理**: カート管理・注文確定・在庫減算
- **決済連携**: Stripe決済・支払い状況管理
- **通知システム**: 注文確認・配送通知メール
- **管理機能**: 注文状況監視・売上分析

### アーキテクチャ設計

```mermaid
graph TB
    Client[Flet Frontend] --> Kong[Kong Gateway]
    Kong --> PostgREST[PostgREST API]
    Kong --> EdgeFunctions[Edge Functions]
    
    EdgeFunctions --> PostgreSQL[(PostgreSQL)]
    EdgeFunctions --> Stripe[Stripe API]
    EdgeFunctions --> SendGrid[SendGrid API]
    EdgeFunctions --> Redis[(Redis Cache)]
    
    PostgreSQL --> Realtime[Realtime Server]
    Realtime --> Client
```

---

## 4.1 Deno Edge Functions構成

### プロジェクト構造

```text
ecommerce-platform/
├── supabase/
│   ├── functions/
│   │   ├── process-order/
│   │   │   ├── index.ts           # 注文処理エントリーポイント
│   │   │   ├── handlers/          # ビジネスロジックハンドラ
│   │   │   ├── services/          # 外部サービス連携
│   │   │   ├── models/            # 型定義
│   │   │   └── utils/             # ユーティリティ
│   │   ├── webhook-stripe/
│   │   │   └── index.ts           # Stripe Webhook処理
│   │   ├── send-notifications/
│   │   │   └── index.ts           # 通知処理
│   │   ├── inventory-management/
│   │   │   └── index.ts           # 在庫管理
│   │   └── _shared/               # 共通ライブラリ
│   │       ├── database.ts        # DB接続
│   │       ├── auth.ts            # 認証ヘルパー
│   │       ├── validation.ts      # バリデーション
│   │       └── errors.ts          # エラーハンドリング
│   ├── migrations/
│   └── config.toml
├── frontend/
│   └── flet-client/               # Fletクライアント
└── scripts/
    ├── deploy.sh                  # デプロイスクリプト
    └── test-functions.sh          # テストスクリプト
```

### 基本設定とユーティリティ

```typescript
// supabase/functions/_shared/database.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

export interface DatabaseConfig {
  url: string
  serviceKey: string
  schema?: string
}

export class DatabaseConnection {
  private static instance: DatabaseConnection
  private client: any

  private constructor(config: DatabaseConfig) {
    this.client = createClient(config.url, config.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: config.schema || 'public'
      }
    })
  }

  public static getInstance(config?: DatabaseConfig): DatabaseConnection {
    if (!DatabaseConnection.instance && config) {
      DatabaseConnection.instance = new DatabaseConnection(config)
    } else if (!DatabaseConnection.instance) {
      throw new Error('Database configuration required for first initialization')
    }
    return DatabaseConnection.instance
  }

  public getClient() {
    return this.client
  }

  // トランザクション実行
  public async withTransaction<T>(
    operation: (client: any) => Promise<T>
  ): Promise<T> {
    // PostgreSQLトランザクション開始
    const { data: startResult, error: startError } = await this.client
      .rpc('begin_transaction')

    if (startError) {
      throw new Error(`Transaction start failed: ${startError.message}`)
    }

    try {
      const result = await operation(this.client)
      
      // コミット
      const { error: commitError } = await this.client
        .rpc('commit_transaction')
      
      if (commitError) {
        throw new Error(`Transaction commit failed: ${commitError.message}`)
      }
      
      return result
    } catch (error) {
      // ロールバック
      await this.client.rpc('rollback_transaction')
      throw error
    }
  }
}

// 初期化ヘルパー
export function initDatabase(): DatabaseConnection {
  const config: DatabaseConfig = {
    url: Deno.env.get('SUPABASE_URL')!,
    serviceKey: Deno.env.get('SUPABASE_SECRET_KEY')!
  }
  
  return DatabaseConnection.getInstance(config)
}
```

```typescript
// supabase/functions/_shared/auth.ts
import { verify } from 'https://deno.land/x/djwt@v3.0.1/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

export interface AuthContext {
  user: {
    id: string
    email: string
    role: string
    metadata?: any
  } | null
  isAuthenticated: boolean
}

export class AuthService {
  private jwtSecret: string

  constructor() {
    this.jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET')!
  }

  public async validateRequest(request: Request): Promise<AuthContext> {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, isAuthenticated: false }
    }

    const token = authHeader.substring(7)
    
    try {
      const payload = await verify(token, this.jwtSecret, 'HS256')
      
      return {
        user: {
          id: payload.sub as string,
          email: payload.email as string,
          role: payload.role as string,
          metadata: payload.user_metadata
        },
        isAuthenticated: true
      }
    } catch (error) {
      console.error('JWT validation failed:', error)
      return { user: null, isAuthenticated: false }
    }
  }

  public requireAuth(authContext: AuthContext): void {
    if (!authContext.isAuthenticated || !authContext.user) {
      throw new Error('Authentication required')
    }
  }

  public requireRole(authContext: AuthContext, requiredRole: string): void {
    this.requireAuth(authContext)
    
    if (authContext.user!.role !== requiredRole) {
      throw new Error(`Role ${requiredRole} required`)
    }
  }
}

export const authService = new AuthService()
```

### 型定義とモデル

```typescript
// supabase/functions/_shared/models.ts
export interface Product {
  id: number
  name: string
  description: string
  price: number
  category_id: number
  stock_quantity: number
  sku: string
  image_urls: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CartItem {
  product_id: number
  quantity: number
  unit_price: number
}

export interface Order {
  id?: number
  user_id: string
  status: OrderStatus
  total_amount: number
  tax_amount: number
  shipping_amount: number
  currency: string
  shipping_address: Address
  billing_address: Address
  payment_method_id?: string
  stripe_payment_intent_id?: string
  items: OrderItem[]
  created_at?: string
  updated_at?: string
}

export interface OrderItem {
  id?: number
  order_id?: number
  product_id: number
  quantity: number
  unit_price: number
  total_price: number
  product_snapshot: Partial<Product>
}

export interface Address {
  street: string
  city: string
  state: string
  postal_code: string
  country: string
  phone?: string
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export interface OrderRequest {
  cart_items: CartItem[]
  shipping_address: Address
  billing_address: Address
  payment_method_id: string
}

export interface OrderResponse {
  order: Order
  payment_client_secret?: string
  requires_action?: boolean
}
```

### バリデーション

```typescript
// supabase/functions/_shared/validation.ts
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export interface ValidationRule<T> {
  validate: (value: T) => boolean | Promise<boolean>
  message: string
}

export class Validator<T> {
  private rules: ValidationRule<T>[] = []

  public addRule(rule: ValidationRule<T>): this {
    this.rules.push(rule)
    return this
  }

  public async validate(value: T): Promise<void> {
    for (const rule of this.rules) {
      const isValid = await rule.validate(value)
      if (!isValid) {
        throw new ValidationError(rule.message)
      }
    }
  }
}

// 基本バリデーションルール
export const ValidationRules = {
  required: <T>(message = 'This field is required'): ValidationRule<T> => ({
    validate: (value) => value !== null && value !== undefined && value !== '',
    message
  }),

  email: (message = 'Invalid email format'): ValidationRule<string> => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value) => value.length >= min,
    message: message || `Minimum length is ${min}`
  }),

  positiveNumber: (message = 'Must be a positive number'): ValidationRule<number> => ({
    validate: (value) => value > 0,
    message
  }),

  inRange: (min: number, max: number): ValidationRule<number> => ({
    validate: (value) => value >= min && value <= max,
    message: `Value must be between ${min} and ${max}`
  })
}

// 注文バリデーション
export async function validateOrderRequest(orderRequest: OrderRequest): Promise<void> {
  // カートアイテム検証
  if (!orderRequest.cart_items || orderRequest.cart_items.length === 0) {
    throw new ValidationError('Cart cannot be empty')
  }

  for (const item of orderRequest.cart_items) {
    await new Validator<number>()
      .addRule(ValidationRules.positiveNumber('Product ID must be positive'))
      .validate(item.product_id)
    
    await new Validator<number>()
      .addRule(ValidationRules.inRange(1, 100))
      .validate(item.quantity)
  }

  // 住所検証
  await validateAddress(orderRequest.shipping_address, 'shipping')
  await validateAddress(orderRequest.billing_address, 'billing')
}

async function validateAddress(address: Address, type: string): Promise<void> {
  const requiredFields = ['street', 'city', 'state', 'postal_code', 'country']
  
  for (const field of requiredFields) {
    await new Validator<string>()
      .addRule(ValidationRules.required(`${type} ${field} is required`))
      .addRule(ValidationRules.minLength(1))
      .validate((address as any)[field])
  }
}
```

---

## 4.2 トランザクション処理と外部API連携

### 注文処理メイン関数

```typescript
// supabase/functions/process-order/index.ts
import { serve } from 'https://deno.land/std@0.207.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { authService } from '../_shared/auth.ts'
import { initDatabase } from '../_shared/database.ts'
import { validateOrderRequest } from '../_shared/validation.ts'
import { OrderProcessor } from './handlers/order-processor.ts'
import { ErrorHandler } from '../_shared/errors.ts'

serve(async (req: Request) => {
  // CORS処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 認証確認
    const authContext = await authService.validateRequest(req)
    authService.requireAuth(authContext)

    // リクエスト解析
    const orderRequest = await req.json()
    await validateOrderRequest(orderRequest)

    // データベース初期化
    const db = initDatabase()
    
    // 注文処理実行
    const orderProcessor = new OrderProcessor(db, authContext.user!)
    const result = await orderProcessor.processOrder(orderRequest)

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    return ErrorHandler.handleError(error, req)
  }
})
```

### 注文処理ハンドラー

```typescript
// supabase/functions/process-order/handlers/order-processor.ts
import { DatabaseConnection } from '../../_shared/database.ts'
import { Order, OrderRequest, OrderResponse, OrderStatus, OrderItem } from '../../_shared/models.ts'
import { InventoryService } from '../services/inventory-service.ts'
import { PaymentService } from '../services/payment-service.ts'
import { NotificationService } from '../services/notification-service.ts'

export class OrderProcessor {
  private inventoryService: InventoryService
  private paymentService: PaymentService
  private notificationService: NotificationService

  constructor(
    private db: DatabaseConnection,
    private user: { id: string; email: string }
  ) {
    this.inventoryService = new InventoryService(db)
    this.paymentService = new PaymentService()
    this.notificationService = new NotificationService()
  }

  public async processOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    return await this.db.withTransaction(async (client) => {
      // 1. 在庫確認・予約
      const inventoryReservation = await this.inventoryService
        .reserveInventory(orderRequest.cart_items)
      
      try {
        // 2. 注文作成
        const order = await this.createOrder(orderRequest, inventoryReservation.total_amount)
        
        // 3. 決済処理開始
        const paymentResult = await this.paymentService.createPaymentIntent({
          amount: order.total_amount,
          currency: order.currency,
          order_id: order.id!,
          customer_email: this.user.email,
          payment_method_id: orderRequest.payment_method_id
        })

        // 4. 注文更新（決済情報追加）
        await this.updateOrderWithPayment(order.id!, paymentResult.payment_intent_id)

        // 5. 決済確認が必要でない場合は在庫確定
        if (!paymentResult.requires_action) {
          await this.inventoryService.confirmReservation(inventoryReservation.reservation_id)
          await this.updateOrderStatus(order.id!, OrderStatus.CONFIRMED)
          
          // 6. 確認通知送信
          await this.notificationService.sendOrderConfirmation(order, this.user.email)
        }

        return {
          order,
          payment_client_secret: paymentResult.client_secret,
          requires_action: paymentResult.requires_action
        }

      } catch (error) {
        // エラー時は在庫予約解除
        await this.inventoryService.releaseReservation(inventoryReservation.reservation_id)
        throw error
      }
    })
  }

  private async createOrder(
    orderRequest: OrderRequest, 
    calculatedTotal: number
  ): Promise<Order> {
    const client = this.db.getClient()
    
    // 注文計算
    const taxAmount = Math.round(calculatedTotal * 0.1) // 10%税金
    const shippingAmount = calculatedTotal > 5000 ? 0 : 500 // 5000円以上で送料無料
    const totalAmount = calculatedTotal + taxAmount + shippingAmount

    // 注文作成
    const { data: orderData, error: orderError } = await client
      .from('orders')
      .insert({
        user_id: this.user.id,
        status: OrderStatus.PENDING,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        currency: 'jpy',
        shipping_address: orderRequest.shipping_address,
        billing_address: orderRequest.billing_address
      })
      .select()
      .single()

    if (orderError) {
      throw new Error(`Order creation failed: ${orderError.message}`)
    }

    // 注文アイテム作成
    const orderItems: OrderItem[] = await this.createOrderItems(
      orderData.id,
      orderRequest.cart_items
    )

    return {
      ...orderData,
      items: orderItems
    }
  }

  private async createOrderItems(
    orderId: number,
    cartItems: any[]
  ): Promise<OrderItem[]> {
    const client = this.db.getClient()
    const orderItems: OrderItem[] = []

    for (const cartItem of cartItems) {
      // 商品情報取得
      const { data: product, error: productError } = await client
        .from('products')
        .select('*')
        .eq('id', cartItem.product_id)
        .single()

      if (productError || !product) {
        throw new Error(`Product not found: ${cartItem.product_id}`)
      }

      const totalPrice = product.price * cartItem.quantity

      // 注文アイテム作成
      const { data: orderItemData, error: orderItemError } = await client
        .from('order_items')
        .insert({
          order_id: orderId,
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          unit_price: product.price,
          total_price: totalPrice,
          product_snapshot: {
            name: product.name,
            description: product.description,
            sku: product.sku
          }
        })
        .select()
        .single()

      if (orderItemError) {
        throw new Error(`Order item creation failed: ${orderItemError.message}`)
      }

      orderItems.push(orderItemData)
    }

    return orderItems
  }

  private async updateOrderWithPayment(
    orderId: number,
    paymentIntentId: string
  ): Promise<void> {
    const client = this.db.getClient()
    
    const { error } = await client
      .from('orders')
      .update({
        stripe_payment_intent_id: paymentIntentId,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (error) {
      throw new Error(`Order payment update failed: ${error.message}`)
    }
  }

  private async updateOrderStatus(
    orderId: number,
    status: OrderStatus
  ): Promise<void> {
    const client = this.db.getClient()
    
    const { error } = await client
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (error) {
      throw new Error(`Order status update failed: ${error.message}`)
    }
  }
}
```

### 在庫管理サービス

```typescript
// supabase/functions/process-order/services/inventory-service.ts
import { DatabaseConnection } from '../../_shared/database.ts'

export interface InventoryReservation {
  reservation_id: string
  items: Array<{
    product_id: number
    quantity: number
    unit_price: number
  }>
  total_amount: number
  expires_at: string
}

export class InventoryService {
  constructor(private db: DatabaseConnection) {}

  public async reserveInventory(cartItems: any[]): Promise<InventoryReservation> {
    const client = this.db.getClient()
    const reservationId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15分後
    let totalAmount = 0
    const reservationItems = []

    for (const cartItem of cartItems) {
      // 在庫確認
      const { data: product, error: productError } = await client
        .from('products')
        .select('id, price, stock_quantity')
        .eq('id', cartItem.product_id)
        .eq('is_active', true)
        .single()

      if (productError || !product) {
        throw new Error(`Product not available: ${cartItem.product_id}`)
      }

      if (product.stock_quantity < cartItem.quantity) {
        throw new Error(
          `Insufficient stock for product ${cartItem.product_id}. ` +
          `Available: ${product.stock_quantity}, Requested: ${cartItem.quantity}`
        )
      }

      // 在庫予約記録作成
      const { error: reservationError } = await client
        .from('inventory_reservations')
        .insert({
          reservation_id: reservationId,
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          unit_price: product.price,
          expires_at: expiresAt.toISOString()
        })

      if (reservationError) {
        throw new Error(`Inventory reservation failed: ${reservationError.message}`)
      }

      // 予約済み在庫更新
      const { error: stockError } = await client
        .from('products')
        .update({
          stock_quantity: product.stock_quantity - cartItem.quantity
        })
        .eq('id', cartItem.product_id)

      if (stockError) {
        throw new Error(`Stock update failed: ${stockError.message}`)
      }

      const itemTotal = product.price * cartItem.quantity
      totalAmount += itemTotal

      reservationItems.push({
        product_id: cartItem.product_id,
        quantity: cartItem.quantity,
        unit_price: product.price
      })
    }

    return {
      reservation_id: reservationId,
      items: reservationItems,
      total_amount: totalAmount,
      expires_at: expiresAt.toISOString()
    }
  }

  public async confirmReservation(reservationId: string): Promise<void> {
    const client = this.db.getClient()
    
    // 予約確定
    const { error } = await client
      .from('inventory_reservations')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .eq('reservation_id', reservationId)

    if (error) {
      throw new Error(`Reservation confirmation failed: ${error.message}`)
    }
  }

  public async releaseReservation(reservationId: string): Promise<void> {
    const client = this.db.getClient()
    
    // 予約されたアイテム取得
    const { data: reservations, error: getError } = await client
      .from('inventory_reservations')
      .select('product_id, quantity')
      .eq('reservation_id', reservationId)
      .eq('status', 'pending')

    if (getError) {
      throw new Error(`Failed to get reservations: ${getError.message}`)
    }

    // 在庫復元
    for (const reservation of reservations || []) {
      const { error: restoreError } = await client
        .rpc('restore_inventory', {
          product_id: reservation.product_id,
          quantity: reservation.quantity
        })

      if (restoreError) {
        console.error(`Failed to restore inventory for product ${reservation.product_id}:`, restoreError)
      }
    }

    // 予約削除
    const { error: deleteError } = await client
      .from('inventory_reservations')
      .delete()
      .eq('reservation_id', reservationId)

    if (deleteError) {
      throw new Error(`Reservation deletion failed: ${deleteError.message}`)
    }
  }

  // 期限切れ予約の自動クリーンアップ
  public async cleanupExpiredReservations(): Promise<void> {
    const client = this.db.getClient()
    
    const { data: expiredReservations, error: getError } = await client
      .from('inventory_reservations')
      .select('reservation_id')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

    if (getError) {
      console.error('Failed to get expired reservations:', getError)
      return
    }

    for (const reservation of expiredReservations || []) {
      try {
        await this.releaseReservation(reservation.reservation_id)
      } catch (error) {
        console.error(`Failed to cleanup reservation ${reservation.reservation_id}:`, error)
      }
    }
  }
}
```

### 決済サービス（Stripe連携）

```typescript
// supabase/functions/process-order/services/payment-service.ts
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

export interface PaymentRequest {
  amount: number
  currency: string
  order_id: number
  customer_email: string
  payment_method_id: string
}

export interface PaymentResult {
  payment_intent_id: string
  client_secret: string
  requires_action: boolean
  status: string
}

export class PaymentService {
  private stripe: Stripe

  constructor() {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required')
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16'
    })
  }

  public async createPaymentIntent(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // Stripe顧客作成または取得
      const customer = await this.getOrCreateCustomer(request.customer_email)

      // PaymentIntent作成
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: request.amount,
        currency: request.currency,
        customer: customer.id,
        payment_method: request.payment_method_id,
        confirmation_method: 'manual',
        confirm: true,
        metadata: {
          order_id: request.order_id.toString(),
          source: 'ecommerce_platform'
        }
      })

      return {
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret!,
        requires_action: paymentIntent.status === 'requires_action',
        status: paymentIntent.status
      }

    } catch (error) {
      console.error('Stripe payment error:', error)
      
      if (error instanceof Stripe.errors.StripeCardError) {
        throw new Error(`Card error: ${error.message}`)
      } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        throw new Error(`Invalid request: ${error.message}`)
      } else {
        throw new Error(`Payment failed: ${error.message}`)
      }
    }
  }

  private async getOrCreateCustomer(email: string): Promise<Stripe.Customer> {
    // 既存顧客検索
    const existingCustomers = await this.stripe.customers.list({
      email: email,
      limit: 1
    })

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0]
    }

    // 新規顧客作成
    return await this.stripe.customers.create({
      email: email,
      metadata: {
        source: 'ecommerce_platform'
      }
    })
  }

  public async confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId)

      return {
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret!,
        requires_action: paymentIntent.status === 'requires_action',
        status: paymentIntent.status
      }

    } catch (error) {
      console.error('Payment confirmation error:', error)
      throw new Error(`Payment confirmation failed: ${error.message}`)
    }
  }

  public async refundPayment(
    paymentIntentId: string, 
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    try {
      return await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount,
        reason: reason as Stripe.RefundCreateParams.Reason
      })

    } catch (error) {
      console.error('Refund error:', error)
      throw new Error(`Refund failed: ${error.message}`)
    }
  }
}
```

### Stripeウェブフック処理

```typescript
// supabase/functions/webhook-stripe/index.ts
import { serve } from 'https://deno.land/std@0.207.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'
import { initDatabase } from '../_shared/database.ts'
import { OrderStatus } from '../_shared/models.ts'
import { NotificationService } from '../process-order/services/notification-service.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16'
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')!

    // Stripe署名検証
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    const db = initDatabase()
    const client = db.getClient()
    const notificationService = new NotificationService()

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent, client, notificationService)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, client, notificationService)
        break

      case 'payment_intent.requires_action':
        await handlePaymentRequiresAction(event.data.object as Stripe.PaymentIntent, client)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})

async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  client: any,
  notificationService: NotificationService
) {
  const orderId = paymentIntent.metadata.order_id

  // 注文状態更新
  const { data: order, error: updateError } = await client
    .from('orders')
    .update({
      status: OrderStatus.CONFIRMED,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .select(`
      *,
      order_items (
        *,
        product_snapshot
      )
    `)
    .single()

  if (updateError) {
    console.error('Failed to update order:', updateError)
    return
  }

  // 在庫確定
  const { error: inventoryError } = await client
    .rpc('confirm_inventory_for_order', { order_id: parseInt(orderId) })

  if (inventoryError) {
    console.error('Failed to confirm inventory:', inventoryError)
  }

  // 確認メール送信
  try {
    const { data: user } = await client
      .from('auth.users')
      .select('email')
      .eq('id', order.user_id)
      .single()

    if (user) {
      await notificationService.sendOrderConfirmation(order, user.email)
    }
  } catch (error) {
    console.error('Failed to send confirmation email:', error)
  }
}

async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  client: any,
  notificationService: NotificationService
) {
  // 注文キャンセル
  const { error: updateError } = await client
    .from('orders')
    .update({
      status: OrderStatus.CANCELLED,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (updateError) {
    console.error('Failed to cancel order:', updateError)
    return
  }

  // 在庫復元
  const orderId = paymentIntent.metadata.order_id
  const { error: inventoryError } = await client
    .rpc('restore_inventory_for_order', { order_id: parseInt(orderId) })

  if (inventoryError) {
    console.error('Failed to restore inventory:', inventoryError)
  }
}

async function handlePaymentRequiresAction(
  paymentIntent: Stripe.PaymentIntent,
  client: any
) {
  // 3DS認証待ち状態を記録
  const { error } = await client
    .from('orders')
    .update({
      status: OrderStatus.PENDING,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (error) {
    console.error('Failed to update order for 3DS:', error)
  }
}
```

---

### 4.2.4 Edge FunctionsでのAI推論（内蔵AI API）

Supabase Edge Functionsには **内蔵AI API** があり、外部依存なしで推論が実行できます。  
**埋め込み生成・チャット・分類**などの処理を、エッジで完結させる構成が取れます。

```typescript
// Edge Functions AI API（概念例）
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const session = new Supabase.ai.Session('model-name')
const embedding = await session.run('search query')
```

**補足**:
- 低レイテンシで実行できるため **RAGの前処理**に有効
- 外部APIを使わないため **鍵管理やコスト見積り**が容易

### 4.2.5 外部LLM連携（Ollama/Llamafile など）

外部LLMを使う場合は **Edge Functionsをゲートウェイ**にして  
**認証・レート制限・監査ログ**を一箇所に集約します。

**典型構成**:
1. クライアント → Edge Function（認証/入力検証）
2. Edge Function → 外部LLM（Ollama / Llamafile / OpenAI など）
3. Edge Function → DB（プロンプト/出力/コスト/モデルを記録）

### 4.2.6 AIゲートウェイ・パターン（監査と安全性）

AIアプリでは「**誰が何に対して、どのモデルで何を生成したか**」が重要です。  
Edge Functionsを **AIゲートウェイ**として設計し、次を必ず記録します：

- リクエスト元（tenant_id / user_id）
- 参照したドキュメントID（RAGのretrievalログ）
- モデル名 / プロンプトバージョン / 推定コスト
- 出力のハッシュ（監査や再現性のため）

**実装例（概念）**:
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SECRET_KEY')!
)

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }
  const jwt = authHeader.replace('Bearer ', '')
  const { data: userData } = await supabase.auth.getUser(jwt)
  const user = userData?.user
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  if (!body.prompt || typeof body.prompt !== 'string') {
    return new Response('Invalid input', { status: 400 })
  }
  const tenantId = user.app_metadata?.tenant_id ?? user.user_metadata?.tenant_id
  if (!tenantId) return new Response('Missing tenant', { status: 400 })

  // 例: 簡易レート制限（実運用は専用ストアで管理）
  // await checkRateLimit(user.id)

  // 外部LLM呼び出し（概念例）
  const llmRes = await fetch(Deno.env.get('LLM_ENDPOINT_URL')!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('LLM_API_KEY')}`
    },
    body: JSON.stringify({ prompt: body.prompt })
  })
  const llmJson = await llmRes.json()

  // 監査ログ保存
  const outputText = llmJson.output ?? ''
  const hashBuf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(outputText)
  )
  const outputHash = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const promptHashBuf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(body.prompt)
  )
  const promptHash = Array.from(new Uint8Array(promptHashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  await supabase.from('ai_audit_logs').insert({
    tenant_id: tenantId,
    user_id: user.id,
    model_name: llmJson.model ?? 'unknown',
    prompt_hash: promptHash,
    output_hash: outputHash,
    cost_usd: llmJson.cost_usd ?? null
  })

  return new Response(JSON.stringify(llmJson), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### 4.2.7 自動埋め込み生成（後章への接続）

埋め込み生成は **Edge Functions + キュー + トリガ**で自動化できます。  
詳しい構成は **Chapter 5-4（RAG/ベクトル検索アーキテクチャ）** で扱います。

---

## 4.3 運用考慮事項とモニタリング

### 4.3.1 ファイルストレージ（/tmp と /s3 の使い分け）

Edge Functions には **永続ストレージ**と**一時ストレージ**の2種類があります。  
用途に応じて使い分けると、安全性とコストの両面で有利です。

**永続ストレージ（S3互換）**:
- `/s3/<bucket>` にマウントされる
- Supabase Storage や S3互換バケットを利用可能
- **成果物・キャッシュ・監査ログ**など長期保存向け

**一時ストレージ（/tmp）**:
- 呼び出しごとにリセットされる
- 変換処理・一時ファイルに限定

```typescript
// 永続ストレージ（S3互換）への読み書き
const data = await Deno.readFile('/s3/my-bucket/results.csv')
await Deno.writeTextFile('/s3/my-bucket/output.txt', 'hello')

// 一時ストレージ
await Deno.writeTextFile('/tmp/work.txt', 'temp')
```

**永続ストレージ利用時の環境変数（Secrets）**:
- `S3FS_ENDPOINT_URL`
- `S3FS_REGION`
- `S3FS_ACCESS_KEY_ID`
- `S3FS_SECRET_ACCESS_KEY`

### パフォーマンス最適化

```typescript
// supabase/functions/_shared/performance.ts
export class PerformanceMonitor {
  private static readonly SLOW_QUERY_THRESHOLD = 1000 // 1秒
  private static readonly MEMORY_WARNING_THRESHOLD = 50 * 1024 * 1024 // 50MB

  public static async measureExecution<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    const startMemory = this.getMemoryUsage()

    try {
      const result = await operation()
      const executionTime = Date.now() - startTime
      const memoryUsed = this.getMemoryUsage() - startMemory

      // メトリクス記録
      this.logMetrics(name, executionTime, memoryUsed, true)

      // 警告チェック
      if (executionTime > this.SLOW_QUERY_THRESHOLD) {
        console.warn(`Slow operation detected: ${name} took ${executionTime}ms`)
      }

      if (memoryUsed > this.MEMORY_WARNING_THRESHOLD) {
        console.warn(`High memory usage: ${name} used ${memoryUsed / 1024 / 1024}MB`)
      }

      return result

    } catch (error) {
      const executionTime = Date.now() - startTime
      const memoryUsed = this.getMemoryUsage() - startMemory
      
      this.logMetrics(name, executionTime, memoryUsed, false)
      throw error
    }
  }

  private static getMemoryUsage(): number {
    return Deno.memoryUsage().heapUsed
  }

  private static logMetrics(
    operation: string,
    executionTime: number,
    memoryUsed: number,
    success: boolean
  ): void {
    const metrics = {
      timestamp: new Date().toISOString(),
      operation,
      execution_time_ms: executionTime,
      memory_used_bytes: memoryUsed,
      success,
      environment: Deno.env.get('ENVIRONMENT') || 'development'
    }

    // 本番環境では外部監視システムに送信
    if (Deno.env.get('ENVIRONMENT') === 'production') {
      this.sendToMonitoringSystem(metrics)
    } else {
      console.log('Performance metrics:', metrics)
    }
  }

  private static async sendToMonitoringSystem(metrics: any): Promise<void> {
    // DataDog, NewRelic, CloudWatch等への送信
    const monitoringEndpoint = Deno.env.get('MONITORING_ENDPOINT')
    if (!monitoringEndpoint) return

    try {
      await fetch(monitoringEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('MONITORING_API_KEY')}`
        },
        body: JSON.stringify(metrics)
      })
    } catch (error) {
      console.error('Failed to send metrics:', error)
    }
  }
}

// 使用例装飾子
export function monitored(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value

  descriptor.value = async function (...args: any[]) {
    return await PerformanceMonitor.measureExecution(
      `${target.constructor.name}.${propertyKey}`,
      () => originalMethod.apply(this, args)
    )
  }

  return descriptor
}
```

### エラー監視とアラート

```typescript
// supabase/functions/_shared/monitoring.ts
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface Alert {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  metadata?: Record<string, any>
  timestamp: string
  function_name: string
}

export class AlertManager {
  private static readonly ALERT_WEBHOOK = Deno.env.get('SLACK_WEBHOOK_URL')
  private static readonly ERROR_RATE_THRESHOLD = 0.05 // 5%
  private static readonly RESPONSE_TIME_THRESHOLD = 2000 // 2秒

  private static errorCounts = new Map<string, number>()
  private static requestCounts = new Map<string, number>()

  public static async sendAlert(alert: Alert): Promise<void> {
    console.error(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.title}`, alert)

    // 重要度が高い場合はSlack通知
    if (alert.severity === AlertSeverity.ERROR || alert.severity === AlertSeverity.CRITICAL) {
      await this.sendSlackAlert(alert)
    }

    // アラート履歴保存
    await this.saveAlertHistory(alert)
  }

  private static async sendSlackAlert(alert: Alert): Promise<void> {
    if (!this.ALERT_WEBHOOK) return

    const color = alert.severity === AlertSeverity.CRITICAL ? '#ff0000' : '#ff9900'
    const message = {
      attachments: [{
        color,
        title: `🚨 ${alert.title}`,
        text: alert.description,
        fields: [
          {
            title: 'Function',
            value: alert.function_name,
            short: true
          },
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Timestamp',
            value: alert.timestamp,
            short: false
          }
        ]
      }]
    }

    try {
      await fetch(this.ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      })
    } catch (error) {
      console.error('Failed to send Slack alert:', error)
    }
  }

  private static async saveAlertHistory(alert: Alert): Promise<void> {
    try {
      const db = initDatabase()
      const client = db.getClient()

      await client.from('alert_history').insert({
        alert_id: alert.id,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        metadata: alert.metadata,
        function_name: alert.function_name,
        created_at: alert.timestamp
      })
    } catch (error) {
      console.error('Failed to save alert history:', error)
    }
  }

  public static trackRequest(functionName: string, success: boolean): void {
    const currentRequests = this.requestCounts.get(functionName) || 0
    this.requestCounts.set(functionName, currentRequests + 1)

    if (!success) {
      const currentErrors = this.errorCounts.get(functionName) || 0
      this.errorCounts.set(functionName, currentErrors + 1)
    }

    // 定期的にエラー率チェック
    this.checkErrorRate(functionName)
  }

  private static checkErrorRate(functionName: string): void {
    const errors = this.errorCounts.get(functionName) || 0
    const requests = this.requestCounts.get(functionName) || 0

    if (requests >= 10) { // 最低10リクエストで判定
      const errorRate = errors / requests

      if (errorRate > this.ERROR_RATE_THRESHOLD) {
        this.sendAlert({
          id: crypto.randomUUID(),
          severity: AlertSeverity.WARNING,
          title: 'High Error Rate Detected',
          description: `Function ${functionName} has error rate of ${(errorRate * 100).toFixed(2)}%`,
          metadata: { errors, requests, errorRate },
          timestamp: new Date().toISOString(),
          function_name: functionName
        })

        // カウンターリセット
        this.errorCounts.set(functionName, 0)
        this.requestCounts.set(functionName, 0)
      }
    }
  }
}

// ヘルスチェック関数
export async function healthCheck(): Promise<{ status: string; checks: any[] }> {
  const checks = []

  // データベース接続チェック
  try {
    const db = initDatabase()
    const client = db.getClient()
    await client.from('health_check').select('1').limit(1)
    checks.push({ name: 'database', status: 'healthy' })
  } catch (error) {
    checks.push({ name: 'database', status: 'unhealthy', error: error.message })
  }

  // Stripe API チェック
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16'
    })
    await stripe.accounts.retrieve()
    checks.push({ name: 'stripe', status: 'healthy' })
  } catch (error) {
    checks.push({ name: 'stripe', status: 'unhealthy', error: error.message })
  }

  const allHealthy = checks.every(check => check.status === 'healthy')
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks
  }
}
```

### デプロイとCI/CD

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Edge Functions デプロイ開始"

# 環境変数チェック
required_vars=("SUPABASE_PROJECT_ID" "SUPABASE_ACCESS_TOKEN" "STRIPE_SECRET_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ 必須環境変数が設定されていません: $var"
        exit 1
    fi
done

# Supabase CLI バージョン確認
supabase --version || {
    echo "❌ Supabase CLI がインストールされていません"
    exit 1
}

# プロジェクトリンク
echo "🔗 Supabaseプロジェクトにリンク"
supabase link --project-ref $SUPABASE_PROJECT_ID

# 型生成
echo "📝 TypeScript型定義生成"
supabase gen types typescript --linked > types/database.ts

# テスト実行
echo "🧪 Edge Functions テスト実行"
npm run test:edge-functions

# 関数デプロイ
functions=(
    "process-order"
    "webhook-stripe" 
    "send-notifications"
    "inventory-management"
)

for func in "${functions[@]}"; do
    echo "📦 関数デプロイ: $func"
    supabase functions deploy $func --no-verify-jwt
done

# ヘルスチェック
echo "🏥 デプロイ後ヘルスチェック"
sleep 10 # デプロイ完了待機

for func in "${functions[@]}"; do
    health_url="https://$SUPABASE_PROJECT_ID.supabase.co/functions/v1/$func/health"
    
    echo "チェック中: $func"
    response=$(curl -s -o /dev/null -w "%{http_code}" "$health_url" || echo "000")
    
    if [ "$response" = "200" ]; then
        echo "✅ $func: Healthy"
    else
        echo "❌ $func: Unhealthy (HTTP $response)"
        exit 1
    fi
done

echo "🎉 デプロイ完了！"
```

### コスト最適化

```typescript
// supabase/functions/_shared/cost-optimization.ts
export class CostOptimizer {
  private static readonly REQUEST_CACHE = new Map<string, any>()
  private static readonly CACHE_TTL = 60000 // 1分

  // レスポンスキャッシュ
  public static getCachedResponse(key: string): any {
    const cached = this.REQUEST_CACHE.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }
    return null
  }

  public static setCachedResponse(key: string, data: any): void {
    this.REQUEST_CACHE.set(key, {
      data,
      timestamp: Date.now()
    })

    // キャッシュサイズ制限
    if (this.REQUEST_CACHE.size > 100) {
      const oldestKey = this.REQUEST_CACHE.keys().next().value
      this.REQUEST_CACHE.delete(oldestKey)
    }
  }

  // リクエスト結合（同じリクエストをまとめる）
  private static pendingRequests = new Map<string, Promise<any>>()

  public static async deduplicateRequest<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // 既に実行中のリクエストがあれば結果を待つ
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!
    }

    // 新しいリクエスト実行
    const promise = operation().finally(() => {
      this.pendingRequests.delete(key)
    })

    this.pendingRequests.set(key, promise)
    return promise
  }

  // コールドスタート最適化
  public static warmup(): void {
    // 重要な依存関係を事前ロード
    initDatabase()
    
    // 外部サービス接続テスト
    this.testExternalConnections()
  }

  private static async testExternalConnections(): Promise<void> {
    try {
      // Stripe接続テスト
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
        apiVersion: '2023-10-16'
      })
      await stripe.accounts.retrieve()
    } catch (error) {
      console.warn('Stripe connection test failed:', error)
    }
  }
}

// 使用例
export async function optimizedHandler(request: Request): Promise<Response> {
  // ウォームアップ
  CostOptimizer.warmup()

  const cacheKey = `${request.method}:${request.url}`
  
  // キャッシュチェック
  const cached = CostOptimizer.getCachedResponse(cacheKey)
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // 重複リクエスト排除
  const result = await CostOptimizer.deduplicateRequest(cacheKey, async () => {
    // 実際の処理
    return await processRequest(request)
  })

  // 結果キャッシュ
  CostOptimizer.setCachedResponse(cacheKey, result)

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

---

## トラブルシューティング

### Deno Edge Functions固有の問題

#### 問題1: Edge Function デプロイ失敗

**症状**:
- `supabase functions deploy` 実行時のエラー
- Function が正常に起動しない
- TypeScript コンパイルエラー

**診断手順**:
```bash
# Supabase CLI バージョン確認
supabase --version

# プロジェクトリンク状態確認
supabase status

# ローカルでの関数テスト
supabase functions serve process-order --env-file .env.local

# デプロイログ確認
supabase functions deploy process-order --debug
```

**解決策**:
```typescript
// supabase/functions/process-order/index.ts
// 1. import パスの明示化
import { serve } from "https://deno.land/std@0.207.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

// 2. TypeScript 設定確認
// deno.json または import_map.json の設定
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.38.0"
  }
}

// 3. 関数エントリーポイントの確認
serve(async (req: Request) => {
  try {
    // 必ず Response を返す
    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    )
  }
})
```

#### 問題2: JWT認証エラー

**症状**:
- `Invalid JWT` エラー
- 認証済みユーザーでも 401 エラー
- トークン検証失敗

**診断手順**:
```typescript
// supabase/functions/_shared/debug-auth.ts
import { verify } from 'https://deno.land/x/djwt@v3.0.1/mod.ts'

export async function debugAuth(request: Request) {
  const authHeader = request.headers.get('Authorization')
  
  console.log('Auth Header:', authHeader)
  
  if (!authHeader) {
    console.log('No Authorization header found')
    return null
  }
  
  const token = authHeader.replace('Bearer ', '')
  console.log('Token (first 20 chars):', token.substring(0, 20) + '...')
  
  const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET')
  console.log('JWT Secret configured:', !!jwtSecret)
  
  try {
    const payload = await verify(token, jwtSecret!, 'HS256')
    console.log('JWT Payload:', JSON.stringify(payload, null, 2))
    return payload
  } catch (error) {
    console.log('JWT Verification Error:', error.message)
    return null
  }
}

// 使用例
serve(async (req: Request) => {
  const authPayload = await debugAuth(req)
  
  if (!authPayload) {
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: corsHeaders }
    )
  }
  
  // 処理続行...
})
```

**解決策**:
```typescript
// 正しい JWT 検証実装
import { verify } from 'https://deno.land/x/djwt@v3.0.1/mod.ts'

class AuthService {
  private jwtSecret: string

  constructor() {
    this.jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET')!
    if (!this.jwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET is not configured')
    }
  }

  async validateRequest(request: Request): Promise<AuthContext> {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, isAuthenticated: false }
    }

    const token = authHeader.substring(7)
    
    try {
      const payload = await verify(token, this.jwtSecret, 'HS256')
      
      // トークンの有効期限チェック
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        console.warn('Token expired')
        return { user: null, isAuthenticated: false }
      }
      
      return {
        user: {
          id: payload.sub as string,
          email: payload.email as string,
          role: payload.role as string,
          metadata: payload.user_metadata
        },
        isAuthenticated: true
      }
    } catch (error) {
      console.error('JWT validation failed:', error)
      return { user: null, isAuthenticated: false }
    }
  }
}
```

#### 問題3: データベース接続エラー

**症状**:
- `connection timeout` エラー
- `too many connections` エラー
- データベースクエリ失敗

**診断手順**:
```typescript
// supabase/functions/_shared/db-diagnostics.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

export async function diagnosticDatabaseConnection() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY')
  
  console.log('Database URL configured:', !!url)
  console.log('Service Key configured:', !!serviceKey)
  
  if (!url || !serviceKey) {
    throw new Error('Database configuration missing')
  }
  
  const client = createClient(url, serviceKey)
  
  try {
    // 簡単な接続テスト
    const { data, error } = await client
      .from('_test_connection')
      .select('1')
      .limit(1)
    
    if (error) {
      console.error('Database connection test failed:', error)
      
      // 具体的なエラー分析
      if (error.message.includes('permission denied')) {
        console.error('RLS policy or permission issue')
      } else if (error.message.includes('timeout')) {
        console.error('Connection timeout - check network/firewall')
      } else if (error.message.includes('too many connections')) {
        console.error('Connection pool exhausted')
      }
      
      throw error
    }
    
    console.log('Database connection successful')
    return client
    
  } catch (error) {
    console.error('Database diagnostics failed:', error)
    throw error
  }
}

// 接続プール管理
class DatabasePool {
  private static instance: DatabasePool
  private clients: Map<string, any> = new Map()
  private maxConnections = 5
  
  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool()
    }
    return DatabasePool.instance
  }
  
  getClient(): any {
    const clientId = crypto.randomUUID()
    
    if (this.clients.size >= this.maxConnections) {
      // 最も古いクライアントを削除
      const oldestId = this.clients.keys().next().value
      this.clients.delete(oldestId)
    }
    
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SECRET_KEY')!
    )
    
    this.clients.set(clientId, client)
    return client
  }
}
```

### 外部API連携の問題

#### 問題4: Stripe API エラー

**症状**:
- `card_declined` エラー
- `invalid_request_error` エラー  
- Webhook 処理失敗

**診断手順**:
```typescript
// supabase/functions/process-order/services/stripe-diagnostics.ts
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

export class StripeDiagnostics {
  private stripe: Stripe
  
  constructor() {
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }
    
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16'
    })
  }
  
  async testConnection(): Promise<boolean> {
    try {
      await this.stripe.accounts.retrieve()
      console.log('Stripe connection successful')
      return true
    } catch (error) {
      console.error('Stripe connection failed:', error.message)
      return false
    }
  }
  
  async analyzePaymentError(error: any): Promise<string> {
    if (error instanceof Stripe.errors.StripeCardError) {
      // カードエラー分析
      const decline_code = error.decline_code
      const errorCode = error.code
      
      const suggestions = {
        'card_declined': 'Customer should try a different card or contact their bank',
        'insufficient_funds': 'Customer has insufficient funds',
        'expired_card': 'Card has expired',
        'incorrect_cvc': 'CVC code is incorrect',
        'processing_error': 'Temporary issue, retry payment'
      }
      
      return suggestions[errorCode] || 'Generic card error - customer should try again'
      
    } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      // リクエストエラー分析
      console.error('Invalid request to Stripe:', error.message)
      return 'Payment configuration error - contact support'
      
    } else if (error instanceof Stripe.errors.StripeAPIError) {
      // API エラー
      console.error('Stripe API error:', error.message)
      return 'Payment service temporarily unavailable'
      
    } else {
      console.error('Unknown Stripe error:', error)
      return 'Payment processing failed - please try again'
    }
  }
}

// 使用例
const diagnostics = new StripeDiagnostics()

try {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1000,
    currency: 'jpy',
    // ...
  })
} catch (error) {
  const suggestion = await diagnostics.analyzePaymentError(error)
  console.log('Payment error suggestion:', suggestion)
}
```

#### 問題5: Webhook 署名検証失敗

**症状**:
- `Invalid signature` エラー
- Webhook イベント処理されない
- 重複イベント処理

**解決策**:
```typescript
// supabase/functions/webhook-stripe/index.ts
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16'
})

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // リクエストボディとヘッダー取得
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    // デバッグ情報
    console.log('Webhook signature:', signature ? 'present' : 'missing')
    console.log('Webhook secret configured:', !!webhookSecret)
    console.log('Request body length:', body.length)
    
    if (!signature || !webhookSecret) {
      console.error('Missing signature or webhook secret')
      return new Response('Webhook authentication failed', { status: 400 })
    }

    // 署名検証
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    // 重複イベント処理防止
    const eventId = event.id
    const processedEvents = new Set() // 実際の実装では永続化が必要
    
    if (processedEvents.has(eventId)) {
      console.log(`Event ${eventId} already processed`)
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    // イベント処理
    console.log(`Processing event: ${event.type} (${eventId})`)
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // 処理済みマーク
    processedEvents.add(eventId)

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// べき等性を保証するイベント処理
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.order_id
  
  try {
    const db = initDatabase()
    const client = db.getClient()
    
    // 現在の注文状態確認
    const { data: order, error: fetchError } = await client
      .from('orders')
      .select('status')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .single()
    
    if (fetchError) {
      console.error('Failed to fetch order:', fetchError)
      return
    }
    
    // 既に処理済みの場合はスキップ
    if (order.status === 'confirmed') {
      console.log(`Order ${orderId} already confirmed`)
      return
    }
    
    // トランザクション処理
    await db.withTransaction(async (txClient) => {
      // 注文状態更新
      await txClient
        .from('orders')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_payment_intent_id', paymentIntent.id)
      
      // 在庫確定
      await txClient
        .rpc('confirm_inventory_for_order', { order_id: parseInt(orderId) })
    })
    
    console.log(`Payment succeeded for order ${orderId}`)
    
  } catch (error) {
    console.error(`Failed to handle payment success for order ${orderId}:`, error)
    throw error // 再試行のためエラーを再スロー
  }
}
```

### パフォーマンス問題

#### 問題6: Edge Function タイムアウト

**症状**:
- Function 実行が 30 秒でタイムアウト
- 長時間の処理が完了しない
- メモリ不足エラー

**最適化手法**:
```typescript
// supabase/functions/process-order/handlers/optimized-processor.ts
export class OptimizedOrderProcessor {
  private static readonly BATCH_SIZE = 10
  private static readonly TIMEOUT_MS = 25000 // 25秒（余裕を持って）

  async processOrderWithTimeout(orderRequest: OrderRequest): Promise<OrderResponse> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout')), OptimizedOrderProcessor.TIMEOUT_MS)
    })

    const processingPromise = this.processOrderOptimized(orderRequest)

    try {
      return await Promise.race([processingPromise, timeoutPromise]) as OrderResponse
    } catch (error) {
      if (error.message === 'Processing timeout') {
        // 非同期処理に切り替え
        await this.scheduleAsyncProcessing(orderRequest)
        throw new Error('Order queued for async processing')
      }
      throw error
    }
  }

  private async processOrderOptimized(orderRequest: OrderRequest): Promise<OrderResponse> {
    // 並列処理でパフォーマンス向上
    const [inventoryResult, customerData] = await Promise.all([
      this.inventoryService.reserveInventory(orderRequest.cart_items),
      this.getCustomerData(orderRequest.customer_id)
    ])

    // バッチ処理で DB アクセス最適化
    const order = await this.createOrderBatch(orderRequest, inventoryResult)
    
    return {
      order,
      payment_client_secret: await this.createPaymentIntent(order),
      requires_action: false
    }
  }

  private async createOrderBatch(orderRequest: OrderRequest, inventoryResult: any): Promise<Order> {
    const client = this.db.getClient()
    
    // 単一トランザクションで複数操作
    return await this.db.withTransaction(async (txClient) => {
      // 注文とアイテムを同時作成
      const orderData = {
        user_id: this.user.id,
        status: OrderStatus.PENDING,
        // ... 他のフィールド
      }
      
      const { data: order } = await txClient
        .from('orders')
        .insert(orderData)
        .select()
        .single()
      
      // バッチでアイテム作成
      const orderItems = orderRequest.cart_items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        // ... 他のフィールド
      }))
      
      await txClient
        .from('order_items')
        .insert(orderItems)
      
      return order
    })
  }

  private async scheduleAsyncProcessing(orderRequest: OrderRequest): Promise<void> {
    // バックグラウンド処理用キューに追加
    const queueItem = {
      type: 'process_order',
      payload: orderRequest,
      created_at: new Date().toISOString(),
      retry_count: 0
    }
    
    await this.db.getClient()
      .from('processing_queue')
      .insert(queueItem)
  }
}
```

### デバッグとモニタリング

#### 包括的デバッグ設定

```typescript
// supabase/functions/_shared/debug.ts
export class EdgeFunctionDebugger {
  private static instance: EdgeFunctionDebugger
  private logs: Array<any> = []
  
  static getInstance(): EdgeFunctionDebugger {
    if (!EdgeFunctionDebugger.instance) {
      EdgeFunctionDebugger.instance = new EdgeFunctionDebugger()
    }
    return EdgeFunctionDebugger.instance
  }
  
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      function: this.getFunctionName()
    }
    
    console[level](`[${timestamp}] ${message}`, data || '')
    this.logs.push(logEntry)
    
    // ログサイズ制限
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500)
    }
  }
  
  private getFunctionName(): string {
    const error = new Error()
    const stack = error.stack?.split('\n')[3] || ''
    return stack.split('/').pop()?.split(':')[0] || 'unknown'
  }
  
  getLogs(): Array<any> {
    return this.logs
  }
  
  async saveLogsToDatabase() {
    try {
      const db = initDatabase()
      await db.getClient()
        .from('function_logs')
        .insert(this.logs.map(log => ({
          ...log,
          created_at: log.timestamp
        })))
      
      this.logs = [] // ログクリア
    } catch (error) {
      console.error('Failed to save logs:', error)
    }
  }
}

// 使用例
const debugger = EdgeFunctionDebugger.getInstance()

serve(async (req: Request) => {
  debugger.log('info', 'Function invoked', { 
    method: req.method, 
    url: req.url 
  })
  
  try {
    // 処理...
    debugger.log('debug', 'Processing order', { orderId: 123 })
    
    const result = await processOrder()
    debugger.log('info', 'Order processed successfully', result)
    
    return new Response(JSON.stringify(result), { status: 200 })
    
  } catch (error) {
    debugger.log('error', 'Order processing failed', { 
      error: error.message,
      stack: error.stack 
    })
    
    // ログ保存
    await debugger.saveLogsToDatabase()
    
    return new Response(
      JSON.stringify({ error: 'Processing failed' }),
      { status: 500 }
    )
  }
})
```

#### パフォーマンス監視

```typescript
// supabase/functions/_shared/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  
  async measureExecution<T>(
    name: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now()
    const startMemory = this.getMemoryUsage()
    
    try {
      const result = await operation()
      const executionTime = performance.now() - startTime
      const memoryUsed = this.getMemoryUsage() - startMemory
      
      this.recordMetric(name, executionTime)
      
      if (executionTime > 1000) { // 1秒以上
        console.warn(`Slow operation: ${name} took ${executionTime.toFixed(2)}ms`)
      }
      
      if (memoryUsed > 10 * 1024 * 1024) { // 10MB以上
        console.warn(`High memory usage: ${name} used ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`)
      }
      
      return result
      
    } catch (error) {
      const executionTime = performance.now() - startTime
      console.error(`Operation failed: ${name} after ${executionTime.toFixed(2)}ms`, error)
      throw error
    }
  }
  
  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    const values = this.metrics.get(name)!
    values.push(value)
    
    // 最新100件のみ保持
    if (values.length > 100) {
      values.shift()
    }
  }
  
  getStats(name: string) {
    const values = this.metrics.get(name) || []
    if (values.length === 0) return null
    
    const sorted = [...values].sort((a, b) => a - b)
    
    return {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    }
  }
  
  private getMemoryUsage(): number {
    return Deno.memoryUsage().heapUsed
  }
}

// グローバルインスタンス
export const performanceMonitor = new PerformanceMonitor()

// 使用例
await performanceMonitor.measureExecution('database-query', async () => {
  return await client.from('orders').select('*').execute()
})

await performanceMonitor.measureExecution('stripe-payment', async () => {
  return await stripe.paymentIntents.create(paymentData)
})
```

---

## 🚀 実際に動かしてみよう！（ハンズオン）

### 📋 Step 1: 開発環境の準備

**必要なツール**：
- Deno 1.40以上（Edge Functions実行環境）
- Supabase CLI（ローカル開発用）
- VS Code + Deno Extension
- Git（バージョン管理）

**セットアップ手順**：

```bash
# 1. Deno インストール
curl -fsSL https://deno.land/install.sh | sh
# またはWindows: https://deno.land/install からインストーラー

# 2. Supabase CLI インストール
# macOS:
brew install supabase/tap/supabase
# Windows:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 3. プロジェクトディレクトリに移動
cd src/chapter04-ecommerce

# 4. Supabase プロジェクト初期化
supabase init

# 5. ローカル開発環境起動
supabase start
```

### 📋 Step 2: Edge Functions の作成と設定

**1. 注文処理Function作成**：
```bash
# Edge Function 作成
supabase functions new process-order

# ファイル構造確認
ls supabase/functions/process-order/
# index.ts が作成される
```

**2. 実際のコードを配置**：
本章で説明した `src/chapter04-ecommerce/supabase/functions/process-order/index.ts` のコードを使用してください。

### 📋 Step 3: データベーススキーマ設定

**1. マイグレーションファイル作成**：
```sql
-- supabase/migrations/20241203000001_ecommerce_schema.sql

-- 商品テーブル
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    category VARCHAR(100),
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 注文テーブル
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    shipping_address JSONB NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending',
    stripe_payment_intent_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 注文アイテムテーブル
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) NOT NULL,
    product_id INTEGER REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
CREATE POLICY "商品は全員閲覧可能" ON products FOR SELECT USING (is_active = true);

CREATE POLICY "注文は本人のみ閲覧可能" ON orders 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "注文は認証ユーザーが作成可能" ON orders 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- サンプルデータ挿入
INSERT INTO products (name, description, price, stock_quantity, category) VALUES
('から揚げ弁当', '自慢のから揚げがメインの人気弁当', 580, 50, 'bento'),
('ハンバーグ弁当', 'ジューシーなハンバーグ弁当', 680, 30, 'bento'),
('サラダボウル', 'ヘルシーな野菜たっぷりサラダ', 450, 25, 'salad'),
('チキンカレー', 'スパイシーなチキンカレー', 750, 20, 'curry');
```

**2. マイグレーション実行**：
```bash
# ローカル環境でマイグレーション実行
supabase db reset
```

### 📋 Step 4: Edge Function のローカルテスト

**1. Function起動**：
```bash
# Edge Functions サーバー起動
supabase functions serve process-order

# ログ確認（別ターミナル）
supabase functions logs process-order --follow
```

**2. API テスト**：
```bash
# 注文作成テスト
curl -X POST http://localhost:54321/functions/v1/process-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "action": "create",
    "order_data": {
      "user_id": "12345678-1234-1234-1234-123456789012",
      "items": [
        {
          "product_id": 1,
          "quantity": 2,
          "price": 580
        }
      ],
      "total_amount": 1160,
      "shipping_address": {
        "name": "田中太郎",
        "address": "東京都渋谷区1-1-1",
        "phone": "090-1234-5678"
      },
      "payment_method": "credit_card"
    }
  }'
```

### 📋 Step 5: トラブルシューティング

**よくあるエラーと対処法**：

#### エラー1: "Deno が見つかりません"
```bash
# 原因: Deno がインストールされていない
# 解決策:
curl -fsSL https://deno.land/install.sh | sh
# パスを追加
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### エラー2: "Edge Function デプロイ失敗"
```bash
# 原因: 環境変数が設定されていない
# 解決策:
supabase secrets list  # 現在の設定確認
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx  # 必要な環境変数設定
```

#### エラー3: "RLS ポリシーエラー"
```sql
-- 原因: Row Level Security ポリシーが正しく設定されていない
-- 解決策: ポリシーを確認・修正
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('orders', 'order_items');

-- 必要に応じてポリシー修正
DROP POLICY IF EXISTS "注文は本人のみ閲覧可能" ON orders;
CREATE POLICY "注文は本人のみ閲覧可能" ON orders 
    FOR ALL USING (auth.uid() = user_id);
```

### 💡 学習のポイント

**初心者（学習時間目安：6〜8時間）**：
- 🎯 Edge Functionの基本的な動作原理を理解
- 🔧 Supabase CLI の基本操作をマスター
- 📊 ログとデバッグの基本技術を習得

**中級者（学習時間目安：4〜6時間）**：
- 🔍 トランザクション処理とエラーハンドリング
- 🛡️ セキュリティ（認証・認可・RLS）の深い理解
- ⚡ パフォーマンス最適化とモニタリング

**上級者（学習時間目安：3〜4時間）**：
- 📈 スケーラビリティ戦略と制約の理解
- 🔧 カスタマイズとアーキテクチャ設計
- 🚀 本番環境でのデプロイと運用ベストプラクティス

### 📚 発展課題

基本動作確認後、以下の機能追加に挑戦してみましょう：

1. **Stripe決済連携**: 実際のクレジットカード決済処理
2. **メール通知機能**: SendGrid APIで注文確認メール
3. **在庫アラート**: 在庫不足時の自動通知
4. **注文履歴API**: 過去の注文データ取得・分析

---

## まとめ

Edge Functionsパターンは、サーバーサイドでのビジネスロジック実装により、セキュリティとスケーラビリティを両立します。

**適用推奨条件**:

- 複雑なビジネスロジック要件
- 外部API連携が必要
- トランザクション処理が重要
- セキュリティ要件が厳格

**主要メリット**:

- Supabase認証・RLSとの自然な統合
- TypeScript/Denoによる開発効率
- 自動スケーリング
- 運用負荷の軽減

**考慮事項**:

- コールドスタート遅延
- TypeScript学習コスト
- デバッグの複雑性
- Deno制約（Node.js互換性）

## 📚 学習進度別ガイド

### 🌱 初心者（プログラミング経験1年未満）

**この章で重点的に学ぶべきこと**：

| 学習項目 | 時間配分 | 重要度 | 学習方法 |
|:---------|:--------:|:------:|:---------|
| 🛠️ **開発環境構築** | 2時間 | ⭐⭐⭐ | Deno・Supabase CLIのインストール |
| 🔧 **基本的なFunction作成** | 3時間 | ⭐⭐⭐ | まずは動くものを作る |
| 📊 **ログとデバッグ** | 2時間 | ⭐⭐⭐ | エラーメッセージの読み方 |
| 🔐 **認証の基本** | 2時間 | ⭐⭐ | JWT・RLSの概念理解 |

**学習の進め方**：
1. ✅ **環境構築**: エラーを恐れずに何度でも試す
2. ✅ **サンプルコード**: コピー&ペーストから始める
3. ✅ **小さな変更**: 文字列やレスポンス内容を変えてみる
4. ✅ **エラー体験**: 意図的にエラーを発生させて対処を学ぶ

**つまずきポイントと解決法**：

| つまずきポイント | よくある原因 | 解決のヒント |
|:----------------|:-------------|:-------------|
| Deno がインストールできない | パス設定の問題 | 公式サイトの手順を正確に実行 |
| Edge Function が動かない | 環境変数の設定ミス | `.env` ファイルと Supabase secrets を確認 |
| データベースエラー | RLS ポリシーの理解不足 | まずはポリシーを無効化してテスト |
| 認証がうまくいかない | JWT の概念が不明確 | Supabase Dashboard で JWT を確認 |

### 🚀 中級者（プログラミング経験1〜3年）

**この章で重点的に学ぶべきこと**：

| 学習項目 | 時間配分 | 重要度 | 学習方法 |
|:---------|:--------:|:------:|:---------|
| 🔍 **トランザクション処理** | 3時間 | ⭐⭐⭐ | データ整合性の重要性を理解 |
| 🌐 **外部API連携** | 2時間 | ⭐⭐⭐ | Stripe・SendGrid との統合 |
| 🛡️ **セキュリティ実装** | 2時間 | ⭐⭐⭐ | 認証・認可・バリデーション |
| ⚡ **パフォーマンス最適化** | 2時間 | ⭐⭐ | キャッシュ・非同期処理 |

**学習の進め方**：
1. ✅ **アーキテクチャ理解**: なぜEdge Functionsを選ぶのか
2. ✅ **セキュリティ設計**: 脅威モデルを考慮した実装
3. ✅ **エラーハンドリング**: 堅牢なシステムの構築
4. ✅ **モニタリング**: 本番運用を意識した設計

**発展課題**：
- 📊 **複雑なビジネスロジック**: 割引計算・税計算の実装
- 🔔 **Webhook処理**: Stripe Webhookの冪等性保証
- 📈 **ロードテスト**: 大量リクエストでの動作確認
- 🔧 **カスタムミドルウェア**: 認証・ログ・レート制限

### 💪 上級者（プログラミング経験3年以上）

**この章で重点的に学ぶべきこと**：

| 学習項目 | 時間配分 | 重要度 | 学習方法 |
|:---------|:--------:|:------:|:---------|
| 🏗️ **システム設計** | 2時間 | ⭐⭐⭐ | 他パターンとの比較分析 |
| 📈 **スケーラビリティ** | 3時間 | ⭐⭐⭐ | 制約と限界の理解 |
| 🔧 **運用・監視** | 2時間 | ⭐⭐⭐ | プロダクション対応 |
| 🚀 **CI/CD・デプロイ** | 2時間 | ⭐⭐ | 自動化とベストプラクティス |

**学習の進め方**：
1. ✅ **設計思想の理解**: Edge Functionsの適用範囲
2. ✅ **制約と限界の把握**: コールドスタート・実行時間制限
3. ✅ **代替手法との比較**: Lambda・Cloud Functions・独立API
4. ✅ **エンタープライズ対応**: 監査・コンプライアンス・運用

**アーキテクチャ課題**：
- 🔄 **マイクロサービス化**: 機能別Function分割戦略
- 📊 **データパイプライン**: バッチ処理とリアルタイム処理
- 🛡️ **セキュリティ深化**: OAuth・SAML・多要素認証
- 📈 **コスト最適化**: 実行時間・メモリ使用量の分析

### 🎯 各レベル共通の学習チェックリスト

**基本理解**：
- [ ] Edge Functions の動作原理
- [ ] Deno/TypeScript の基本文法
- [ ] Supabase認証・RLSとの連携
- [ ] 外部API連携の基本パターン

**実践スキル**：
- [ ] Edge Functions の開発・デプロイ・運用
- [ ] トランザクション処理の実装
- [ ] エラーハンドリングとログ出力
- [ ] セキュリティ要件の実装

**応用知識**：
- [ ] Edge Functionsパターンの適用場面
- [ ] 他のアーキテクチャパターンとの比較
- [ ] パフォーマンスとコストの最適化
- [ ] スケーラビリティとメンテナンス性

### 📖 次の章への準備

**Chapter 5 に進む前に確認すべきこと**：

| 確認項目 | チェック |
|:---------|:--------:|
| Edge Functions が正常に動作する | □ |
| データベーストランザクションを理解している | □ |
| 外部API連携ができる | □ |
| 基本的なエラーは自力で解決できる | □ |

**Chapter 5 の予習ポイント**：
- 🏗️ **FastAPI**: Pythonによる高性能WebAPI開発
- 🏢 **マルチテナント**: 複数組織のデータ分離
- 🔧 **SQLAlchemy ORM**: データベースのオブジェクト関係マッピング
- 📊 **Redis**: キャッシュとセッション管理

## 📝 Chapter 4 学習まとめ

### 📊 **学習進捗トラッキング**
この章の学習進捗を以下のチェックリストで確認してください：

#### 🌱 **基礎理解（必須）**
- [ ] Edge Functionsの役割・メリット・制約を説明できる
- [ ] Deno/TypeScriptの基本的な文法・機能を理解した
- [ ] サーバーレス関数の概念・実行モデルを理解した
- [ ] 外部API連携（Stripe・SendGrid等）の基本パターンを理解した

#### 🚀 **応用理解（推奨）**
- [ ] トランザクション処理・データ整合性の実装パターンを理解した
- [ ] 在庫管理・予約システム等のビジネスロジックを実装できる
- [ ] エラーハンドリング・リトライ機構・冪等性を考慮した実装ができる
- [ ] パフォーマンス最適化・コールドスタート対策を理解した

#### 💪 **発展理解（上級者向け）**
- [ ] 複雑なワークフロー・マルチステップ処理を設計・実装できる
- [ ] Edge Functionsの制約を理解し、適切な代替手法を選択できる
- [ ] 監視・ログ・デバッグの手法を活用できる
- [ ] 他のサーバーレス環境（AWS Lambda・Vercel等）との比較ができる

#### 🔧 **実践スキル（確認推奨）**
- [ ] Edge Functionsの開発環境構築・デプロイができる
- [ ] ECサイト注文処理システムの基本機能を実装できる
- [ ] Stripe決済・SendGridメール送信を実装できる
- [ ] 基本的なテスト・デバッグ・トラブルシューティングができる

### ✅ **習得できたスキル**
- ✅ Edge Functions（Deno/TypeScript）による サーバーレス開発
- ✅ トランザクション処理とデータ整合性保証
- ✅ 外部API連携（Stripe決済・SendGridメール）
- ✅ リアルタイム在庫管理システムの構築

### 🎯 **アーキテクチャパターン比較**
| 観点 | Chapter 3 (クライアント) | Chapter 4 (Edge Functions) | Chapter 5 予告 (独立API) |
|:-----|:----------------------|:--------------------------|:----------------------|
| **実装方式** | 🖥️ クライアントサイド | ⚡ サーバーレス関数 | 🏗️ 独立API サーバー |
| **複雑さ** | 🌱 シンプル | 🚀 中程度 | 💪 高機能 |
| **適用場面** | CRUD・リアルタイム | 決済・通知・バッチ | エンタープライズ・SaaS |
| **スケーラビリティ** | ⚠️ 制限あり | ✅ 自動スケール | ✅ カスタム制御 |

### 🔄 **次章への準備**
Chapter 5で学ぶ独立APIサーバーパターンの基礎概念：
- ✅ 複雑なビジネスロジック処理（Edge Functions活用経験）
- ✅ 外部システム連携（Stripe・SendGrid実装経験）
- ✅ データベーストランザクション理解
- ✅ 認証・認可機構の実装経験

---

## 🚀 次章予告：独立API サーバーパターン

Chapter 5では、「**大病院の基幹システム**」を例に、エンタープライズ級のシステム設計を学習します：
- 🏢 **マルチテナント**: 複数病院の完全データ分離システム
- 🔧 **高度なAPI**: FastAPI + SQLAlchemy による柔軟なデータ操作
- 📊 **パフォーマンス**: Redis活用による高速レスポンス
- 🛡️ **セキュリティ**: エンタープライズ級認証・認可システム

**💡 実用例**: 「病院Aと病院Bのカルテを完全分離しつつ、厚労省への統計レポートは自動生成」する高度なシステム

---

**📍 ナビゲーション**
- **📚 目次**: [📖 学習ガイド](../../introduction/)
- **⬅️ 前の章**: [Chapter 3: クライアントサイド実装](../chapter03/)  
- **➡️ 次の章**: [Chapter 5: 独立API サーバー](../chapter05-1/)
- **🏠 関連章**: [Chapter 1: Supabase基礎](../chapter01/) | [Chapter 6: パフォーマンス](../chapter06/)
- **🔧 リソース**: [動作検証](../../examples/) | [トラブルシューティング](../../guides/troubleshooting/)
