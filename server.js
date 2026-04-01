/**
 * ErrorLens — Auth Server (server.js)
 * =====================================
 * A minimal Node.js + Express backend for handling OAuth.
 *
 * SETUP INSTRUCTIONS:
 * 1. Install dependencies:
 *      npm install express axios cors dotenv cookie-parser
 *
 * 2. Create a .env file (see .env.example in this folder)
 *
 * 3. Run the server:
 *      node server.js
 *      — or with auto-reload —
 *      npx nodemon server.js
 *
 * 4. In login.js, set USE_REAL_AUTH: true
 *
 * The server listens on http://localhost:3000
 */

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const axios        = require('axios');
const path         = require('path');

const app = express();

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────



// ─────────────────────────────────────────────
// ENV Variables (set these in your .env file)
// ─────────────────────────────────────────────

const {
  // GitHub
  GITHUB_CLIENT_ID,       // From GitHub Developer Settings
  GITHUB_CLIENT_SECRET,   // From GitHub Developer Settings

  // AWS Cognito
  AWS_COGNITO_DOMAIN,     // e.g. myapp.auth.us-east-1.amazoncognito.com
  AWS_COGNITO_CLIENT_ID,
  AWS_COGNITO_CLIENT_SECRET,
  AWS_REDIRECT_URI,       // Must match Cognito App Client settings

  // App
  JWT_SECRET   = 'change_this_in_production', // Used to sign session tokens
  PORT         = 3000,
  FRONTEND_URL = 'http://localhost:3000',
} = process.env;

// ─────────────────────────────────────────────
// GITHUB OAUTH ROUTES
// ─────────────────────────────────────────────

/**
 * GET /auth/github
 * Redirects user to GitHub's authorization page.
 * (Optional: you can also build this URL on the frontend — see login.js)
 */
app.get('/auth/github', (req, res) => {
  const params = new URLSearchParams({
    client_id:    GITHUB_CLIENT_ID,
    redirect_uri: `${FRONTEND_URL}/auth/github/callback`,
    scope:        'user:email read:user',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

/**
 * GET /auth/github/callback
 * GitHub redirects here after user approves.
 * We exchange the `code` for an access token, fetch user info, and set a session.
 */
app.get('/auth/github/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/login.html?error=missing_code');
  }

  try {
    // Step 1: Exchange code for access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri:  `${FRONTEND_URL}/auth/github/callback`,
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token } = tokenRes.data;

    if (!access_token) {
      throw new Error('No access token received from GitHub');
    }

    // Step 2: Fetch user profile from GitHub
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = userRes.data;

    // Step 3: Optionally fetch user email (if not public on profile)
    let email = user.email;
    if (!email) {
      const emailsRes = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const primary = emailsRes.data.find(e => e.primary && e.verified);
      email = primary ? primary.email : null;
    }

    // Step 4: Create a simple session token
    // In production: use JWT (jsonwebtoken) or a proper session store (Redis, DB)
    const sessionToken = Buffer.from(JSON.stringify({
      id:       user.id,
      name:     user.name || user.login,
      email,
      avatar:   user.avatar_url,
      provider: 'github',
      iat:      Date.now(),
    })).toString('base64');

    // Step 5: Set session cookie (httpOnly = JS can't read it = more secure)
    res.cookie('el_session', sessionToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production', // HTTPS only in prod
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    });

    // Step 6: Redirect to dashboard
    res.redirect('/dashboard.html');

  } catch (err) {
    console.error('GitHub OAuth error:', err.message);
    res.redirect('/login.html?error=github_auth_failed');
  }
});

// ─────────────────────────────────────────────
// AWS COGNITO OAUTH ROUTES
// ─────────────────────────────────────────────

/**
 * GET /auth/aws
 * Redirects to the AWS Cognito Hosted UI login page.
 */
app.get('/auth/aws', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     AWS_COGNITO_CLIENT_ID,
    redirect_uri:  AWS_REDIRECT_URI || `${FRONTEND_URL}/auth/aws/callback`,
    scope:         'email openid profile',
  });

  res.redirect(`https://${AWS_COGNITO_DOMAIN}/oauth2/authorize?${params}`);
});

/**
 * GET /auth/aws/callback
 * AWS Cognito redirects here after authentication.
 * We exchange the code for tokens, then set a session.
 */
app.get('/auth/aws/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/login.html?error=missing_code');
  }

  try {
    const redirectUri = AWS_REDIRECT_URI || `${FRONTEND_URL}/auth/aws/callback`;

    // Step 1: Exchange code for tokens from Cognito Token Endpoint
    const tokenRes = await axios.post(
      `https://${AWS_COGNITO_DOMAIN}/oauth2/token`,
      new URLSearchParams({
        grant_type:   'authorization_code',
        client_id:    AWS_COGNITO_CLIENT_ID,
        redirect_uri: redirectUri,
        code,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // If your App Client has a secret:
          Authorization: 'Basic ' + Buffer.from(
            `${AWS_COGNITO_CLIENT_ID}:${AWS_COGNITO_CLIENT_SECRET}`
          ).toString('base64'),
        },
      }
    );

    const { id_token, access_token } = tokenRes.data;

    // Step 2: Decode the id_token (JWT) to get user info
    // In production: verify the JWT signature using AWS public keys!
    const payload = JSON.parse(
      Buffer.from(id_token.split('.')[1], 'base64').toString('utf8')
    );

    // Step 3: Create session token
    const sessionToken = Buffer.from(JSON.stringify({
      id:       payload.sub,
      name:     payload.name || payload['cognito:username'],
      email:    payload.email,
      provider: 'aws',
      iat:      Date.now(),
    })).toString('base64');

    // Step 4: Set cookie
    res.cookie('el_session', sessionToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.redirect('/dashboard.html');

  } catch (err) {
    console.error('AWS Cognito OAuth error:', err.response?.data || err.message);
    res.redirect('/login.html?error=aws_auth_failed');
  }
});

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────

/**
 * POST /auth/callback
 * Used when the frontend handles the OAuth redirect (not the server).
 * The frontend sends the `code` here, and we exchange it.
 */
app.post('/auth/callback', async (req, res) => {
  const { code, provider } = req.body;

  if (!code || !provider) {
    return res.status(400).json({ success: false, message: 'Missing code or provider' });
  }

  // Route to the appropriate handler
  // This is a simplified wrapper — the GET routes above do the full job.
  // For SPA flows, expand this with the full token exchange logic above.
  res.json({ success: false, message: 'Use the GET callback routes for OAuth code exchange.' });
});

/**
 * GET /auth/me
 * Returns the current logged-in user's info from the session cookie.
 */
app.get('/auth/me', (req, res) => {
  const sessionToken = req.cookies.el_session;

  if (!sessionToken) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    const user = JSON.parse(Buffer.from(sessionToken, 'base64').toString('utf8'));
    res.json({ authenticated: true, user });
  } catch {
    res.status(401).json({ authenticated: false });
  }
});

/**
 * POST /auth/logout
 * Clears the session cookie.
 */
app.post('/auth/logout', (req, res) => {
  res.clearCookie('el_session');
  res.json({ success: true });
});

// ─────────────────────────────────────────────
// Error handler
// ─────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅ ErrorLens Auth Server running on http://localhost:${PORT}`);
  console.log(`   Login page → http://localhost:${PORT}/login.html`);
  console.log(`   GitHub CB  → http://localhost:${PORT}/auth/github/callback`);
  console.log(`   AWS CB     → http://localhost:${PORT}/auth/aws/callback\n`);
});
