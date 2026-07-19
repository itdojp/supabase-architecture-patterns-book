-- この通常実装例は拒否されなければならない。
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000000';
