"""
Pattern 1 (Client-side) テスト
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
import sys
import os

# テスト用にパスを追加
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'pattern1'))

from client_app import SupabaseClientApp


class TestSupabaseClientApp:
    """クライアントサイドアプリケーションのテスト"""
    
    @pytest.fixture
    def app(self):
        """テスト用アプリケーションインスタンス"""
        with patch('client_app.create_client') as mock_create_client:
            mock_supabase = Mock()
            mock_create_client.return_value = mock_supabase
            app = SupabaseClientApp()
            app.supabase = mock_supabase
            return app
    
    @pytest.mark.asyncio
    async def test_signup_success(self, app):
        """新規登録成功のテスト"""
        # Mock設定
        mock_user = Mock()
        mock_user.id = "test-user-id"
        mock_response = Mock()
        mock_response.user = mock_user
        
        app.supabase.auth.sign_up.return_value = mock_response
        
        # テスト実行
        result = await app.signup("test@example.com", "password123", {"name": "Test User"})
        
        # 検証
        assert result["success"] == True
        assert result["user"] == mock_user
        assert "Registration successful" in result["message"]
        
        app.supabase.auth.sign_up.assert_called_once_with({
            "email": "test@example.com",
            "password": "password123",
            "options": {
                "data": {"name": "Test User"}
            }
        })
    
    @pytest.mark.asyncio
    async def test_signup_failure(self, app):
        """新規登録失敗のテスト"""
        # Mock設定
        app.supabase.auth.sign_up.side_effect = Exception("Email already exists")
        
        # テスト実行
        result = await app.signup("test@example.com", "password123")
        
        # 検証
        assert result["success"] == False
        assert "Email already exists" in result["error"]
    
    @pytest.mark.asyncio
    async def test_login_success(self, app):
        """ログイン成功のテスト"""
        # Mock設定
        mock_user = Mock()
        mock_user.id = "test-user-id"
        mock_session = Mock()
        mock_response = Mock()
        mock_response.user = mock_user
        mock_response.session = mock_session
        
        app.supabase.auth.sign_in_with_password.return_value = mock_response
        
        # テスト実行
        result = await app.login("test@example.com", "password123")
        
        # 検証
        assert result["success"] == True
        assert result["user"] == mock_user
        assert result["session"] == mock_session
        assert app.current_user == mock_user
        
        app.supabase.auth.sign_in_with_password.assert_called_once_with({
            "email": "test@example.com",
            "password": "password123"
        })
    
    @pytest.mark.asyncio
    async def test_login_failure(self, app):
        """ログイン失敗のテスト"""
        # Mock設定
        app.supabase.auth.sign_in_with_password.side_effect = Exception("Invalid credentials")
        
        # テスト実行
        result = await app.login("test@example.com", "wrong_password")
        
        # 検証
        assert result["success"] == False
        assert "Invalid credentials" in result["error"]
        assert app.current_user is None
    
    @pytest.mark.asyncio
    async def test_logout(self, app):
        """ログアウトのテスト"""
        # 初期状態設定
        app.current_user = Mock()
        app.realtime_subscription = Mock()
        app.supabase.auth.sign_out.return_value = Mock()
        
        # テスト実行
        result = await app.logout()
        
        # 検証
        assert result["success"] == True
        assert app.current_user is None
        app.supabase.auth.sign_out.assert_called_once()
        app.realtime_subscription.unsubscribe.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_post_success(self, app):
        """投稿作成成功のテスト"""
        # ユーザーログイン状態をセット
        mock_user = Mock()
        mock_user.id = "test-user-id"
        app.current_user = mock_user
        
        # Mock設定
        mock_response = Mock()
        mock_response.data = [{"id": "post-id", "title": "Test Post"}]
        app.supabase.table.return_value.insert.return_value.execute.return_value = mock_response
        
        # テスト実行
        result = await app.create_post("Test Post", "This is test content")
        
        # 検証
        assert result["success"] == True
        assert result["data"]["id"] == "post-id"
        app.supabase.table.assert_called_with('posts')
    
    @pytest.mark.asyncio
    async def test_create_post_not_authenticated(self, app):
        """未認証時の投稿作成のテスト"""
        # ユーザーログイン状態をクリア
        app.current_user = None
        
        # テスト実行
        result = await app.create_post("Test Post", "This is test content")
        
        # 検証
        assert result["success"] == False
        assert "Not authenticated" in result["error"]
    
    @pytest.mark.asyncio
    async def test_get_posts_success(self, app):
        """投稿一覧取得成功のテスト"""
        # Mock設定
        mock_posts = [
            {"id": "1", "title": "Post 1", "content": "Content 1"},
            {"id": "2", "title": "Post 2", "content": "Content 2"}
        ]
        mock_response = Mock()
        mock_response.data = mock_posts
        
        app.supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = mock_response
        
        # テスト実行
        result = await app.get_posts(limit=5)
        
        # 検証
        assert result["success"] == True
        assert len(result["data"]) == 2
        assert result["data"][0]["title"] == "Post 1"
        
        app.supabase.table.assert_called_with('posts')
    
    @pytest.mark.asyncio
    async def test_update_post_success(self, app):
        """投稿更新成功のテスト"""
        # ユーザーログイン状態をセット
        mock_user = Mock()
        mock_user.id = "test-user-id"
        app.current_user = mock_user
        
        # Mock設定
        mock_response = Mock()
        mock_response.data = [{"id": "post-id", "title": "Updated Post"}]
        app.supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = mock_response
        
        # テスト実行
        result = await app.update_post("post-id", "Updated Post", "Updated content")
        
        # 検証
        assert result["success"] == True
        assert result["data"]["title"] == "Updated Post"
    
    @pytest.mark.asyncio
    async def test_delete_post_success(self, app):
        """投稿削除成功のテスト"""
        # ユーザーログイン状態をセット
        mock_user = Mock()
        mock_user.id = "test-user-id"
        app.current_user = mock_user
        
        # Mock設定
        mock_response = Mock()
        mock_response.data = []
        app.supabase.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value = mock_response
        
        # テスト実行
        result = await app.delete_post("post-id")
        
        # 検証
        assert result["success"] == True
    
    @pytest.mark.asyncio
    async def test_get_user_profile_success(self, app):
        """ユーザープロファイル取得成功のテスト"""
        # ユーザーログイン状態をセット
        mock_user = Mock()
        mock_user.id = "test-user-id"
        app.current_user = mock_user
        
        # Mock設定
        mock_profile = {"id": "test-user-id", "name": "Test User", "email": "test@example.com"}
        mock_response = Mock()
        mock_response.data = mock_profile
        app.supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_response
        
        # テスト実行
        result = await app.get_user_profile()
        
        # 検証
        assert result["success"] == True
        assert result["data"]["name"] == "Test User"
        app.supabase.table.assert_called_with('profiles')
    
    @pytest.mark.asyncio
    async def test_update_user_profile_success(self, app):
        """ユーザープロファイル更新成功のテスト"""
        # ユーザーログイン状態をセット
        mock_user = Mock()
        mock_user.id = "test-user-id"
        app.current_user = mock_user
        
        # Mock設定
        mock_response = Mock()
        mock_response.data = [{"id": "test-user-id", "name": "Updated User"}]
        app.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_response
        
        # テスト実行
        result = await app.update_user_profile("Updated User", "avatar.jpg")
        
        # 検証
        assert result["success"] == True
        assert result["data"]["name"] == "Updated User"
    
    def test_subscribe_to_posts_success(self, app):
        """投稿購読成功のテスト"""
        # Mock設定
        mock_subscription = Mock()
        app.supabase.table.return_value.on.return_value.subscribe.return_value = mock_subscription
        
        # テスト実行
        callback = Mock()
        result = app.subscribe_to_posts(callback)
        
        # 検証
        assert result["success"] == True
        app.supabase.table.assert_called_with('posts')


class TestIntegration:
    """統合テスト"""
    
    @pytest.mark.asyncio
    async def test_user_workflow(self):
        """ユーザーワークフローの統合テスト"""
        with patch('client_app.create_client') as mock_create_client:
            mock_supabase = Mock()
            mock_create_client.return_value = mock_supabase
            
            app = SupabaseClientApp()
            app.supabase = mock_supabase
            
            # 1. サインアップ
            mock_user = Mock()
            mock_user.id = "test-user-id"
            mock_signup_response = Mock()
            mock_signup_response.user = mock_user
            app.supabase.auth.sign_up.return_value = mock_signup_response
            
            signup_result = await app.signup("test@example.com", "password123")
            assert signup_result["success"] == True
            
            # 2. ログイン
            mock_login_response = Mock()
            mock_login_response.user = mock_user
            mock_login_response.session = Mock()
            app.supabase.auth.sign_in_with_password.return_value = mock_login_response
            
            login_result = await app.login("test@example.com", "password123")
            assert login_result["success"] == True
            assert app.current_user == mock_user
            
            # 3. 投稿作成
            mock_post_response = Mock()
            mock_post_response.data = [{"id": "post-id", "title": "Test Post"}]
            app.supabase.table.return_value.insert.return_value.execute.return_value = mock_post_response
            
            post_result = await app.create_post("Test Post", "Test content")
            assert post_result["success"] == True
            
            # 4. 投稿一覧取得
            mock_posts_response = Mock()
            mock_posts_response.data = [{"id": "post-id", "title": "Test Post"}]
            app.supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = mock_posts_response
            
            posts_result = await app.get_posts()
            assert posts_result["success"] == True
            assert len(posts_result["data"]) == 1
            
            # 5. ログアウト
            app.supabase.auth.sign_out.return_value = Mock()
            logout_result = await app.logout()
            assert logout_result["success"] == True
            assert app.current_user is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])