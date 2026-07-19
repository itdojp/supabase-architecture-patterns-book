// この通常実装例は拒否されなければならない。
await supabase.from('auth.users').select('email')
