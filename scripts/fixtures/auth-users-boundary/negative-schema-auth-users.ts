// schema を分けても managed auth schema は Data API から参照しない。
await supabase
  .schema('auth')
  .from('users')
  .select('email')
