// Pattern 2: Edge Functions Implementation
// Supabase Edge Functionsを使用した中間層APIの実装例

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Pattern 2: Edge Functions Blog API
 * 
 * 特徴:
 * - サーバーレス実行環境
 * - 自動スケーリング
 * - 低レイテンシー
 * - ビジネスロジックの中央集約
 */

// 型定義
interface BlogPost {
  id?: string
  title: string
  content: string
  author_id: string
  created_at?: string
  updated_at?: string
  published: boolean
  tags?: string[]
}

interface CreatePostRequest {
  title: string
  content: string
  published?: boolean
  tags?: string[]
}

interface UpdatePostRequest {
  title?: string
  content?: string
  published?: boolean
  tags?: string[]
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Supabaseクライアント初期化
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// === 認証ヘルパー ===

async function getAuthenticatedUser(request: Request): Promise<{user: any, error?: string}> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return { user: null, error: 'No authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error) {
      return { user: null, error: error.message }
    }
    return { user }
  } catch (error) {
    return { user: null, error: 'Invalid token' }
  }
}

// === ビジネスロジック ===

async function createPost(user: any, postData: CreatePostRequest): Promise<ApiResponse<BlogPost>> {
  try {
    // 入力検証
    if (!postData.title || !postData.content) {
      return {
        success: false,
        error: 'Title and content are required'
      }
    }

    // タグの処理
    const tags = postData.tags || []
    
    // 投稿作成
    const { data, error } = await supabase
      .from('posts')
      .insert({
        title: postData.title,
        content: postData.content,
        author_id: user.id,
        published: postData.published || false,
        tags: tags,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    // 作成通知（リアルタイム）
    await supabase.channel('posts').send({
      type: 'broadcast',
      event: 'post_created',
      payload: { post: data }
    })

    return {
      success: true,
      data: data,
      message: 'Post created successfully'
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function getPosts(
  limit: number = 10,
  offset: number = 0,
  publishedOnly: boolean = true
): Promise<ApiResponse<BlogPost[]>> {
  try {
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (publishedOnly) {
      query = query.eq('published', true)
    }

    const { data, error } = await query

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: data
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function getPost(postId: string): Promise<ApiResponse<BlogPost>> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          name,
          avatar_url
        )
      `)
      .eq('id', postId)
      .single()

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: data
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function updatePost(
  user: any,
  postId: string,
  updateData: UpdatePostRequest
): Promise<ApiResponse<BlogPost>> {
  try {
    // 権限チェック
    const { data: existingPost, error: checkError } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single()

    if (checkError) {
      return {
        success: false,
        error: 'Post not found'
      }
    }

    if (existingPost.author_id !== user.id) {
      return {
        success: false,
        error: 'Not authorized to update this post'
      }
    }

    // 更新実行
    const { data, error } = await supabase
      .from('posts')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)
      .select()
      .single()

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: data,
      message: 'Post updated successfully'
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function deletePost(user: any, postId: string): Promise<ApiResponse> {
  try {
    // 権限チェック
    const { data: existingPost, error: checkError } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single()

    if (checkError) {
      return {
        success: false,
        error: 'Post not found'
      }
    }

    if (existingPost.author_id !== user.id) {
      return {
        success: false,
        error: 'Not authorized to delete this post'
      }
    }

    // 削除実行
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      message: 'Post deleted successfully'
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// === 高度な機能 ===

async function searchPosts(
  query: string,
  limit: number = 10
): Promise<ApiResponse<BlogPost[]>> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          name,
          avatar_url
        )
      `)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: data
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function getPostsByTag(
  tag: string,
  limit: number = 10
): Promise<ApiResponse<BlogPost[]>> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:author_id (
          name,
          avatar_url
        )
      `)
      .contains('tags', [tag])
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: data
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// === メインハンドラー ===

serve(async (req) => {
  // CORS処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // ルーティング
    if (path === '/posts') {
      if (method === 'GET') {
        // 投稿一覧取得
        const limit = parseInt(url.searchParams.get('limit') || '10')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const publishedOnly = url.searchParams.get('published') !== 'false'
        
        const result = await getPosts(limit, offset, publishedOnly)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        })
      } else if (method === 'POST') {
        // 投稿作成
        const { user, error } = await getAuthenticatedUser(req)
        if (!user) {
          return new Response(JSON.stringify({ success: false, error }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401
          })
        }

        const postData: CreatePostRequest = await req.json()
        const result = await createPost(user, postData)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.success ? 201 : 400
        })
      }
    } else if (path.startsWith('/posts/')) {
      const postId = path.split('/')[2]
      
      if (method === 'GET') {
        // 投稿詳細取得
        const result = await getPost(postId)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.success ? 200 : 404
        })
      } else if (method === 'PUT') {
        // 投稿更新
        const { user, error } = await getAuthenticatedUser(req)
        if (!user) {
          return new Response(JSON.stringify({ success: false, error }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401
          })
        }

        const updateData: UpdatePostRequest = await req.json()
        const result = await updatePost(user, postId, updateData)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        })
      } else if (method === 'DELETE') {
        // 投稿削除
        const { user, error } = await getAuthenticatedUser(req)
        if (!user) {
          return new Response(JSON.stringify({ success: false, error }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401
          })
        }

        const result = await deletePost(user, postId)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        })
      }
    } else if (path === '/posts/search') {
      if (method === 'GET') {
        // 投稿検索
        const query = url.searchParams.get('q') || ''
        const limit = parseInt(url.searchParams.get('limit') || '10')
        
        const result = await searchPosts(query, limit)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        })
      }
    } else if (path === '/posts/tag') {
      if (method === 'GET') {
        // タグ別投稿取得
        const tag = url.searchParams.get('tag') || ''
        const limit = parseInt(url.searchParams.get('limit') || '10')
        
        const result = await getPostsByTag(tag, limit)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        })
      }
    }

    // 404 Not Found
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Not found' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})