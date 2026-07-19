// template literal でも managed auth schema は Data API から参照しない。
await supabase.from(`auth.users`).select('email')
