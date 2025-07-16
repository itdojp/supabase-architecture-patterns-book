# Pattern 1: Client-side Implementation
# SupabaseをクライアントサイドでDirect接続する実装例

import flet as ft
import asyncio
from supabase import create_client, Client
from typing import Optional, Dict, Any
import json
import os

class SupabaseClientApp:
    """
    Pattern 1: Client-side Direct Connection
    
    特徴:
    - クライアントから直接Supabaseに接続
    - Row Level Security (RLS)による権限制御
    - リアルタイム更新の活用
    - 軽量で高速な実装
    """
    
    def __init__(self):
        # Supabaseクライアントの初期化
        self.supabase: Client = create_client(
            url=os.getenv("SUPABASE_URL", "YOUR_SUPABASE_URL"),
            key=os.getenv("SUPABASE_ANON_KEY", "YOUR_ANON_KEY")
        )
        self.current_user: Optional[Dict[str, Any]] = None
        self.realtime_subscription = None
    
    # === 認証システム ===
    
    async def signup(self, email: str, password: str, user_metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """新規ユーザー登録"""
        try:
            response = self.supabase.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": user_metadata or {}
                }
            })
            
            if response.user:
                return {
                    "success": True,
                    "user": response.user,
                    "message": "Registration successful! Please check your email for verification."
                }
            else:
                return {
                    "success": False,
                    "error": "Registration failed"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def login(self, email: str, password: str) -> Dict[str, Any]:
        """ユーザーログイン"""
        try:
            response = self.supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if response.user:
                self.current_user = response.user
                return {
                    "success": True,
                    "user": response.user,
                    "session": response.session
                }
            else:
                return {
                    "success": False,
                    "error": "Login failed"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def logout(self) -> Dict[str, Any]:
        """ログアウト"""
        try:
            response = self.supabase.auth.sign_out()
            self.current_user = None
            if self.realtime_subscription:
                self.realtime_subscription.unsubscribe()
            return {"success": True}
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # === データ操作 ===
    
    async def create_post(self, title: str, content: str) -> Dict[str, Any]:
        """ブログ投稿作成"""
        if not self.current_user:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            response = self.supabase.table('posts').insert({
                "title": title,
                "content": content,
                "author_id": self.current_user.id,
                "created_at": "now()"
            }).execute()
            
            return {
                "success": True,
                "data": response.data[0] if response.data else None
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_posts(self, limit: int = 10) -> Dict[str, Any]:
        """投稿一覧取得"""
        try:
            response = self.supabase.table('posts')\
                .select('*, profiles(name, avatar_url)')\
                .order('created_at', desc=True)\
                .limit(limit)\
                .execute()
            
            return {
                "success": True,
                "data": response.data
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def update_post(self, post_id: str, title: str, content: str) -> Dict[str, Any]:
        """投稿更新"""
        if not self.current_user:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            response = self.supabase.table('posts')\
                .update({"title": title, "content": content})\
                .eq('id', post_id)\
                .eq('author_id', self.current_user.id)\
                .execute()
            
            return {
                "success": True,
                "data": response.data[0] if response.data else None
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def delete_post(self, post_id: str) -> Dict[str, Any]:
        """投稿削除"""
        if not self.current_user:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            response = self.supabase.table('posts')\
                .delete()\
                .eq('id', post_id)\
                .eq('author_id', self.current_user.id)\
                .execute()
            
            return {"success": True}
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # === リアルタイム機能 ===
    
    def subscribe_to_posts(self, callback):
        """投稿のリアルタイム更新を購読"""
        try:
            def handle_changes(payload):
                print(f"Real-time update: {payload}")
                if callback:
                    callback(payload)
            
            self.realtime_subscription = self.supabase.table('posts')\
                .on('*', handle_changes)\
                .subscribe()
            
            return {"success": True}
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # === ユーザープロファイル ===
    
    async def get_user_profile(self) -> Dict[str, Any]:
        """ユーザープロファイル取得"""
        if not self.current_user:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            response = self.supabase.table('profiles')\
                .select('*')\
                .eq('id', self.current_user.id)\
                .single()\
                .execute()
            
            return {
                "success": True,
                "data": response.data
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def update_user_profile(self, name: str, avatar_url: str = None) -> Dict[str, Any]:
        """ユーザープロファイル更新"""
        if not self.current_user:
            return {"success": False, "error": "Not authenticated"}
        
        try:
            update_data = {"name": name}
            if avatar_url:
                update_data["avatar_url"] = avatar_url
            
            response = self.supabase.table('profiles')\
                .update(update_data)\
                .eq('id', self.current_user.id)\
                .execute()
            
            return {
                "success": True,
                "data": response.data[0] if response.data else None
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# === GUI Implementation with Flet ===

def main(page: ft.Page):
    """メインアプリケーション"""
    page.title = "Supabase Pattern 1: Client-side App"
    page.window_width = 800
    page.window_height = 600
    page.theme_mode = ft.ThemeMode.LIGHT
    
    app = SupabaseClientApp()
    
    # 状態管理
    current_page = ft.Ref[ft.Container]()
    posts_list = ft.Ref[ft.Column]()
    
    # === 認証画面 ===
    
    def create_auth_page():
        email_field = ft.TextField(
            label="Email",
            width=300,
            autofocus=True
        )
        password_field = ft.TextField(
            label="Password",
            width=300,
            password=True
        )
        
        async def handle_login(e):
            if not email_field.value or not password_field.value:
                page.add(ft.SnackBar(ft.Text("Please fill in all fields")))
                return
            
            result = await app.login(email_field.value, password_field.value)
            if result["success"]:
                page.add(ft.SnackBar(ft.Text("Login successful!")))
                show_main_page()
            else:
                page.add(ft.SnackBar(ft.Text(f"Login failed: {result['error']}")))
            page.update()
        
        async def handle_signup(e):
            if not email_field.value or not password_field.value:
                page.add(ft.SnackBar(ft.Text("Please fill in all fields")))
                return
            
            result = await app.signup(email_field.value, password_field.value)
            if result["success"]:
                page.add(ft.SnackBar(ft.Text("Registration successful! Please check your email.")))
            else:
                page.add(ft.SnackBar(ft.Text(f"Registration failed: {result['error']}")))
            page.update()
        
        return ft.Container(
            content=ft.Column([
                ft.Text("Supabase Client-side Demo", style=ft.TextThemeStyle.HEADLINE_MEDIUM),
                email_field,
                password_field,
                ft.Row([
                    ft.ElevatedButton("Login", on_click=handle_login),
                    ft.OutlinedButton("Sign Up", on_click=handle_signup)
                ])
            ], 
            alignment=ft.MainAxisAlignment.CENTER,
            horizontal_alignment=ft.CrossAxisAlignment.CENTER),
            alignment=ft.alignment.center
        )
    
    # === メイン画面 ===
    
    def create_main_page():
        # 新規投稿フォーム
        title_field = ft.TextField(label="Post Title", width=400)
        content_field = ft.TextField(
            label="Content",
            width=400,
            multiline=True,
            max_lines=5
        )
        
        async def handle_create_post(e):
            if not title_field.value or not content_field.value:
                page.add(ft.SnackBar(ft.Text("Please fill in all fields")))
                return
            
            result = await app.create_post(title_field.value, content_field.value)
            if result["success"]:
                page.add(ft.SnackBar(ft.Text("Post created!")))
                title_field.value = ""
                content_field.value = ""
                await load_posts()
            else:
                page.add(ft.SnackBar(ft.Text(f"Failed to create post: {result['error']}")))
            page.update()
        
        async def handle_logout(e):
            await app.logout()
            show_auth_page()
        
        async def load_posts():
            result = await app.get_posts()
            if result["success"]:
                posts_list.current.controls.clear()
                for post in result["data"]:
                    posts_list.current.controls.append(
                        ft.Card(
                            content=ft.Container(
                                content=ft.Column([
                                    ft.Text(post["title"], style=ft.TextThemeStyle.HEADLINE_SMALL),
                                    ft.Text(post["content"]),
                                    ft.Text(f"By: {post.get('profiles', {}).get('name', 'Unknown')}", 
                                           style=ft.TextThemeStyle.CAPTION_MEDIUM)
                                ]),
                                padding=10
                            )
                        )
                    )
                page.update()
        
        # 初期ロード
        asyncio.create_task(load_posts())
        
        return ft.Container(
            content=ft.Column([
                ft.AppBar(
                    title=ft.Text("Blog Posts"),
                    actions=[
                        ft.IconButton(ft.icons.LOGOUT, on_click=handle_logout)
                    ]
                ),
                ft.Container(
                    content=ft.Column([
                        ft.Text("Create New Post", style=ft.TextThemeStyle.HEADLINE_SMALL),
                        title_field,
                        content_field,
                        ft.ElevatedButton("Post", on_click=handle_create_post)
                    ]),
                    padding=20
                ),
                ft.Divider(),
                ft.Container(
                    content=ft.Column([
                        ft.Text("Recent Posts", style=ft.TextThemeStyle.HEADLINE_SMALL),
                        ft.Column(ref=posts_list)
                    ]),
                    padding=20
                )
            ], scroll=ft.ScrollMode.AUTO)
        )
    
    # === ページ管理 ===
    
    def show_auth_page():
        current_page.current.content = create_auth_page()
        page.update()
    
    def show_main_page():
        current_page.current.content = create_main_page()
        page.update()
    
    # 初期画面設定
    page.add(ft.Container(ref=current_page))
    show_auth_page()

if __name__ == "__main__":
    ft.app(target=main)