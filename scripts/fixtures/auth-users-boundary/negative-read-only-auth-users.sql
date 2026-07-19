-- ONLY を付けても unmarked な managed schema の直接 read は拒否する。
SELECT id, email
FROM ONLY auth.users
WHERE id = '00000000-0000-0000-0000-000000000000';
