await supabase.auth.updateUser({ data: { display_name: 'reader preference' } })
const displayName = user.user_metadata?.display_name
