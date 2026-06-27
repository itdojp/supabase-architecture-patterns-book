---
layout: book
order: 21
title: "付録B: 参考資料"
---
# 付録B: 参考資料

---
- **目次に戻る**: [はじめに]({{ '/introduction/' | relative_url }})
- **関連章**: [全章]({{ '/introduction/' | relative_url }}) で参照されるリファレンス資料集
- **用途**: 開発中の即座な参照・トラブルシューティング・実装支援
- **利用方法**: 必要時に該当セクションを参照
- **レベル**: 全レベル対応（基礎〜上級）
---

## 付録の使い方

この付録は各章での学習・実装を支援する**実践的リファレンス集**です：

- **環境構築**: 開発環境の自動セットアップスクリプト
- **チェックリスト**: 実装・運用時の確認項目
- [CRITICAL] **トラブルシューティング**: よくある問題と解決方法
- **ベストプラクティス**: 実用的な設計・実装パターン
- **設定サンプル**: そのまま使える設定ファイル集

### 各章からの参照

| 章 | 主な参照セクション | 用途 |
|:---|:-----------------|:-----|
| **第1章〜第2章**| A. 環境構築、G. トラブルシューティング | 基礎環境準備・初期設定 |
| **第3章〜第5-4章**| B. 設定テンプレート、C. コードスニペット | 実装サポート・設定例 |
| **第6章〜第8章**| D. パフォーマンス、E. セキュリティ | 最適化・運用設定 |
| **第9章〜第10章**| F. デプロイメント、H. ベストプラクティス | 実践・統合支援 |

---

## A. 環境構築スクリプト集 {#appendix-env-setup-scripts}

### A.1 Supabase 開発環境セットアップ

```bash
#!/bin/bash
# setup_supabase_dev.sh
# Supabase 開発環境の完全自動セットアップ

set -euo pipefail

# 設定変数
PROJECT_NAME="${1:-supabase-app}"
POSTGRES_PASSWORD="${2:-$(openssl rand -base64 32)}"
JWT_SECRET="${3:-$(openssl rand -base64 64)}"

echo " Supabase 開発環境セットアップ開始"
echo "プロジェクト名: $PROJECT_NAME"

# 必要なツールのチェック
check_dependencies() {
    local deps=("docker" "psql" "curl" "jq" "openssl")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            echo "[NG] $dep がインストールされていません"
            exit 1
        fi
    done

    # Compose v2（docker compose）前提。Compose v1（docker-compose）は前提にしない。
    if ! docker compose version &> /dev/null; then
        echo "[NG] Docker Compose（Compose v2）が利用できません（'docker compose version' が失敗しました）"
        exit 1
    fi
    echo "[OK] 依存関係チェック完了"
}

# プロジェクトディレクトリ作成
setup_project_structure() {
    mkdir -p "$PROJECT_NAME"/{supabase/{migrations,seed,functions,volumes/{db/{data,init},api}},apps/{flet-client,fastapi-server},scripts,docs}
    cd "$PROJECT_NAME"
    echo "[OK] プロジェクト構造作成完了"
}

# 環境変数ファイル生成
create_env_files() {
    cat > .env << EOF
# Supabase 設定
SUPABASE_URL=http://localhost:54321
# ローカル（セルフホスト）の場合は legacy JWT（anon/service_role）を設定
SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXXXXXXXXXX
SUPABASE_SECRET_KEY=sb_secret_XXXXXXXXXXXXXXXX

# データベース設定
POSTGRES_HOST=localhost
POSTGRES_PORT=54322
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# JWT 設定
JWT_SECRET=$JWT_SECRET

# API 設定
API_PORT=8000
API_HOST=0.0.0.0

# 外部サービス（本番環境で設定）
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SENDGRID_API_KEY=
SLACK_WEBHOOK_URL=
EOF

    # 本番用環境変数テンプレート
    cat > .env.production.template << EOF
# 本番環境用設定テンプレート
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXXXXXXXXXX
SUPABASE_SECRET_KEY=sb_secret_XXXXXXXXXXXXXXXX

POSTGRES_HOST=your-production-host
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password

JWT_SECRET=your-production-jwt-secret

# 外部サービス
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG....
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
EOF

    echo "[OK] 環境変数ファイル作成完了"
}

# Docker Compose設定生成
create_docker_compose() {
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL データベース
  supabase-db:
    image: supabase/postgres:15.1.0.117
    container_name: supabase-db
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    volumes:
      - ./supabase/volumes/db/data:/var/lib/postgresql/data
      - ./supabase/volumes/db/init:/docker-entrypoint-initdb.d
    ports:
      - "54322:5432"
    command: postgres -c wal_level=logical
    restart: unless-stopped

  # Supabase Studio（管理画面）
  supabase-studio:
    image: supabase/studio:20231123-fb9c70e
    container_name: supabase-studio
    environment:
      SUPABASE_URL: http://localhost:54321
      SUPABASE_PUBLISHABLE_KEY: ${SUPABASE_PUBLISHABLE_KEY}
      SUPABASE_SECRET_KEY: ${SUPABASE_SECRET_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - supabase-kong
    restart: unless-stopped

  # Kong API Gateway
  supabase-kong:
    image: kong:2.8.1
    container_name: supabase-kong
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl
    volumes:
      - ./supabase/volumes/api/kong.yml:/var/lib/kong/kong.yml:ro
    ports:
      - "54321:8000"
      - "54323:8001"
    depends_on:
      - supabase-auth
      - supabase-rest
      - supabase-realtime
    restart: unless-stopped

  # Supabase Auth（認証サーバー）
  supabase-auth:
    image: supabase/gotrue:v2.99.0
    container_name: supabase-auth
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@supabase-db:5432/postgres?search_path=auth
      GOTRUE_SITE_URL: http://localhost:3000
      GOTRUE_URI_ALLOW_LIST: http://localhost:3000,http://localhost:8000
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_ADMIN_GROUP_NAME: service_role
      GOTRUE_EXTERNAL_EMAIL_ENABLED: true
      GOTRUE_MAILER_AUTOCONFIRM: true
      GOTRUE_SMTP_HOST:
      GOTRUE_SMTP_PORT: 587
      GOTRUE_SMTP_USER:
      GOTRUE_SMTP_PASS:
    depends_on:
      - supabase-db
    restart: unless-stopped

  # PostgREST（自動 API 生成）
  supabase-rest:
    image: postgrest/postgrest:v11.2.0
    container_name: supabase-rest
    environment:
      PGRST_DB_URI: postgres://postgres:${POSTGRES_PASSWORD}@supabase-db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_USE_LEGACY_GUCS: "false"
    depends_on:
      - supabase-db
    restart: unless-stopped

  # Realtime（リアルタイム機能）
  supabase-realtime:
    image: supabase/realtime:v2.25.35
    container_name: supabase-realtime
    environment:
      PORT: 4000
      DB_HOST: supabase-db
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_NAME: postgres
      DB_AFTER_CONNECT_QUERY: 'SET search_path TO _realtime'
      DB_ENC_KEY: supabaserealtime
      API_JWT_SECRET: ${JWT_SECRET}
      SECRET_KEY_BASE: UpNVntn3cDxHJpq99YMc1T1AQgQpc8kfYTuRgBiYa15BLrx8etQoXz3gZv1/u2oq
      ERL_AFLAGS: -proto_dist inet_tcp
      ENABLE_TAILSCALE: "false"
      DNS_NODES: "''"
    depends_on:
      - supabase-db
    command: >
      bash -c "
        /app/bin/migrate &&
        /app/bin/realtime eval 'Realtime.Release.seeds(Realtime.Repo)' &&
        /app/bin/server
      "
    restart: unless-stopped

  # Redis（キャッシュ・セッション）
  redis:
    image: redis:7-alpine
    container_name: supabase-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
EOF

    echo "[OK] Docker Compose設定作成完了"
}

# Kong設定生成
create_kong_config() {
    mkdir -p supabase/volumes/api
    cat > supabase/volumes/api/kong.yml << 'EOF'
_format_version: "2.1"
_transform: true

consumers:
  - username: anon
    keyauth_credentials:
      - key: your-legacy-anon-jwt
  - username: service_role
    keyauth_credentials:
      - key: your-legacy-service-role-jwt

acls:
  - consumer: anon
    group: anon
  - consumer: service_role
    group: service_role

services:
  - name: auth-v1-open
    url: http://supabase-auth:9999/
    routes:
      - name: auth-v1-open
        strip_path: true
        paths:
          - "/auth/v1/signup"
          - "/auth/v1/token"
          - "/auth/v1/verify"
          - "/auth/v1/recover"
          - "/auth/v1/settings"

  - name: auth-v1-open-verify
    url: http://supabase-auth:9999/verify
    routes:
      - name: auth-v1-open-verify
        strip_path: true
        paths:
          - "/auth/v1/verify"

  - name: auth-v1
    _comment: "GoTrue: /auth/v1/* -> http://supabase-auth:9999/*"
    url: http://supabase-auth:9999/
    routes:
      - name: auth-v1-all
        strip_path: true
        paths:
          - "/auth/v1/"
    plugins:
      - name: cors

  - name: rest-v1
    _comment: "PostgREST: /rest/v1/* -> http://supabase-rest:3000/*"
    url: http://supabase-rest:3000/
    routes:
      - name: rest-v1-all
        strip_path: true
        paths:
          - "/rest/v1/"
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false

  - name: realtime-v1
    _comment: "Realtime: /realtime/v1/* -> ws://supabase-realtime:4000/socket/*"
    url: http://supabase-realtime:4000/socket/
    routes:
      - name: realtime-v1-all
        strip_path: true
        paths:
          - "/realtime/v1/"
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false
EOF

    echo "[OK] Kong設定作成完了"
}

# 初期マイグレーション作成
create_initial_migration() {
    cat > supabase/migrations/001_initial_schema.sql << 'EOF'
-- 初期スキーマ設定
-- 拡張機能有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- カスタム型定義
CREATE TYPE user_role AS ENUM ('admin', 'member', 'viewer');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed', 'cancelled');

-- プロファイルテーブル
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'member',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 組織テーブル
CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 組織メンバーシップ
CREATE TABLE organization_members (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- プロジェクトテーブル
CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- タスクテーブル
CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority task_priority DEFAULT 'medium',
    status task_status DEFAULT 'todo',
    assignee_id UUID REFERENCES auth.users(id),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

-- RLS 有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- プロファイルの RLS ポリシー
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 組織の RLS ポリシー
CREATE POLICY "Organization members can view" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = organizations.id
            AND user_id = auth.uid()
        )
    );

-- タスクの RLS ポリシー
CREATE POLICY "Task visibility" ON tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE p.id = tasks.project_id
            AND om.user_id = auth.uid()
        )
    );

-- 更新日時の自動更新関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新日時トリガー
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- プロファイル自動作成関数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ユーザー作成時のトリガー
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
EOF

    echo "[OK] 初期マイグレーション作成完了"
}

# 開発用スクリプト生成
create_dev_scripts() {
    mkdir -p scripts

    # 起動スクリプト
    cat > scripts/start.sh << 'EOF'
#!/bin/bash
echo " Supabase 開発環境起動中..."
docker compose up -d

echo " サービス起動待機中..."
sleep 10

# ヘルスチェック
echo " ヘルスチェック実行中..."
curl -f http://localhost:54321/rest/v1/ > /dev/null 2>&1 && echo "[OK] PostgREST: OK" || echo "[NG] PostgREST: NG"
curl -f http://localhost:54321/auth/v1/settings > /dev/null 2>&1 && echo "[OK] Auth: OK" || echo "[NG] Auth: NG"
curl -f http://localhost:3000 > /dev/null 2>&1 && echo "[OK] Studio: OK" || echo "[NG] Studio: NG"

echo " Supabase 開発環境が利用可能です"
echo " Studio: http://localhost:3000"
echo " API: http://localhost:54321"
echo " Database: localhost:54322"
EOF

    # 停止スクリプト
    cat > scripts/stop.sh << 'EOF'
#!/bin/bash
echo " Supabase 開発環境停止中..."
docker compose down
echo "[OK] 停止完了"
EOF

    # リセットスクリプト
    cat > scripts/reset.sh << 'EOF'
#!/bin/bash
echo " Supabase 開発環境リセット中..."
docker compose down -v
docker compose up -d
echo "[OK] リセット完了"
EOF

    # バックアップスクリプト
    cat > scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo " データベースバックアップ中..."
docker compose exec -T supabase-db pg_dump -U postgres -d postgres > "$BACKUP_DIR/database.sql"

echo " 設定ファイルバックアップ中..."
cp -r supabase/migrations "$BACKUP_DIR/"
cp docker-compose.yml "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/env.backup"

echo "[OK] バックアップ完了: $BACKUP_DIR"
EOF

    chmod +x scripts/*.sh
    echo "[OK] 開発スクリプト作成完了"
}

# メイン実行
main() {
    check_dependencies
    setup_project_structure
    create_env_files
    create_docker_compose
    create_kong_config
    create_initial_migration
    create_dev_scripts

    echo ""
    echo " Supabase 開発環境セットアップ完了！"
    echo ""
    echo "次のステップ:"
    echo "1. cd $PROJECT_NAME"
    echo "2. ./scripts/start.sh"
    echo "3. http://localhost:3000 でStudioにアクセス"
    echo ""
    echo "パスワード: $POSTGRES_PASSWORD"
    echo "JWT Secret: $JWT_SECRET"
}

main "$@"
```

### A.2 本番環境デプロイスクリプト

```bash
#!/bin/bash
# deploy_production.sh
# 本番環境への安全なデプロイ

set -euo pipefail

ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"

echo " $ENVIRONMENT 環境へのデプロイ開始 (version: $VERSION)"

# 前提条件チェック
check_prerequisites() {
    local required_tools=("kubectl" "helm" "docker" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            echo "[NG] $tool が必要です"
            exit 1
        fi
    done

    # 環境変数チェック
    if [[ -z "${KUBECONFIG:-}" ]]; then
        echo "[NG] KUBECONFIG が設定されていません"
        exit 1
    fi

    echo "[OK] 前提条件チェック完了"
}

# イメージビルドとプッシュ
build_and_push_images() {
    echo " Docker イメージビルド中..."

    # FastAPI アプリケーション
    docker build -t "myapp/api:$VERSION" ./apps/fastapi-server/
    docker push "myapp/api:$VERSION"

    # Flet クライアント（必要に応じて）
    if [[ -f "./apps/flet-client/Dockerfile" ]]; then
        docker build -t "myapp/client:$VERSION" ./apps/flet-client/
        docker push "myapp/client:$VERSION"
    fi

    echo "[OK] イメージプッシュ完了"
}

# データベースマイグレーション
run_migrations() {
    echo " データベースマイグレーション実行中..."

    # Kubernetes ジョブでマイグレーション実行
    kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: migration-$VERSION
  namespace: $ENVIRONMENT
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migration
        image: myapp/api:$VERSION
        command: ["python", "-m", "alembic", "upgrade", "head"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database_url
EOF

    # ジョブ完了待機
    kubectl wait --for=condition=complete job/migration-$VERSION -n $ENVIRONMENT --timeout=300s

    echo "[OK] マイグレーション完了"
}

# アプリケーションデプロイ
deploy_application() {
    echo " アプリケーションデプロイ中..."

    # Helm チャートでデプロイ
    helm upgrade --install myapp ./helm/myapp \
        --namespace $ENVIRONMENT \
        --set image.tag=$VERSION \
        --set environment=$ENVIRONMENT \
        --values ./helm/values-$ENVIRONMENT.yaml \
        --wait

    echo "[OK] アプリケーションデプロイ完了"
}

# ヘルスチェック
health_check() {
    echo " ヘルスチェック実行中..."

    local api_url
    if [[ "$ENVIRONMENT" == "production" ]]; then
        api_url="https://api.myapp.com"
    else
        api_url="https://api-staging.myapp.com"
    fi

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f "$api_url/health" > /dev/null 2>&1; then
            echo "[OK] ヘルスチェック成功"
            return 0
        fi

        echo " ヘルスチェック失敗 ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    echo "[NG] ヘルスチェック失敗"
    return 1
}

# ロールバック関数
rollback() {
    echo " ロールバック実行中..."

    local previous_version
    previous_version=$(helm history myapp -n $ENVIRONMENT --max 2 -o json | jq -r '.[1].app_version')

    helm rollback myapp -n $ENVIRONMENT

    echo "[OK] ロールバック完了 (version: $previous_version)"
}

# メイン実行
main() {
    check_prerequisites

    # バックアップ作成
    echo " デプロイ前バックアップ作成中..."
    ./scripts/backup_production.sh

    build_and_push_images
    run_migrations
    deploy_application

    if ! health_check; then
        echo "[NG] デプロイ失敗 - ロールバック実行"
        rollback
        exit 1
    fi

    echo " デプロイ成功！"
    echo " URL: https://$(kubectl get ingress myapp-ingress -n $ENVIRONMENT -o jsonpath='{.spec.rules[0].host}')"
}

main "$@"
```

---

## B. 設定ファイルテンプレート

### B.1 Kubernetes 設定

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    environment: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    environment: staging
```

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fastapi-app
  namespace: \{\{ .Values.namespace \}\}
spec:
  replicas: \{\{ .Values.replicas \}\}
  selector:
    matchLabels:
      app: fastapi-app
  template:
    metadata:
      labels:
        app: fastapi-app
    spec:
      containers:
      - name: api
        image: \{\{ .Values.image.repository \}\}:\{\{ .Values.image.tag \}\}
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database_url
        - name: SUPABASE_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: supabase_url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: jwt_secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### B.2 GitHub Actions CI/CD

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v4

    - name: Set up Python
      uses: actions/setup-python@v6
      with:
        python-version: '3.11'

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-test.txt

    - name: Run tests
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        JWT_SECRET: test-secret
      run: |
        pytest tests/ -v --cov=app --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v5
      with:
        file: ./coverage.xml

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@0.33.1
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v4
      with:
        sarif_file: 'trivy-results.sarif'

  build-and-push:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
    - uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    steps:
    - uses: actions/checkout@v4

    - name: Deploy to staging
      run: |
        echo "Deploying to staging environment"
        # Kubernetes/Helm deployment commands

  deploy-production:
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
    - uses: actions/checkout@v4

    - name: Deploy to production
      run: |
        echo "Deploying to production environment"
        # Kubernetes/Helm deployment commands
```

### B.3 FastAPI 設定テンプレート

```python
# app/core/config.py
from pydantic_settings import BaseSettings
from typing import Optional, List
import secrets

class Settings(BaseSettings):
    # API 設定
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8日

    # CORS設定
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # データベース設定
    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_PORT: int = 5432

    # Supabase 設定
    SUPABASE_URL: str
    SUPABASE_PUBLISHABLE_KEY: str
    SUPABASE_SECRET_KEY: str

    # Redis設定
    REDIS_URL: str = "redis://localhost:6379"

    # 外部サービス
    STRIPE_SECRET_KEY: Optional[str] = None
    SENDGRID_API_KEY: Optional[str] = None

    # 監視設定
    SENTRY_DSN: Optional[str] = None
    LOG_LEVEL: str = "INFO"

    # 本番環境固有設定
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

---

## C. チェックリスト集

### C.1 セキュリティチェックリスト

#### 開発環境

- [ ] 環境変数にシークレット情報が含まれていないか
- [ ] `sb_publishable_...`、`sb_secret_...`、legacy `anon` / `service_role` の用途が分離されているか
- [ ] secret key / `service_role` がブラウザ、モバイル、公開リポジトリ、URL、未マスクログへ露出していないか
- [ ] デフォルトパスワードが変更されているか
- [ ] 不要なポートが開放されていないか
- [ ] ローカル Supabase スタックが公開ネットワークへ露出していないか
- [ ] 公開スキーマの RLS ポリシーが適切に設定されているか
- [ ] Storage の `storage.objects` ポリシーが操作別に設定されているか
- [ ] Realtime private channel の `realtime.messages` ポリシーが設定されているか
- [ ] Edge Functions の `--no-verify-jwt` 使用箇所に署名検証または独自認可が実装されているか
- [ ] JWT トークンの有効期限が適切か
- [ ] 入力値のバリデーションが実装されているか
- [ ] SQL インジェクション対策が実装されているか
- [ ] XSS対策が実装されているか
- [ ] CSRF対策が実装されているか

#### 本番環境

- [ ] HTTPS通信が強制されているか
- [ ] セキュリティヘッダーが設定されているか
- [ ] IP ホワイトリストが設定されているか
- [ ] ファイアウォール設定が適切か
- [ ] データベースの暗号化が有効か
- [ ] バックアップの暗号化が有効か
- [ ] 監査ログが有効になっているか
- [ ] 脆弱性スキャンが定期実行されているか
- [ ] セキュリティアップデートが適用されているか
- [ ] アクセス権限の最小化が実装されているか

### C.2 パフォーマンスチェックリスト

#### データベース

- [ ] 適切なインデックスが作成されているか
- [ ] スロークエリが最適化されているか
- [ ] 接続プールが適切に設定されているか
- [ ] VACUUM・ANALYZEが定期実行されているか
- [ ] パーティショニングが検討されているか
- [ ] 統計情報が最新か
- [ ] デッドロックが発生していないか

#### アプリケーション

- [ ] API レスポンス時間が要件を満たしているか
- [ ] キャッシュ戦略が実装されているか
- [ ] 不要なN+1クエリが除去されているか
- [ ] 非同期処理が適切に実装されているか
- [ ] メモリリークがないか
- [ ] エラー処理が適切に実装されているか

#### インフラストラクチャ

- [ ] 適切なリソース制限が設定されているか
- [ ] オートスケーリングが設定されているか
- [ ] ロードバランサーが適切に設定されているか
- [ ] CDNが設定されているか
- [ ] 監視・アラートが設定されているか

### C.3 運用チェックリスト {#operational-checklists}

#### デプロイ前

- [ ] テストカバレッジが十分か
- [ ] セキュリティスキャンが完了しているか
- [ ] パフォーマンステストが完了しているか
- [ ] ドキュメントが最新か
- [ ] ロールバック手順が準備されているか
- [ ] 関係者への通知が完了しているか

#### デプロイ後

- [ ] ヘルスチェックが成功しているか
- [ ] エラー率が正常範囲内か
- [ ] パフォーマンスメトリクスが正常か
- [ ] ログに異常がないか
- [ ] ユーザーからの問い合わせがないか
- [ ] 外部サービス連携が正常か

#### 定期メンテナンス

- [ ] バックアップが正常に取得されているか
- [ ] ログローテーションが実行されているか
- [ ] セキュリティパッチが適用されているか
- [ ] リソース使用量の傾向分析が実施されているか
- [ ] 容量計画の見直しが実施されているか
- [ ] インシデント対応手順の見直しが実施されているか

---

## D. リファレンス

### D.1 Supabase API リファレンス

#### PostgREST クエリパターン

```javascript
// 基本クエリ
const { data, error } = await supabase
  .from('tasks')
  .select('*')

// 選択的フィールド
const { data, error } = await supabase
  .from('tasks')
  .select('id, title, status')

// 関連データ含む
const { data, error } = await supabase
  .from('tasks')
  .select(`
    id,
    title,
    assignee:assignee_id(id, name),
    project:project_id(id, name)
  `)

// フィルタリング
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('status', 'completed')
  .gte('created_at', '2024-01-01')
  .order('created_at', { ascending: false })
  .limit(10)

// 複雑なフィルタ
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .or('status.eq.urgent,priority.eq.high')
  .in('assignee_id', ['uuid1', 'uuid2'])

// 全文検索
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .textSearch('title', 'important task')

// 集計
const { count, error } = await supabase
  .from('tasks')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'completed')
```

#### リアルタイム機能

```javascript
// テーブル変更監視
const subscription = supabase
  .channel('tasks_channel')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks'
  }, (payload) => {
    console.log('Change received!', payload)
  })
  .subscribe()

// 特定条件の監視
const subscription = supabase
  .channel('my_tasks_channel')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'tasks',
    filter: 'assignee_id=eq.user-uuid'
  }, (payload) => {
    console.log('My task updated!', payload)
  })
  .subscribe()

// プレゼンス機能
const channel = supabase.channel('online_users')

channel
  .on('presence', { event: 'sync' }, () => {
    const newState = channel.presenceState()
    console.log('sync', newState)
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('join', key, newPresences)
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('leave', key, leftPresences)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: 'user-uuid',
        online_at: new Date().toISOString(),
      })
    }
  })
```

### D.2 PostgreSQL / RLS パターン集

#### 高度な RLS ポリシー

```sql
-- 動的条件ポリシー
CREATE POLICY "Dynamic project access" ON tasks
    FOR ALL USING (
        CASE
            WHEN current_setting('app.user_role', true) = 'admin' THEN true
            WHEN current_setting('app.user_role', true) = 'manager' THEN
                project_id IN (
                    SELECT id FROM projects
                    WHERE manager_id = auth.uid()
                )
            ELSE
                assignee_id = auth.uid()
        END
    );

-- 時間制限ポリシー
CREATE POLICY "Business hours access" ON sensitive_data
    FOR ALL USING (
        EXTRACT(hour FROM current_time) BETWEEN 9 AND 17
        AND EXTRACT(dow FROM current_date) BETWEEN 1 AND 5
    );

-- 地域制限ポリシー
CREATE POLICY "Regional data access" ON customer_data
    FOR SELECT USING (
        region = current_setting('app.user_region', true)
        OR auth.jwt() ->> 'role' = 'global_admin'
    );

-- 階層型組織ポリシー
CREATE POLICY "Hierarchical access" ON employees
    FOR ALL USING (
        id = auth.uid() OR
        EXISTS (
            WITH RECURSIVE subordinates AS (
                SELECT id FROM employees WHERE manager_id = auth.uid()
                UNION ALL
                SELECT e.id FROM employees e
                JOIN subordinates s ON e.manager_id = s.id
            )
            SELECT 1 FROM subordinates WHERE id = employees.id
        )
    );
```

### D.3 エラーコード・ステータスコード一覧

#### HTTP ステータスコード

- `200 OK` - 成功
- `201 Created` - リソース作成成功
- `400 Bad Request` - リクエスト不正
- `401 Unauthorized` - 認証エラー
- `403 Forbidden` - 認可エラー
- `404 Not Found` - リソース未発見
- `409 Conflict` - 競合エラー
- `422 Unprocessable Entity` - バリデーションエラー
- `429 Too Many Requests` - レート制限
- `500 Internal Server Error` - サーバーエラー

#### PostgreSQL エラーコード

- `23505` - 一意制約違反
- `23503` - 外部キー制約違反
- `23514` - チェック制約違反
- `42501` - 権限不足
- `42P01` - テーブル未存在
- `42703` - カラム未存在

#### Supabase 固有エラー

- `PGRST301` - 単一行期待だが複数行
- `PGRST204` - 該当データなし
- `PGRST000` - PostgreSQL エラー

### D.4 設定値リファレンス

#### PostgreSQL 重要設定

```sql
-- 接続設定
max_connections = 100
superuser_reserved_connections = 3

-- メモリ設定
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB

-- WAL 設定
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10

-- 性能設定
random_page_cost = 1.1
effective_io_concurrency = 200

-- ログ設定
log_statement = 'mod'
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

#### PostgREST 設定

```toml
db-uri = "postgresql://user:pass@host:port/db"
db-schema = "public"
db-anon-role = "anon"
db-pool = 10
db-pool-timeout = 10

server-host = "0.0.0.0"
server-port = 3000

jwt-secret = "your-jwt-secret"
jwt-aud = "your-audience"

max-rows = 1000
pre-request = "public.check_permissions"
```

#### Edge Functions環境変数

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXXXXXXXXXX
SUPABASE_SECRET_KEY=sb_secret_XXXXXXXXXXXXXXXX

# 外部サービス
STRIPE_SECRET_KEY=sk_test_...
SENDGRID_API_KEY=SG....

# デバッグ設定
DENO_DEBUG=true
LOG_LEVEL=DEBUG
```

### D.5 有用な SQL クエリ集

```sql
-- データベース使用量分析
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- インデックス効果分析
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- アクティブな接続確認
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- RLS ポリシー一覧
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- スロークエリ分析
SELECT
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean_time DESC
LIMIT 20;
```

---

## 終章

本教科書では、Supabase を活用した3つの主要アーキテクチャパターンの実践的実装を通じて、モダンアプリケーション開発の包括的な知識を習得しました。

**習得した主要スキル**:

- アーキテクチャパターンの適切な選択判断
- セキュリティを考慮した認証・認可システムの設計
- スケーラブルなデータベース設計と RLS 実装
- パフォーマンス最適化の体系的アプローチ
- 運用自動化とトラブルシューティング手法

**実践への応用**:
本書で学んだパターンと手法は、Supabase を使用するプロジェクトだけでなく、モダンなフルスタック開発全般に応用可能です。とくに、セキュリティファーストの設計思想と段階的な拡張戦略は、あらゆる規模のプロジェクトで価値を発揮します。

**継続的な学習**:
技術の進歩に合わせて、定期的に最新のベストプラクティスと Supabase の新機能をキャッチアップし、本書の内容をアップデートしていくことを推奨します。

**コミュニティへの貢献**:
学んだ知識を活用して、オープンソースプロジェクトへの貢献や技術記事の執筆など、コミュニティへの還元も検討してください。

---

最新の情報とサンプルコードは、GitHub リポジトリで公開・更新しています。

## Happy Coding with Supabase!

---

## 付録活用まとめ

### [OK] **この付録で得られるもの**
- [OK] すぐに使える実践的な環境構築スクリプト・設定ファイル
- [OK] 開発・運用時の体系的チェックリスト・ベストプラクティス
- [OK] トラブル発生時の迅速な問題解決リファレンス
- [OK] プロダクション対応の実装パターン・設定例

### **効果的な活用方法**
| 場面 | 活用セクション | 期待効果 |
|:-----|:-------------|:---------|
| **プロジェクト開始時**| A. 環境構築スクリプト | 迅速な開発環境準備 |
| **実装中**| B. 設定テンプレート、C. コードスニペット | 効率的な実装・品質向上 |
| **問題発生時**| G. トラブルシューティング | 素早い問題解決 |
| **本番リリース前**| D. パフォーマンス、E. セキュリティ | 品質・安全性確保 |

### **継続的な改善**
この付録は学習・実装の経験を積むことで、さらに価値が高まります：
- 実際の開発で遭遇した課題・解決策の追記
- チーム固有のベストプラクティスの蓄積
- 新しい Supabase 機能・コミュニティ情報の反映

---

**最終ナビゲーション**
- **目次**: [はじめに]({{ '/introduction/' | relative_url }})
- **全章**: [第1章〜第10章]({{ '/introduction/' | relative_url }}) での実装時に参照
- **関連リソース**: [動作検証]({{ '/guides/code-verification/' | relative_url }}) | [チェックリスト]({{ '/appendices/appendix01/' | relative_url }}#operational-checklists) | [トラブルシューティング]({{ '/guides/troubleshooting/' | relative_url }})
- **コミュニティ**: [Supabase公式](https://supabase.com) | [GitHub](https://github.com/supabase/supabase)
