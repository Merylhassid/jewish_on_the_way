import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller()
export class ResetPasswordPageController {
  @Get('reset-password')
  serveResetPage(@Query('token') token: string = '', @Res() res: Response) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Password – Jewish On The Way</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f4ff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 20px;
      padding: 40px 36px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 8px 32px rgba(26, 58, 107, 0.10);
    }
    .logo { font-size: 32px; text-align: center; margin-bottom: 8px; }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #1a3a6b;
      text-align: center;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 14px;
      color: #888;
      text-align: center;
      margin-bottom: 28px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #1a3a6b;
      margin-bottom: 6px;
      margin-top: 16px;
    }
    input {
      width: 100%;
      padding: 13px 16px;
      border: 1.5px solid #dde3f0;
      border-radius: 12px;
      font-size: 15px;
      color: #1a1a2e;
      background: #f8faff;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: #1a3a6b; background: #fff; }
    .btn {
      width: 100%;
      padding: 14px;
      background: #1a3a6b;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 24px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .msg {
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 14px;
      font-weight: 500;
      margin-top: 18px;
      display: none;
    }
    .msg.error   { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
    .msg.success { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .success-view { display: none; text-align: center; padding: 12px 0; }
    .success-icon { font-size: 52px; margin-bottom: 12px; }
    .success-title { font-size: 20px; font-weight: 700; color: #1a3a6b; margin-bottom: 8px; }
    .success-sub { font-size: 14px; color: #888; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">✡️</div>
    <h1>Jewish On The Way</h1>
    <p class="subtitle">Set a new password for your account</p>

    <div id="form-view">
      <label for="password">New Password</label>
      <input type="password" id="password" placeholder="At least 6 characters" autocomplete="new-password" />

      <label for="confirm">Confirm Password</label>
      <input type="password" id="confirm" placeholder="Repeat new password" autocomplete="new-password" />

      <button class="btn" id="submit-btn" onclick="submitReset()">Reset Password</button>

      <div class="msg error"   id="error-msg"></div>
      <div class="msg success" id="success-inline"></div>
    </div>

    <div class="success-view" id="success-view">
      <div class="success-icon">✓</div>
      <div class="success-title">Password Reset!</div>
      <div class="success-sub">Your password has been changed successfully.<br/>You can now log in with your new password.</div>
    </div>
  </div>

  <script>
    const TOKEN = ${JSON.stringify(token)};

    function showError(msg) {
      const el = document.getElementById('error-msg');
      el.textContent = msg;
      el.style.display = 'block';
      document.getElementById('success-inline').style.display = 'none';
    }

    function hideMessages() {
      document.getElementById('error-msg').style.display = 'none';
      document.getElementById('success-inline').style.display = 'none';
    }

    async function submitReset() {
      hideMessages();
      const password = document.getElementById('password').value;
      const confirm  = document.getElementById('confirm').value;

      if (!TOKEN) {
        showError('Reset token is missing. Please use the link from your email.');
        return;
      }
      if (password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirm) {
        showError('Passwords do not match.');
        return;
      }

      const btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.textContent = 'Resetting…';

      try {
        const res = await fetch('/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TOKEN, newPassword: password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg = Array.isArray(data.message)
            ? data.message.join(', ')
            : (data.message ?? 'Invalid or expired token. Please request a new reset link.');
          showError(msg);
          btn.disabled = false;
          btn.textContent = 'Reset Password';
          return;
        }

        document.getElementById('form-view').style.display = 'none';
        document.getElementById('success-view').style.display = 'block';
      } catch {
        showError('Network error. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Reset Password';
      }
    }

    // Allow Enter key to submit
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitReset();
    });
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
