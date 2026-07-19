-- 明示的な管理者診断マーカーのない直接 read は拒否する。
SELECT id, email
FROM auth.users
WHERE id = '00000000-0000-0000-0000-000000000000';
