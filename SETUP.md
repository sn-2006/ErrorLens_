# ErrorLens — Login System Setup Guide

## 📁 File Structure

```
your-project/
├── login.html        ← Login page UI
├── login.css         ← Styles (matches landing page)
├── login.js          ← Auth logic (simulation + real OAuth hooks)
├── dashboard.html    ← Redirect target after login
├── server.js         ← Node.js backend (optional, for real OAuth)
├── .env.example      ← Copy this to .env and fill in values
└── index.html        ← Your existing landing page
```

---

## ⚡ Quick Start — Simulated Login (No Backend Needed)

Works immediately. Just open `login.html` in your browser or serve with:

```bash
npx serve .
# → http://localhost:3000/login.html
```

Clicking either button shows a loading state and redirects to `dashboard.html`.

---

## 🔐 Real Auth Setup (Optional)

### Step 1 — Install backend dependencies

```bash
npm init -y
npm install express axios cors dotenv cookie-parser
```

### Step 2 — Set up environment variables

```bash
cp .env.example .env
# Edit .env with your real credentials
```

### Step 3 — Configure GitHub OAuth

1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Set these values:
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/github/callback`
4. Copy **Client ID** and **Client Secret** into `.env`

### Step 4 — Configure AWS Cognito

1. Open **AWS Console → Cognito → User Pools**
2. Create a User Pool (or use existing)
3. Go to **App Integration → App client**
4. Under **Hosted UI**, set:
   - **Callback URL**: `http://localhost:3000/auth/aws/callback`
   - **Allowed OAuth flows**: Authorization code grant
   - **Scopes**: email, openid, profile
5. Under **Domain**, create a Cognito domain
6. Copy the domain, Client ID, and Client Secret into `.env`

### Step 5 — Enable real auth in login.js

Open `login.js` and change line 19:

```js
// Before:
USE_REAL_AUTH: false,

// After:
USE_REAL_AUTH: true,
```

Also update the redirect URIs in CONFIG to match your setup.

### Step 6 — Start the server

```bash
node server.js
# ✅ ErrorLens Auth Server running on http://localhost:3000
```

---

## 🌐 Production Deployment

When deploying to production:

1. Change `NODE_ENV=production` in your environment
2. Use HTTPS — update all callback URLs to `https://`
3. Replace the base64 session encoding in `server.js` with proper JWT (`jsonwebtoken` package)
4. Use a proper session store (Redis, database) instead of cookies alone
5. Verify Cognito JWT signatures using AWS public keys

---

## 🎨 Design Notes

The login page uses the same design tokens as the landing page:

| Token          | Value     |
|----------------|-----------|
| Background     | `#0F172A` |
| Card           | `#1E293B` |
| Primary        | `#4F46E5` |
| Text           | `#F8FAFC` |
| Subtext        | `#94A3B8` |
| Border radius  | `12px`    |
| Font           | Inter + Poppins |

---

## ❓ Common Issues

**"Redirect URI mismatch"** — The callback URL in your OAuth app settings must exactly match what's in `.env` and `login.js`.

**GitHub returns no email** — The server automatically fetches emails from `/user/emails` as a fallback.

**Cognito "invalid_grant"** — Codes expire quickly. Make sure your system clock is accurate and the redirect URI matches exactly.
