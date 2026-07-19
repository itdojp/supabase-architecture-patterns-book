// template literal でも schema を分けた managed auth schema は参照しない。
await supabase
  .schema(`auth`)
  .from(`users`)
  .select('email')
