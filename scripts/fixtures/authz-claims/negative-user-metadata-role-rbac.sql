create policy "unsafe user metadata role"
on public.documents
for select using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
