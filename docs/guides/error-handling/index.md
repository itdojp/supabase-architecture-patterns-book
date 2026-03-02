---
layout: book
order: 16
title: "エラーハンドリング詳細ガイド"
---
# エラーハンドリング詳細ガイド

> **Supabase実践アーキテクチャパターン**1.0版 | 株式会社アイティードゥ | 2025年6月2日

## 目次

1. [エラー分類と対応戦略](#エラー分類と対応戦略)
2. [認証・認可エラー](#認証・認可エラー)
3. [データベースエラー](#データベースエラー)
4. [リアルタイム機能エラー](#リアルタイム機能エラー)
5. [ネットワーク・接続エラー](#ネットワーク・接続エラー)
6. [エラー監視・ログ](#エラー監視・ログ)
7. [ユーザーフレンドリーエラー表示](#ユーザーフレンドリーエラー表示)

---

## エラー分類と対応戦略

### エラー分類体系

```typescript
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization', 
  VALIDATION = 'validation',
  DATABASE = 'database',
  NETWORK = 'network',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AppError {
  id: string
  category: ErrorCategory
  severity: ErrorSeverity
  code: string
  message: string
  userMessage: string
  details?: any
  timestamp: Date
  context?: Record<string, any>
  recoverable: boolean
  retryable: boolean
}
```

### 包括的エラーハンドラー

```typescript
export class ErrorHandler {
  private static instance: ErrorHandler
  private errorLog: AppError[] = []
  private errorCallbacks: Map<ErrorCategory, Array<(error: AppError) => void>> = new Map()

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  // エラー処理メイン関数
  handleError(error: any, context?: Record<string, any>): AppError {
    const appError = this.categorizeError(error, context)
    this.logError(appError)
    this.notifyCallbacks(appError)
    
    // 重要度に応じた追加処理
    if (appError.severity === ErrorSeverity.CRITICAL) {
      this.handleCriticalError(appError)
    }
    
    return appError
  }

  // エラー分類ロジック
  private categorizeError(error: any, context?: Record<string, any>): AppError {
    const errorId = this.generateErrorId()
    const timestamp = new Date()
    
    // Supabaseエラーの分類
    if (error?.code) {
      return this.handleSupabaseError(error, errorId, timestamp, context)
    }
    
    // ネットワークエラーの分類
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return this.createAppError({
        id: errorId,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        code: 'NETWORK_ERROR',
        message: error.message,
        userMessage: 'ネットワーク接続に問題があります。しばらく待ってから再試行してください。',
        timestamp,
        context,
        recoverable: true,
        retryable: true
      })
    }
    
    // 一般的なJavaScriptエラー
    if (error instanceof Error) {
      return this.createAppError({
        id: errorId,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        code: 'JAVASCRIPT_ERROR',
        message: error.message,
        userMessage: 'システムエラーが発生しました。しばらく待ってから再試行してください。',
        timestamp,
        context: { ...context, stack: error.stack },
        recoverable: false,
        retryable: false
      })
    }
    
    // 未知のエラー
    return this.createAppError({
      id: errorId,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.HIGH,
      code: 'UNKNOWN_ERROR',
      message: String(error),
      userMessage: '予期しないエラーが発生しました。',
      timestamp,
      context,
      recoverable: false,
      retryable: false
    })
  }

  // Supabase固有エラーの処理
  private handleSupabaseError(error: any, id: string, timestamp: Date, context?: Record<string, any>): AppError {
    const errorMappings = {
      // 認証エラー
      'invalid_credentials': {
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.LOW,
        userMessage: 'メールアドレスまたはパスワードが正しくありません。',
        recoverable: true,
        retryable: true
      },
      'email_not_confirmed': {
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'メールアドレスの確認が完了していません。確認メールをご確認ください。',
        recoverable: true,
        retryable: false
      },
      'too_many_requests': {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
        recoverable: true,
        retryable: true
      },
      
      // データベースエラー
      '23505': { // UNIQUE_VIOLATION
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        userMessage: 'この値は既に使用されています。',
        recoverable: true,
        retryable: false
      },
      '23503': { // FOREIGN_KEY_VIOLATION
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        userMessage: '関連するデータが見つかりません。',
        recoverable: true,
        retryable: false
      },
      '42501': { // INSUFFICIENT_PRIVILEGE
        category: ErrorCategory.AUTHORIZATION,
        severity: ErrorSeverity.HIGH,
        userMessage: 'この操作を実行する権限がありません。',
        recoverable: false,
        retryable: false
      },
      
      // PostgreSQLエラー
      '42P01': { // UNDEFINED_TABLE
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.CRITICAL,
        userMessage: 'システムエラーが発生しました。管理者にお問い合わせください。',
        recoverable: false,
        retryable: false
      }
    }

    const mapping = errorMappings[error.code] || errorMappings[error.error_code] || {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'エラーが発生しました。',
      recoverable: false,
      retryable: false
    }

    return this.createAppError({
      id,
      category: mapping.category,
      severity: mapping.severity,
      code: error.code || error.error_code || 'SUPABASE_ERROR',
      message: error.message || 'Supabase error occurred',
      userMessage: mapping.userMessage,
      timestamp,
      context: { ...context, originalError: error },
      recoverable: mapping.recoverable,
      retryable: mapping.retryable
    })
  }

  private createAppError(params: Omit<AppError, 'details'>): AppError {
    return {
      ...params,
      details: params.context
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private logError(error: AppError): void {
    this.errorLog.push(error)
    
    // コンソールログ
    const logLevel = this.getLogLevel(error.severity)
    console[logLevel](`[${error.category}] ${error.code}: ${error.message}`, {
      id: error.id,
      timestamp: error.timestamp,
      context: error.context
    })
    
    // 外部ログサービスへの送信
    this.sendToExternalLogging(error)
  }

  private getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'log'
      case ErrorSeverity.MEDIUM:
        return 'warn'
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error'
    }
  }

  private sendToExternalLogging(error: AppError): void {
    // 外部ログサービス（例：Sentry、LogRocket等）への送信
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(new Error(error.message), {
        tags: {
          category: error.category,
          severity: error.severity,
          code: error.code
        },
        extra: error.context
      })
    }
  }

  private handleCriticalError(error: AppError): void {
    // 重要なエラーの場合の追加処理
    console.error('CRITICAL ERROR DETECTED:', error)
    
    // 管理者への通知
    this.notifyAdministrators(error)
    
    // フェイルセーフ処理
    this.executeFailsafe(error)
  }

  private notifyAdministrators(error: AppError): void {
    // 管理者通知ロジック（メール、Slack等）
    console.log('Notifying administrators of critical error:', error.id)
  }

  private executeFailsafe(error: AppError): void {
    // フェイルセーフ処理（緊急時の安全な状態への移行）
    console.log('Executing failsafe procedures for error:', error.id)
  }

  private notifyCallbacks(error: AppError): void {
    const callbacks = this.errorCallbacks.get(error.category) || []
    callbacks.forEach(callback => {
      try {
        callback(error)
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError)
      }
    })
  }

  // コールバック登録
  onError(category: ErrorCategory, callback: (error: AppError) => void): void {
    if (!this.errorCallbacks.has(category)) {
      this.errorCallbacks.set(category, [])
    }
    this.errorCallbacks.get(category)!.push(callback)
  }

  // エラー統計取得
  getErrorStats(timeRange?: { start: Date; end: Date }): Record<string, any> {
    let filteredErrors = this.errorLog
    
    if (timeRange) {
      filteredErrors = this.errorLog.filter(error => 
        error.timestamp >= timeRange.start && error.timestamp <= timeRange.end
      )
    }

    const stats = {
      total: filteredErrors.length,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byCode: {} as Record<string, number>
    }

    filteredErrors.forEach(error => {
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1
      stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1
    })

    return stats
  }
}
```

---

## 認証・認可エラー

### 認証エラーハンドラー

```typescript
export class AuthErrorHandler {
  static handleAuthError(error: any): {
    shouldRetry: boolean
    shouldRedirect: boolean
    redirectUrl?: string
    userMessage: string
    actionRequired?: string
  } {
    switch (error.message || error.error_description) {
      case 'Invalid login credentials':
        return {
          shouldRetry: true,
          shouldRedirect: false,
          userMessage: 'メールアドレスまたはパスワードが正しくありません。再度お試しください。',
          actionRequired: 'check_credentials'
        }

      case 'Email not confirmed':
        return {
          shouldRetry: false,
          shouldRedirect: false,
          userMessage: 'メールアドレスの確認が必要です。確認メールをご確認ください。',
          actionRequired: 'email_confirmation'
        }

      case 'Too many requests':
        return {
          shouldRetry: true,
          shouldRedirect: false,
          userMessage: 'ログイン試行回数が上限に達しました。15分後に再度お試しください。',
          actionRequired: 'wait_and_retry'
        }

      case 'User not found':
        return {
          shouldRetry: true,
          shouldRedirect: false,
          userMessage: 'このメールアドレスは登録されていません。新規登録しますか？',
          actionRequired: 'suggest_signup'
        }

      case 'Invalid refresh token':
      case 'JWT expired':
        return {
          shouldRetry: false,
          shouldRedirect: true,
          redirectUrl: '/login',
          userMessage: 'セッションが期限切れです。再度ログインしてください。',
          actionRequired: 'relogin'
        }

      case 'Email already registered':
        return {
          shouldRetry: false,
          shouldRedirect: false,
          userMessage: 'このメールアドレスは既に登録されています。ログインしますか？',
          actionRequired: 'suggest_login'
        }

      default:
        return {
          shouldRetry: false,
          shouldRedirect: false,
          userMessage: '認証エラーが発生しました。しばらく待ってから再試行してください。',
          actionRequired: 'contact_support'
        }
    }
  }

  // 自動リトライ機能付き認証
  static async authenticateWithRetry(
    authFunction: () => Promise<any>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<any> {
    let lastError: any
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await authFunction()
      } catch (error) {
        lastError = error
        const errorInfo = this.handleAuthError(error)
        
        if (!errorInfo.shouldRetry || attempt === maxRetries) {
          throw error
        }
        
        // 指数バックオフでリトライ
        const delay = baseDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        console.log(`Authentication attempt ${attempt} failed, retrying in ${delay}ms...`)
      }
    }
    
    throw lastError
  }
}

// 使用例
export async function loginWithErrorHandling(email: string, password: string) {
  try {
    return await AuthErrorHandler.authenticateWithRetry(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      return data
    })
  } catch (error) {
    const errorHandler = ErrorHandler.getInstance()
    const appError = errorHandler.handleError(error, { 
      operation: 'login',
      email: email 
    })
    
    const authErrorInfo = AuthErrorHandler.handleAuthError(error)
    
    return {
      success: false,
      error: appError,
      authInfo: authErrorInfo
    }
  }
}
```

---

## データベースエラー

### データベースエラー専用ハンドラー

```typescript
export class DatabaseErrorHandler {
  static handleDatabaseError(error: any): {
    isUserError: boolean
    canRetry: boolean
    userMessage: string
    technicalDetails: string
    suggestedAction?: string
  } {
    // PostgreSQLエラーコード別処理
    const postgresErrorMap: Record<string, any> = {
      // データ整合性エラー
      '23505': { // unique_violation
        isUserError: true,
        canRetry: false,
        userMessage: 'この値は既に使用されています。別の値を入力してください。',
        technicalDetails: 'Unique constraint violation',
        suggestedAction: 'change_input'
      },
      
      '23503': { // foreign_key_violation
        isUserError: true,
        canRetry: false,
        userMessage: '選択された項目が見つかりません。画面を更新して再度お試しください。',
        technicalDetails: 'Foreign key constraint violation',
        suggestedAction: 'refresh_data'
      },
      
      '23514': { // check_violation
        isUserError: true,
        canRetry: false,
        userMessage: '入力された値が有効範囲外です。正しい値を入力してください。',
        technicalDetails: 'Check constraint violation',
        suggestedAction: 'validate_input'
      },
      
      // 権限エラー
      '42501': { // insufficient_privilege
        isUserError: false,
        canRetry: false,
        userMessage: 'この操作を実行する権限がありません。',
        technicalDetails: 'Insufficient privileges',
        suggestedAction: 'contact_admin'
      },
      
      // スキーマエラー
      '42P01': { // undefined_table
        isUserError: false,
        canRetry: false,
        userMessage: 'システムエラーが発生しました。管理者にお問い合わせください。',
        technicalDetails: 'Table does not exist',
        suggestedAction: 'contact_support'
      },
      
      '42703': { // undefined_column
        isUserError: false,
        canRetry: false,
        userMessage: 'システムエラーが発生しました。管理者にお問い合わせください。',
        technicalDetails: 'Column does not exist',
        suggestedAction: 'contact_support'
      },
      
      // 接続・トランザクションエラー
      '08006': { // connection_failure
        isUserError: false,
        canRetry: true,
        userMessage: 'データベース接続に問題があります。しばらく待ってから再試行してください。',
        technicalDetails: 'Connection failure',
        suggestedAction: 'retry_later'
      },
      
      '40001': { // serialization_failure
        isUserError: false,
        canRetry: true,
        userMessage: '処理が競合しました。しばらく待ってから再試行してください。',
        technicalDetails: 'Serialization failure',
        suggestedAction: 'retry_with_delay'
      }
    }

    const errorCode = error.code || error.error_code
    const mapping = postgresErrorMap[errorCode]
    
    if (mapping) {
      return {
        ...mapping,
        technicalDetails: `${mapping.technicalDetails} (Code: ${errorCode})`
      }
    }

    // PostgRESTエラーの処理
    if (error.hint || error.details) {
      return {
        isUserError: false,
        canRetry: false,
        userMessage: 'データ処理中にエラーが発生しました。',
        technicalDetails: `PostgREST Error: ${error.message}. Hint: ${error.hint}. Details: ${error.details}`,
        suggestedAction: 'contact_support'
      }
    }

    // 一般的なデータベースエラー
    return {
      isUserError: false,
      canRetry: true,
      userMessage: 'データベースエラーが発生しました。しばらく待ってから再試行してください。',
      technicalDetails: error.message || 'Unknown database error',
      suggestedAction: 'retry_later'
    }
  }

  // リトライ機能付きデータベース操作
  static async executeWithRetry<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await operation()
        
        if (error) {
          const errorInfo = this.handleDatabaseError(error)
          
          if (!errorInfo.canRetry || attempt === maxRetries) {
            throw error
          }
          
          lastError = error
          
          // 指数バックオフ
          const delay = baseDelay * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
          
          console.log(`Database operation attempt ${attempt} failed, retrying in ${delay}ms...`)
          continue
        }
        
        if (data === null) {
          throw new Error('No data returned from database operation')
        }
        
        return data
      } catch (error) {
        if (attempt === maxRetries) {
          throw error
        }
        lastError = error
      }
    }
    
    throw lastError
  }
}

// 使用例：安全なデータベース操作
export async function safeCreateUser(userData: any) {
  try {
    const result = await DatabaseErrorHandler.executeWithRetry(async () => {
      return await supabase
        .from('users')
        .insert(userData)
        .select()
        .single()
    })
    
    return { success: true, data: result }
  } catch (error) {
    const errorHandler = ErrorHandler.getInstance()
    const appError = errorHandler.handleError(error, {
      operation: 'create_user',
      userData: { ...userData, password: '[REDACTED]' }
    })
    
    const dbErrorInfo = DatabaseErrorHandler.handleDatabaseError(error)
    
    return {
      success: false,
      error: appError,
      dbInfo: dbErrorInfo
    }
  }
}
```

---

## リアルタイム機能エラー

### WebSocketエラーハンドラー

```typescript
export class RealtimeErrorHandler {
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000
  private subscriptions: Map<string, any> = new Map()

  handleRealtimeError(error: any, channelName: string): {
    shouldReconnect: boolean
    delay: number
    userMessage: string
  } {
    switch (error.type || error.code) {
      case 'WEBSOCKET_CLOSED':
      case 'CONNECTION_LOST':
        return {
          shouldReconnect: this.reconnectAttempts < this.maxReconnectAttempts,
          delay: this.calculateReconnectDelay(),
          userMessage: 'リアルタイム接続が切断されました。再接続を試行しています...'
        }

      case 'SUBSCRIPTION_FAILED':
        return {
          shouldReconnect: true,
          delay: 2000,
          userMessage: 'リアルタイム機能の初期化に失敗しました。再試行しています...'
        }

      case 'AUTHENTICATION_FAILED':
        return {
          shouldReconnect: false,
          delay: 0,
          userMessage: 'リアルタイム機能の認証に失敗しました。再ログインが必要です。'
        }

      case 'RATE_LIMITED':
        return {
          shouldReconnect: true,
          delay: 10000, // 10秒待機
          userMessage: 'リアルタイム機能の使用制限に達しました。しばらく待ってから再接続します。'
        }

      default:
        return {
          shouldReconnect: this.reconnectAttempts < this.maxReconnectAttempts,
          delay: this.calculateReconnectDelay(),
          userMessage: 'リアルタイム機能でエラーが発生しました。再接続を試行しています...'
        }
    }
  }

  private calculateReconnectDelay(): number {
    // 指数バックオフ + ジッター
    const baseDelay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    const jitter = Math.random() * 1000
    return Math.min(baseDelay + jitter, 30000) // 最大30秒
  }

  async createResilientSubscription(
    supabase: any,
    channelName: string,
    config: any,
    onData: (payload: any) => void,
    onError?: (error: any) => void
  ) {
    const createSubscription = () => {
      const channel = supabase
        .channel(channelName, config)
        .on('postgres_changes', config.listenConfig, onData)
        .on('error', (error: any) => {
          console.error(`Realtime error on channel ${channelName}:`, error)
          
          const errorInfo = this.handleRealtimeError(error, channelName)
          
          if (onError) {
            onError({ ...error, ...errorInfo })
          }
          
          if (errorInfo.shouldReconnect) {
            this.scheduleReconnection(channelName, createSubscription, errorInfo.delay)
          }
        })
        .subscribe((status: string) => {
          console.log(`Channel ${channelName} status:`, status)
          
          if (status === 'SUBSCRIBED') {
            this.reconnectAttempts = 0 // リセット
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.reconnectAttempts++
            const errorInfo = this.handleRealtimeError(
              { type: status }, 
              channelName
            )
            
            if (errorInfo.shouldReconnect) {
              this.scheduleReconnection(channelName, createSubscription, errorInfo.delay)
            }
          }
        })

      this.subscriptions.set(channelName, channel)
      return channel
    }

    return createSubscription()
  }

  private scheduleReconnection(
    channelName: string,
    reconnectFunction: () => any,
    delay: number
  ) {
    console.log(`Scheduling reconnection for ${channelName} in ${delay}ms`)
    
    setTimeout(() => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log(`Attempting to reconnect ${channelName} (attempt ${this.reconnectAttempts + 1})`)
        reconnectFunction()
      } else {
        console.error(`Max reconnection attempts reached for ${channelName}`)
      }
    }, delay)
  }

  // 全サブスクリプションのクリーンアップ
  cleanupSubscriptions() {
    for (const [channelName, channel] of this.subscriptions) {
      try {
        channel.unsubscribe()
        console.log(`Unsubscribed from ${channelName}`)
      } catch (error) {
        console.error(`Error unsubscribing from ${channelName}:`, error)
      }
    }
    this.subscriptions.clear()
    this.reconnectAttempts = 0
  }
}

// 使用例
export function useResilientRealtime(supabase: any, tableName: string) {
  const realtimeHandler = new RealtimeErrorHandler()
  
  const subscribeToTable = (onData: (payload: any) => void) => {
    return realtimeHandler.createResilientSubscription(
      supabase,
      `table_${tableName}`,
      {
        listenConfig: {
          event: '*',
          schema: 'public',
          table: tableName
        }
      },
      onData,
      (error) => {
        // ユーザーにエラー状況を通知
        console.warn('Realtime error:', error.userMessage)
      }
    )
  }

  return {
    subscribeToTable,
    cleanup: () => realtimeHandler.cleanupSubscriptions()
  }
}
```

---

## ネットワーク・接続エラー

### ネットワークエラーハンドラー

```typescript
export class NetworkErrorHandler {
  private static isOnline: boolean = navigator.onLine
  private static onlineListeners: Array<() => void> = []
  private static offlineListeners: Array<() => void> = []

  static {
    // ネットワーク状態監視
    window.addEventListener('online', () => {
      this.isOnline = true
      this.onlineListeners.forEach(listener => listener())
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.offlineListeners.forEach(listener => listener())
    })
  }

  static handleNetworkError(error: any): {
    isNetworkError: boolean
    canRetry: boolean
    shouldWaitForOnline: boolean
    userMessage: string
    retryDelay: number
  } {
    // ネットワークエラーの種類を判定
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        isNetworkError: true,
        canRetry: true,
        shouldWaitForOnline: !this.isOnline,
        userMessage: this.isOnline 
          ? 'サーバーとの通信に失敗しました。しばらく待ってから再試行してください。'
          : 'インターネット接続が切断されています。接続を確認してください。',
        retryDelay: this.isOnline ? 2000 : 0
      }
    }

    if (error.name === 'AbortError') {
      return {
        isNetworkError: true,
        canRetry: true,
        shouldWaitForOnline: false,
        userMessage: 'リクエストがタイムアウトしました。再試行してください。',
        retryDelay: 1000
      }
    }

    if (error.status) {
      const statusErrorMap: Record<number, any> = {
        408: { // Request Timeout
          canRetry: true,
          shouldWaitForOnline: false,
          userMessage: 'リクエストがタイムアウトしました。再試行してください。',
          retryDelay: 2000
        },
        429: { // Too Many Requests
          canRetry: true,
          shouldWaitForOnline: false,
          userMessage: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
          retryDelay: 10000
        },
        500: { // Internal Server Error
          canRetry: true,
          shouldWaitForOnline: false,
          userMessage: 'サーバーエラーが発生しました。しばらく待ってから再試行してください。',
          retryDelay: 5000
        },
        502: { // Bad Gateway
          canRetry: true,
          shouldWaitForOnline: false,
          userMessage: 'サーバーが一時的に利用できません。しばらく待ってから再試行してください。',
          retryDelay: 3000
        },
        503: { // Service Unavailable
          canRetry: true,
          shouldWaitForOnline: false,
          userMessage: 'サービスが一時的に利用できません。しばらく待ってから再試行してください。',
          retryDelay: 5000
        }
      }

      const statusInfo = statusErrorMap[error.status]
      if (statusInfo) {
        return {
          isNetworkError: true,
          ...statusInfo
        }
      }
    }

    return {
      isNetworkError: false,
      canRetry: false,
      shouldWaitForOnline: false,
      userMessage: '不明なエラーが発生しました。',
      retryDelay: 0
    }
  }

  // 自動リトライ機能付きFetch
  static async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<Response> {
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // オンライン状態になるまで待機
        if (!this.isOnline) {
          await this.waitForOnline()
        }

        // タイムアウト設定
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10秒

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })

        clearTimeout(timeout)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return response

      } catch (error) {
        lastError = error
        const errorInfo = this.handleNetworkError(error)

        if (!errorInfo.canRetry || attempt === maxRetries) {
          throw error
        }

        if (errorInfo.shouldWaitForOnline) {
          await this.waitForOnline()
        } else {
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        console.log(`Network request attempt ${attempt} failed, retrying...`)
      }
    }

    throw lastError
  }

  private static waitForOnline(): Promise<void> {
    if (this.isOnline) {
      return Promise.resolve()
    }

    return new Promise(resolve => {
      const onlineHandler = () => {
        resolve()
        window.removeEventListener('online', onlineHandler)
      }
      window.addEventListener('online', onlineHandler)
    })
  }

  static onOnline(callback: () => void): () => void {
    this.onlineListeners.push(callback)
    return () => {
      const index = this.onlineListeners.indexOf(callback)
      if (index > -1) {
        this.onlineListeners.splice(index, 1)
      }
    }
  }

  static onOffline(callback: () => void): () => void {
    this.offlineListeners.push(callback)
    return () => {
      const index = this.offlineListeners.indexOf(callback)
      if (index > -1) {
        this.offlineListeners.splice(index, 1)
      }
    }
  }
}
```

---

## エラー監視・ログ

本番運用では、エラーを「発生させない」だけでなく「検知して復旧できる」状態にすることが重要です。
このセクションでは、最低限押さえるべき監視・ログ設計の観点を整理します。

### 収集すべきログ（最低限）

- **アプリケーションログ**: 例外スタック、入力パラメータ（個人情報はマスキング）、相関ID
- **Supabaseログ**: Authイベント、RLS拒否、Edge Functions実行ログ（該当する構成の場合）
- **DB観測**: 失敗クエリ、遅延クエリ、接続数、ロック待ち

### アラート設計（例）

- 5xx系エラー率の急増
- 認証失敗率の急増（ブルートフォース等の兆候）
- DB接続枯渇、タイムアウト増加、遅延クエリ増加

---

## ユーザーフレンドリーエラー表示

### エラー表示コンポーネント

```tsx
import React, { useState, useEffect } from 'react'
import { AppError, ErrorSeverity } from './ErrorHandler'

interface ErrorDisplayProps {
  error: AppError
  onRetry?: () => void
  onDismiss?: () => void
  showDetails?: boolean
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = false
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  const getSeverityStyles = (severity: ErrorSeverity) => {
    const baseStyles = "p-4 rounded-lg border-l-4 mb-4"
    
    switch (severity) {
      case ErrorSeverity.LOW:
        return `${baseStyles} bg-blue-50 border-blue-400 text-blue-700`
      case ErrorSeverity.MEDIUM:
        return `${baseStyles} bg-yellow-50 border-yellow-400 text-yellow-700`
      case ErrorSeverity.HIGH:
        return `${baseStyles} bg-orange-50 border-orange-400 text-orange-700`
      case ErrorSeverity.CRITICAL:
        return `${baseStyles} bg-red-50 border-red-400 text-red-700`
      default:
        return `${baseStyles} bg-gray-50 border-gray-400 text-gray-700`
    }
  }

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return ""
      case ErrorSeverity.MEDIUM:
        return "[WARN]"
      case ErrorSeverity.HIGH:
        return "[NG]"
      case ErrorSeverity.CRITICAL:
        return "[CRITICAL]"
      default:
        return ""
    }
  }

  return (
    <div className={getSeverityStyles(error.severity)}>
      <div className="flex items-start">
        <span className="text-2xl mr-3">{getSeverityIcon(error.severity)}</span>
        <div className="flex-1">
          <h3 className="font-medium mb-2">
            {error.userMessage}
          </h3>
          
          {error.recoverable && onRetry && (
            <button
              onClick={onRetry}
              className={`
                inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md
                text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2
                focus:ring-blue-500 mr-2
              `}
            >
              再試行
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`
                inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md
                text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2
                focus:ring-blue-500 mr-2
              `}
            >
              閉じる
            </button>
          )}
          
          {showDetails && (
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              {showTechnicalDetails ? '詳細を隠す' : '詳細を表示'}
            </button>
          )}
          
          {showTechnicalDetails && (
            <div className="mt-3 p-3 bg-gray-100 rounded text-sm font-mono">
              <div><strong>エラーID:</strong> {error.id}</div>
              <div><strong>カテゴリ:</strong> {error.category}</div>
              <div><strong>コード:</strong> {error.code}</div>
              <div><strong>時刻:</strong> {error.timestamp.toLocaleString()}</div>
              {error.context && (
                <div><strong>コンテキスト:</strong> {JSON.stringify(error.context, null, 2)}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// エラートースト通知
export const useErrorToast = () => {
  const [errors, setErrors] = useState<AppError[]>([])

  const showError = (error: AppError) => {
    setErrors(prev => [...prev, error])
    
    // 自動削除（重要度に応じて表示時間を調整）
    const autoRemoveDelay = error.severity === ErrorSeverity.CRITICAL ? 10000 : 5000
    setTimeout(() => {
      removeError(error.id)
    }, autoRemoveDelay)
  }

  const removeError = (errorId: string) => {
    setErrors(prev => prev.filter(error => error.id !== errorId))
  }

  const ErrorToastContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {errors.map(error => (
        <ErrorDisplay
          key={error.id}
          error={error}
          onDismiss={() => removeError(error.id)}
        />
      ))}
    </div>
  )

  return {
    showError,
    removeError,
    ErrorToastContainer
  }
}
```

このエラーハンドリングガイドにより、Supabaseアプリケーションで発生する様々なエラーを適切に処理し、ユーザーに分かりやすいメッセージを提供できるようになります。
