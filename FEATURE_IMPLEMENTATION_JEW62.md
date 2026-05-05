# Password Reset Feature Implementation (JEW-62)

## Overview
Secure password reset functionality has been implemented allowing users to request password reset links via email and reset their passwords with a time-limited, single-use token.

---

## Files Changed

### Backend

#### 1. **Auth Service** - [src/auth/auth.service.ts](src/auth/auth.service.ts)
**Changes:**
- Enhanced `forgotPassword()` method:
  - Accepts ForgotPasswordDto with email validation
  - Generates cryptographically secure random token (32 bytes)
  - **Hashes token with SHA-256 before storage** (not plain text)
  - Sets 1-hour expiration
  - Logs audit event `PASSWORD_RESET_REQUESTED`
  - Sends email via MailService with raw token
  - In development mode, logs token to console for testing

- Enhanced `resetPassword()` method:
  - Accepts ResetPasswordDto with token and new password
  - Hashes provided token with SHA-256 to match stored hash
  - Validates token exists and hasn't expired
  - Hashes new password with bcrypt (10 rounds)
  - Clears token after use (prevents reuse)
  - Clears expiration timestamp
  - Logs audit event `PASSWORD_RESET_DONE`

**Key Security Features:**
- ✅ Token is never stored in plain text (SHA-256 hashed)
- ✅ Token is single-use (cleared after password reset)
- ✅ Token expires after 1 hour
- ✅ Password hashed with bcrypt (10 rounds)
- ✅ API response never reveals whether email exists
- ✅ Audit logging for security tracking

#### 2. **Auth Controller** - [src/auth/auth.controller.ts](src/auth/auth.controller.ts)
**Status:** Already exists - no changes needed
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token
- Both endpoints have throttling (5 attempts / 60 seconds)

#### 3. **Auth DTOs** - [src/auth/dto/](src/auth/dto/)

**ForgotPasswordDto** - [src/auth/dto/forgot-password.dto.ts](src/auth/dto/forgot-password.dto.ts)
- Status: Already exists - no changes needed
- Validates email format

**ResetPasswordDto** - [src/auth/dto/reset-password.dto.ts](src/auth/dto/reset-password.dto.ts)
- Status: Already exists - no changes needed
- Validates token is a string
- Validates newPassword is minimum 6 characters

#### 4. **User Entity** - [src/users/user.entity.ts](src/users/user.entity.ts)
**Status:** Already defined fields (no changes needed)
- `resetPasswordToken`: varchar, nullable
- `resetPasswordExpires`: timestamptz, nullable

#### 5. **Mail Service** - [src/mail/mail.service.ts](src/mail/mail.service.ts)
**Status:** Already implemented with `sendPasswordReset()` method
- Accepts email and raw token
- Constructs deep link for mobile app: `jewishontheway://reset-password?token=${token}`
- Provides two methods for users:
  1. Direct app deep link (pre-fills token)
  2. Manual token copy-paste option
- Token validity: 1 hour

#### 6. **Migration** - [src/migrations/1776190000000-AddPasswordResetFields.ts](src/migrations/1776190000000-AddPasswordResetFields.ts)
**NEW FILE - Status:** Created
- Adds `reset_password_token` column (VARCHAR, nullable)
- Adds `reset_password_expires` column (TIMESTAMP WITH TIME ZONE, nullable)
- Safe for databases that already have these columns (uses `IF NOT EXISTS`)
- Reversible migration

#### 7. **Environment Configuration** - [.env.example](.env.example)
**NEW FILE - Status:** Created
- Documents all required environment variables with comments
- Includes new password reset related variables:
  - `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`
  - `MAIL_USER`, `MAIL_PASS`
  - `APP_URL` (for reset links)

---

## Endpoints

### 1. Request Password Reset
```
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "If this email exists, a reset link has been sent."
}
```

**Notes:**
- Always returns same response whether email exists or not (security)
- Email is sent asynchronously
- In dev mode, token is logged to console
- Throttled to 5 attempts per 60 seconds

### 2. Reset Password
```
POST /auth/reset-password
Content-Type: application/json

{
  "token": "abc123def456...",
  "newPassword": "NewPassword123"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset successfully."
}
```

**Error Response (400 Bad Request):**
```json
{
  "message": "Invalid or expired reset token"
}
```

**Notes:**
- Token must be valid (not expired, not already used)
- New password must be minimum 6 characters
- Token is cleared after successful reset
- Throttled to 5 attempts per 60 seconds

---

## Environment Variables Required

```env
# Email (SMTP) - for password reset emails
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password

# Frontend URL - used in password reset links sent via email
APP_URL=http://localhost:3000

# Node environment (for dev token logging)
NODE_ENV=development
```

### Gmail Setup (for development/production):
1. Enable 2-Step Verification on Gmail account
2. Generate an [App Password](https://support.google.com/accounts/answer/185833)
3. Use the App Password in `MAIL_PASS` (not your regular Gmail password)

---

## Security Implementation Details

### Token Generation & Storage
1. **Generation:** `crypto.randomBytes(32).toString('hex')` = 64-character hex string (256 bits of entropy)
2. **Storage:** SHA-256 hash of token (one-way, deterministic)
3. **Why SHA-256 not bcrypt:** Enables fast database lookup while maintaining security since token is already random and high-entropy
4. **Token never returned in API responses**

### Token Lifecycle
1. **Created:** `crypto.randomBytes(32)`
2. **Hashed:** `crypto.createHash('sha256').update(token).digest('hex')`
3. **Stored:** Hash + expiration timestamp in database
4. **Email Sent:** Raw token sent to user (hashed version only in DB)
5. **Used:** User provides token to `POST /auth/reset-password`
6. **Verified:** Raw token hashed again and compared to stored hash
7. **Cleared:** Both token hash and expiration set to NULL after use
8. **Expired:** Token expires after 1 hour; checked before acceptance

### Password Security
- New password hashed with bcrypt (10 rounds, same as register/change-password)
- Consistent with existing password handling

### Email Privacy
- `forgotPassword()` never reveals if email exists in system
- Same response for existing and non-existing emails
- Prevents account enumeration attacks

---

## Testing Locally

### Prerequisites
```bash
cd backend
npm install
npm run migration:run  # Run new migration
```

### Test Flow 1: Request Reset Token (Dev Mode)

1. **Start backend in dev mode:**
```bash
npm run start:dev
```

2. **Request password reset:**
```bash
curl -X POST http://localhost:3001/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

3. **Check console output** - Token will be printed:
```
========================================
  PASSWORD RESET TOKEN (dev only)
  Email : test@example.com
  Token : abc123def456...
  Paste this token in the app's Reset Password screen
========================================
```

### Test Flow 2: Reset Password with Token

1. **Copy the token** from console output above

2. **Reset password with token:**
```bash
curl -X POST http://localhost:3001/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"abc123def456...","newPassword":"NewPassword123"}'
```

3. **Verify response:**
```json
{
  "message": "Password reset successfully."
}
```

### Test Flow 3: Invalid Token (Should fail)

1. **Try with wrong token:**
```bash
curl -X POST http://localhost:3001/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"wrong_token","newPassword":"NewPassword123"}'
```

2. **Should receive error:**
```json
{
  "message": "Invalid or expired reset token"
}
```

### Test Flow 4: Email Privacy

1. **Request reset for non-existent email:**
```bash
curl -X POST http://localhost:3001/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com"}'
```

2. **Response is identical to existing email:**
```json
{
  "message": "If this email exists, a reset link has been sent."
}
```

### Test Flow 5: Expired Token

1. **Request reset token**

2. **Wait 1 hour** (or modify test to reduce token expiry)

3. **Try to use expired token:**
```bash
curl -X POST http://localhost:3001/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"expired_token","newPassword":"NewPassword123"}'
```

4. **Should receive error:**
```json
{
  "message": "Invalid or expired reset token"
}
```

### Test Flow 6: Token Reuse Prevention

1. **Request reset token** - Copy token

2. **Reset password once** - Token is cleared

3. **Try to reuse same token:**
```bash
curl -X POST http://localhost:3001/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"same_token","newPassword":"AnotherPassword123"}'
```

4. **Should receive error:**
```json
{
  "message": "Invalid or expired reset token"
}
```

### Test with Mobile App

1. **From reset-password email**, click the deep link:
```
jewishontheway://reset-password?token=abc123def456...
```

2. **App should:**
   - Open automatically
   - Pre-fill token field
   - Prompt user for new password
   - Submit reset request

---

## Database State After Implementation

### Users Table Changes
```sql
-- New columns added via migration:
ALTER TABLE "users" ADD COLUMN "reset_password_token" VARCHAR;
ALTER TABLE "users" ADD COLUMN "reset_password_expires" TIMESTAMP WITH TIME ZONE;

-- Example user state after password reset request:
id | email | password_hash | reset_password_token | reset_password_expires
1  | test@example.com | $2b$10$... | 4a7f2c9e... | 2024-05-05 15:30:00+00

-- After password is reset:
id | email | password_hash | reset_password_token | reset_password_expires
1  | test@example.com | $2b$10$... | NULL | NULL
```

---

## Audit Logging

The implementation logs two events:

1. **PASSWORD_RESET_REQUESTED**
   - Logged when user requests password reset
   - Includes user ID and email
   - Only logged if user exists (privacy-preserving)

2. **PASSWORD_RESET_DONE**
   - Logged when password is successfully reset
   - Includes user ID
   - Useful for security monitoring

Check audit logs via:
```bash
SELECT * FROM audit_logs WHERE action LIKE 'PASSWORD_RESET%' ORDER BY created_at DESC;
```

---

## Existing Features Preserved

✅ **User Registration** - Unchanged, works as before
✅ **User Login** - Unchanged, works as before  
✅ **Change Password (Authenticated Users)** - Unchanged at `PUT /users/me/password`
✅ **JWT Authentication** - Unchanged, works as before
✅ **Audit Logging** - Extended with new events
✅ **Email Service** - Already had `sendPasswordReset()`, now properly integrated
✅ **Rate Limiting** - Applied to both endpoints (5 requests/60 seconds)

---

## Notes for Production Deployment

1. **Email Configuration:**
   - Update `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` for production SMTP
   - Or use a service like SendGrid, AWS SES, Mailgun

2. **Token Expiry:**
   - Current: 1 hour
   - Adjust if needed in `auth.service.ts` line: `const expires = new Date(Date.now() + 60 * 60 * 1000)`

3. **APP_URL:**
   - Set to production frontend URL for correct deep links in emails

4. **NODE_ENV:**
   - Must be `production` to disable console token logging

5. **Database:**
   - Run migration before deployment: `npm run migration:run`

6. **SSL:**
   - Use `MAIL_SECURE=true` for TLS connections (port 465)
   - Use `MAIL_SECURE=false` for STARTTLS connections (port 587)

---

## Troubleshooting

### "Invalid or expired reset token"
- **Cause 1:** Token expired (> 1 hour old)
- **Cause 2:** Token already used
- **Cause 3:** Wrong token provided
- **Solution:** Request a new reset token

### Email not received
- **Cause 1:** Email configuration wrong (check `.env`)
- **Cause 2:** Gmail App Password incorrect
- **Cause 3:** SMTP credentials need 2FA setup
- **Solution:** Check server logs and verify SMTP settings

### Token visible in production emails
- **This is NOT a security issue** - the token is sent via email (already exposed in email)
- The value stored in database is hashed (secure)
- Token is cryptographically random (high entropy)
- Token expires and is single-use

### Errors running migration
```bash
# Check migration status
npm run migration:run

# Verify columns were added
psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name LIKE 'reset%';"
```

---

## Summary of Requirements Met

✅ **User requests password reset by email** - POST /auth/forgot-password  
✅ **System sends secure reset link** - Hashed token via email  
✅ **Response doesn't reveal email exists** - Same response for all emails  
✅ **Link contains secure temporary token** - 256-bit crypto random  
✅ **Token expires** - 1 hour expiration  
✅ **Token not stored in plain text** - SHA-256 hashed  
✅ **User can submit token + new password** - POST /auth/reset-password  
✅ **Password updated securely** - Bcrypt hashed (10 rounds)  
✅ **Used/expired token cannot be reused** - Token cleared after use  
✅ **Existing auth/login/JWT behavior preserved** - No breaking changes  
✅ **No hardcoded URLs/secrets** - All from environment variables  
✅ **Token never returned in API response** - Sent via email only  

---

## Files Summary

| File | Type | Status | Notes |
|------|------|--------|-------|
| [src/auth/auth.service.ts](src/auth/auth.service.ts) | Modified | Enhanced | Token hashing with SHA-256 |
| [src/auth/auth.controller.ts](src/auth/auth.controller.ts) | Existing | - | No changes needed |
| [src/auth/dto/forgot-password.dto.ts](src/auth/dto/forgot-password.dto.ts) | Existing | - | No changes needed |
| [src/auth/dto/reset-password.dto.ts](src/auth/dto/reset-password.dto.ts) | Existing | - | No changes needed |
| [src/users/user.entity.ts](src/users/user.entity.ts) | Existing | - | Fields already defined |
| [src/mail/mail.service.ts](src/mail/mail.service.ts) | Existing | - | Already has sendPasswordReset() |
| [src/migrations/1776190000000-AddPasswordResetFields.ts](src/migrations/1776190000000-AddPasswordResetFields.ts) | New | Created | Adds DB columns if missing |
| [.env.example](.env.example) | New | Created | Documents all env vars |

