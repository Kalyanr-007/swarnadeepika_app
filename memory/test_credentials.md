# Test Credentials — Swarna Deepika Billing App

## Admin login (cloud/web version)
- URL: /login
- Username: `admin`
- Password: `swarna123`
- Role: admin

## Password recovery (set up for admin, for testing Forgot Password)
- Security question: `Village name?`
- Security answer: `Gangaram` (case-insensitive)
- Note: recovery code is one-time; regenerate via Settings → Password Recovery if needed.

## Offline desktop version (SQLite, only when built as .exe)
- Default admin seeded on first run: `admin` / `swarna123`

Auth endpoints: /api/auth/login, /register, /change-password, /setup-recovery,
/recovery-status, /reset-password
