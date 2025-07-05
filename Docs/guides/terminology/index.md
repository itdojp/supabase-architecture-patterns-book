---
layout: book
title: "Terminology Guide - 用語統一ガイド"
---

# Terminology Guide - 用語統一ガイド

## 📋 Purpose / 目的

This guide ensures consistent terminology usage throughout the Supabase Architecture Patterns book.
本ガイドは、Supabaseアーキテクチャパターンブック全体での用語使用の一貫性を確保します。

## 🔤 General Rules / 一般規則

### 1. Language Priority / 言語優先順位
- **Technical Terms**: Use English for all technical terms (API, Database, Authentication)
- **Explanations**: Use Japanese for explanations and descriptions
- **Code**: All code comments in English

### 2. Capitalization / 大文字使用
- **Product Names**: Always capitalize properly (Supabase, PostgreSQL, PostgREST)
- **Technical Terms**: Follow standard conventions (WebSocket, not websocket)
- **Acronyms**: All caps (API, RLS, JWT)

## 📚 Standard Terms / 標準用語

### Core Components / コアコンポーネント

| English | Japanese | Usage Example |
|---------|----------|---------------|
| Database | データベース | PostgreSQLデータベース |
| Authentication | 認証 | 認証システム |
| Authorization | 認可 | 認可ポリシー |
| Real-time | リアルタイム | リアルタイム通信 |
| Row Level Security (RLS) | 行レベルセキュリティ (RLS) | RLSポリシー |
| API | API | REST API |
| WebSocket | WebSocket | WebSocket接続 |

### Actions / アクション

| English | Japanese | Usage Example |
|---------|----------|---------------|
| Create | 作成 | テーブル作成 |
| Read | 読み取り | データ読み取り |
| Update | 更新 | レコード更新 |
| Delete | 削除 | データ削除 |
| Connect | 接続 | データベース接続 |
| Subscribe | 購読 | チャンネル購読 |
| Authenticate | 認証する | ユーザー認証する |
| Authorize | 認可する | アクセス認可する |

### Technical Terms / 技術用語

| Correct | Incorrect | Notes |
|---------|-----------|-------|
| PostgreSQL | Postgres, postgres | Always use full name |
| PostgREST | PostGREST, postgrest | Note the 'g' placement |
| Supabase | supabase, SupaBase | Capital 'S' only |
| WebSocket | Websocket, websocket | Capital 'W' and 'S' |
| JavaScript | Javascript, JS | Full name preferred |
| TypeScript | Typescript, TS | Full name preferred |
| Row Level Security | row level security, RLS | Use full name first, then RLS |
| Write-Ahead Log | write-ahead log | Use capitals or WAL |

### Error Messages / エラーメッセージ

| Type | Format | Example |
|------|--------|---------|
| Connection Error | 接続エラー | データベース接続エラー |
| Authentication Error | 認証エラー | ユーザー認証エラー |
| Permission Error | 権限エラー | アクセス権限エラー |
| Validation Error | 検証エラー | 入力検証エラー |

## 🎯 Usage Guidelines / 使用ガイドライン

### 1. First Mention / 初出時
```
正: Row Level Security (RLS) は、データベースレベルでアクセス制御を行います。
誤: RLSは、データベースレベルでアクセス制御を行います。
```

### 2. Code Comments / コードコメント
```javascript
// Correct: Use English in code
const supabase = createClient(url, key);

// Incorrect: 日本語コメントは避ける
const supabase = createClient(url, key); // クライアント作成
```

### 3. Section Headers / セクションヘッダー
```
正: ## 認証システムの実装
誤: ## Authentication System Implementation
```

### 4. Technical Explanations / 技術説明
```
正: PostgreSQLデータベースにデータを保存します
誤: Postgresデータベースにデータを保存します
```

## 📝 Checklist / チェックリスト

Before publishing, verify:
- [ ] All product names are correctly capitalized
- [ ] Technical terms follow standard conventions
- [ ] Japanese is used for explanations
- [ ] English is used for code and technical terms
- [ ] Acronyms are consistently formatted
- [ ] First mentions include full names

## 🔄 Updates / 更新履歴

| Date | Change | Reason |
|------|--------|--------|
| 2024-06-18 | Initial creation | Standardize terminology |

---

*This guide should be referenced by all contributors to maintain consistency across the book.*