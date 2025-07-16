"""
Pattern 3: Independent API Server Implementation
FastAPI + SQLAlchemy + Supabaseを使用した独立APIサーバーの実装例

特徴:
- 完全なカスタマイズ性
- 複雑なビジネスロジックの実装
- マルチテナント対応
- 高度な認証・認可システム
- バックグラウンドタスク処理
"""

from fastapi import FastAPI, HTTPException, Depends, Security, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from supabase import create_client, Client
import secrets
import string
import jwt
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import os
from enum import Enum
import logging
from contextlib import asynccontextmanager

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === 設定 ===

class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./blog.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

settings = Settings()

# === データベース設定 ===

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# === Supabaseクライアント ===

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# === データモデル ===

class UserRole(str, Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    AUTHOR = "author"
    READER = "reader"

class PostStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    role = Column(String, default=UserRole.READER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    posts = relationship("Post", back_populates="author")
    comments = relationship("Comment", back_populates="author")

class Post(Base):
    __tablename__ = "posts"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    excerpt = Column(Text)
    status = Column(String, default=PostStatus.DRAFT)
    author_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    
    author = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post")

class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(String, primary_key=True, index=True)
    content = Column(Text)
    post_id = Column(String, ForeignKey("posts.id"))
    author_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments")

# テーブル作成
Base.metadata.create_all(bind=engine)

# === Pydantic Models ===

class UserBase(BaseModel):
    email: str
    name: str
    role: UserRole = UserRole.READER

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None

class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    
    class Config:
        orm_mode = True

class PostBase(BaseModel):
    title: str
    content: str
    excerpt: Optional[str] = None
    status: PostStatus = PostStatus.DRAFT

class PostCreate(PostBase):
    pass

class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    status: Optional[PostStatus] = None

class PostResponse(PostBase):
    id: str
    author_id: str
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    author: UserResponse
    
    class Config:
        orm_mode = True

class CommentBase(BaseModel):
    content: str

class CommentCreate(CommentBase):
    post_id: str

class CommentResponse(CommentBase):
    id: str
    post_id: str
    author_id: str
    created_at: datetime
    author: UserResponse
    
    class Config:
        orm_mode = True

class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
    error: Optional[str] = None

# === 依存関数 ===

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db)
):
    """JWTトークンから現在のユーザーを取得"""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # データベースからユーザー情報を取得
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(required_role: UserRole):
    """特定の役割を要求するデコレータ"""
    def role_checker(current_user: User = Depends(get_current_user)):
        user_role_priority = {
            UserRole.READER: 1,
            UserRole.AUTHOR: 2,
            UserRole.EDITOR: 3,
            UserRole.ADMIN: 4
        }
        
        if user_role_priority.get(current_user.role, 0) < user_role_priority.get(required_role, 0):
            raise HTTPException(
                status_code=403,
                detail=f"Required role: {required_role}, current role: {current_user.role}"
            )
        return current_user
    return role_checker

# === ビジネスロジック ===

class PostService:
    """投稿関連のビジネスロジック"""
    
    @staticmethod
    async def create_post(db: Session, post_data: PostCreate, author: User) -> Post:
        """投稿作成"""
        post = Post(
            id=f"post_{datetime.utcnow().timestamp()}",
            title=post_data.title,
            content=post_data.content,
            excerpt=post_data.excerpt or post_data.content[:100],
            status=post_data.status,
            author_id=author.id
        )
        
        if post_data.status == PostStatus.PUBLISHED:
            post.published_at = datetime.utcnow()
        
        db.add(post)
        db.commit()
        db.refresh(post)
        
        # Supabase Realtimeに通知
        await supabase.table('posts').insert({
            'id': post.id,
            'title': post.title,
            'author_id': post.author_id,
            'status': post.status,
            'created_at': post.created_at.isoformat()
        }).execute()
        
        return post
    
    @staticmethod
    async def update_post(db: Session, post_id: str, post_data: PostUpdate, current_user: User) -> Post:
        """投稿更新"""
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # 権限チェック
        if post.author_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.EDITOR]:
            raise HTTPException(status_code=403, detail="Not authorized to update this post")
        
        # 更新処理
        for field, value in post_data.dict(exclude_unset=True).items():
            setattr(post, field, value)
        
        if post_data.status == PostStatus.PUBLISHED and not post.published_at:
            post.published_at = datetime.utcnow()
        
        post.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(post)
        
        return post
    
    @staticmethod
    def get_posts(
        db: Session,
        skip: int = 0,
        limit: int = 10,
        status: Optional[PostStatus] = None,
        author_id: Optional[str] = None
    ) -> List[Post]:
        """投稿一覧取得"""
        query = db.query(Post).join(User)
        
        if status:
            query = query.filter(Post.status == status)
        if author_id:
            query = query.filter(Post.author_id == author_id)
        
        return query.offset(skip).limit(limit).all()

class NotificationService:
    """通知サービス"""
    
    @staticmethod
    async def send_post_notification(post: Post):
        """投稿通知の送信"""
        # ここで実際の通知処理を実装
        # 例: メール送信、Slack通知、プッシュ通知など
        logger.info(f"Sending notification for post: {post.title}")
        
        # Supabase Realtimeチャンネルに通知
        await supabase.channel('notifications').send({
            'type': 'broadcast',
            'event': 'new_post',
            'payload': {
                'post_id': post.id,
                'title': post.title,
                'author': post.author.name
            }
        })

# === FastAPIアプリケーション ===

@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションの開始・終了時の処理"""
    logger.info("Starting Blog API server...")
    yield
    logger.info("Shutting down Blog API server...")

app = FastAPI(
    title="Supabase Pattern 3: Independent API",
    description="Complete blog API with advanced features",
    version="1.0.0",
    lifespan=lifespan
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === エンドポイント ===

@app.get("/")
async def root():
    """API情報"""
    return {
        "name": "Supabase Pattern 3 Blog API",
        "version": "1.0.0",
        "description": "Independent API server with advanced features"
    }

@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# === 認証・ユーザー管理 ===

def generate_random_password(length: int = 16) -> str:
    """セキュアなランダムパスワードを生成"""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password

@app.post("/api/v1/users", response_model=ApiResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """ユーザー作成（管理者のみ）"""
    try:
        # Supabaseで認証ユーザーを作成
        auth_response = supabase.auth.admin.create_user({
            "email": user_data.email,
            "password": generate_random_password(),  # セキュアなランダムパスワード
            "email_confirm": True
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to create auth user")
        
        # ローカルDBにユーザー情報を保存
        user = User(
            id=auth_response.user.id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return ApiResponse(
            success=True,
            data=UserResponse.from_orm(user),
            message="User created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/users/me", response_model=ApiResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """現在のユーザー情報取得"""
    return ApiResponse(
        success=True,
        data=UserResponse.from_orm(current_user)
    )

@app.put("/api/v1/users/me", response_model=ApiResponse)
async def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """現在のユーザー情報更新"""
    try:
        for field, value in user_data.dict(exclude_unset=True).items():
            if field == "role" and current_user.role != UserRole.ADMIN:
                continue  # 管理者以外は役割変更不可
            setattr(current_user, field, value)
        
        db.commit()
        db.refresh(current_user)
        
        return ApiResponse(
            success=True,
            data=UserResponse.from_orm(current_user),
            message="User updated successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === 投稿管理 ===

@app.post("/api/v1/posts", response_model=ApiResponse)
async def create_post(
    post_data: PostCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(UserRole.AUTHOR)),
    db: Session = Depends(get_db)
):
    """投稿作成"""
    try:
        post = await PostService.create_post(db, post_data, current_user)
        
        # バックグラウンドで通知送信
        if post.status == PostStatus.PUBLISHED:
            background_tasks.add_task(NotificationService.send_post_notification, post)
        
        return ApiResponse(
            success=True,
            data=PostResponse.from_orm(post),
            message="Post created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/posts", response_model=ApiResponse)
async def get_posts(
    skip: int = 0,
    limit: int = 10,
    status: Optional[PostStatus] = None,
    author_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """投稿一覧取得"""
    try:
        posts = PostService.get_posts(db, skip, limit, status, author_id)
        return ApiResponse(
            success=True,
            data=[PostResponse.from_orm(post) for post in posts]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/posts/{post_id}", response_model=ApiResponse)
async def get_post(post_id: str, db: Session = Depends(get_db)):
    """投稿詳細取得"""
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        return ApiResponse(
            success=True,
            data=PostResponse.from_orm(post)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/v1/posts/{post_id}", response_model=ApiResponse)
async def update_post(
    post_id: str,
    post_data: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """投稿更新"""
    try:
        post = await PostService.update_post(db, post_id, post_data, current_user)
        return ApiResponse(
            success=True,
            data=PostResponse.from_orm(post),
            message="Post updated successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/v1/posts/{post_id}", response_model=ApiResponse)
async def delete_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """投稿削除"""
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # 権限チェック
        if post.author_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.EDITOR]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this post")
        
        db.delete(post)
        db.commit()
        
        return ApiResponse(
            success=True,
            message="Post deleted successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === 高度な機能 ===

@app.get("/api/v1/posts/search", response_model=ApiResponse)
async def search_posts(
    q: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """投稿検索"""
    try:
        posts = db.query(Post).filter(
            (Post.title.contains(q)) | (Post.content.contains(q)),
            Post.status == PostStatus.PUBLISHED
        ).limit(limit).all()
        
        return ApiResponse(
            success=True,
            data=[PostResponse.from_orm(post) for post in posts]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/analytics/posts", response_model=ApiResponse)
async def get_post_analytics(
    current_user: User = Depends(require_role(UserRole.EDITOR)),
    db: Session = Depends(get_db)
):
    """投稿分析データ取得"""
    try:
        # 基本統計
        total_posts = db.query(Post).count()
        published_posts = db.query(Post).filter(Post.status == PostStatus.PUBLISHED).count()
        draft_posts = db.query(Post).filter(Post.status == PostStatus.DRAFT).count()
        
        # 作者別統計
        author_stats = db.query(User.name, db.func.count(Post.id)).join(Post).group_by(User.id).all()
        
        return ApiResponse(
            success=True,
            data={
                "total_posts": total_posts,
                "published_posts": published_posts,
                "draft_posts": draft_posts,
                "author_stats": [{"author": name, "count": count} for name, count in author_stats]
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)