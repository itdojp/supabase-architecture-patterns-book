-- auth-users-boundary: allow-read-only-diagnostic
-- SQL Editor の限定的な read-only 診断。通常アプリケーションからは実行しない。
SELECT id, email
FROM auth.users
WHERE id = '00000000-0000-0000-0000-000000000000';
