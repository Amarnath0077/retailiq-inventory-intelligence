import { Router, Request, Response } from 'express';
import { userStore } from './userStore.ts';
import { requireAuth, extractAuthToken } from './authMiddleware.ts';

export const authRouter = Router();

function getAppOrigin(req: Request): string {
  // 1. Explicit client-supplied origin query parameter
  if (typeof req.query.origin === 'string' && req.query.origin.startsWith('http')) {
    try {
      const u = new URL(req.query.origin);
      return `${u.protocol}//${u.host}`;
    } catch {
      // Invalid URL, continue to fallback checks
    }
  }
  // 2. Request Origin header
  if (req.headers.origin && typeof req.headers.origin === 'string' && req.headers.origin.startsWith('http')) {
    return req.headers.origin.replace(/\/+$/, '');
  }
  // 3. Request Referer header
  if (req.headers.referer && typeof req.headers.referer === 'string' && req.headers.referer.startsWith('http')) {
    try {
      const u = new URL(req.headers.referer);
      return `${u.protocol}//${u.host}`;
    } catch {}
  }
  // 4. Vercel production domain
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, '')}`;
  }
  // 5. Vercel deployment host
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }
  // 6. Explicit custom APP_URL
  if (process.env.APP_URL && process.env.APP_URL.trim() && !process.env.APP_URL.includes('MY_APP_URL')) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  // 7. Request proxy headers
  const rawProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  const proto = (host.includes('.vercel.app') || host.includes('.run.app')) ? 'https' : rawProto;
  return `${proto}://${host}`;
}

const DEFAULT_GOOGLE_CLIENT_ID = '966798520485-fokbhckrli0jdnbactkfqds8uq321pe7.apps.googleusercontent.com';

let dynamicGoogleClientSecret: string | null = null;

function getGoogleClientSecret(): string {
  if (dynamicGoogleClientSecret && dynamicGoogleClientSecret.trim()) {
    return dynamicGoogleClientSecret.trim();
  }
  return process.env.GOOGLE_CLIENT_SECRET || '';
}

function getGoogleClientId(): string {
  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_ID.trim() &&
    process.env.GOOGLE_CLIENT_ID !== 'MY_GOOGLE_CLIENT_ID' &&
    process.env.GOOGLE_CLIENT_ID !== '12783657335-pkch56vau5efq23n2o1uaad19gclt2k5.apps.googleusercontent.com'
  ) {
    return process.env.GOOGLE_CLIENT_ID.trim();
  }
  return DEFAULT_GOOGLE_CLIENT_ID;
}

// GET /api/auth/config - Public configuration for OAuth and UI setup
authRouter.get('/config', (req: Request, res: Response) => {
  const origin = getAppOrigin(req);
  const clientId = getGoogleClientId();
  const isConfigured = Boolean(clientId && clientId !== 'MY_GOOGLE_CLIENT_ID');

  res.json({
    googleConfigured: isConfigured,
    clientId: isConfigured ? clientId : null,
    origin,
    callbackUrl: `${origin}/api/auth/google/callback`,
    setupInstructions: !isConfigured ? {
      title: 'Google OAuth Setup for RetailIQ',
      message: 'To enable "Continue with Google", configure a Google Cloud Console OAuth Client ID.',
      steps: [
        '1. Go to Google Cloud Console > APIs & Services > Credentials.',
        '2. Create an "OAuth 2.0 Client ID" with Application type "Web application".',
        `3. Under "Authorized JavaScript origins", add: ${origin}`,
        `4. Under "Authorized redirect URIs", add: ${origin}/api/auth/google/callback`,
        '5. If your app is in "Testing" mode, add your email to "Test users" under OAuth consent screen.',
        '6. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment or Vercel project settings.'
      ]
    } : null
  });
});

// GET /api/auth/me - Get current authenticated user
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.user
  });
});

// POST /api/auth/register - Register with email & password
authRouter.post('/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ success: false, message: 'Please provide your full name (minimum 2 characters).' });
      return;
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
      return;
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Password and confirmation password do not match.' });
      return;
    }

    const { user, token } = userStore.registerUser(name, email, password);

    // Set secure cross-origin compatible cookie
    res.cookie('retailiq_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.status(201).json({
      success: true,
      user,
      token,
      message: 'Account created successfully.'
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to create account.'
    });
  }
});

// POST /api/auth/login - Email & password sign in
authRouter.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const { user, token } = userStore.authenticate(email, password, Boolean(rememberMe));
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    res.cookie('retailiq_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge,
      path: '/'
    });

    res.json({
      success: true,
      user,
      token,
      message: 'Welcome back to RetailIQ.'
    });
  } catch (err: any) {
    res.status(401).json({
      success: false,
      message: err.message || 'Authentication failed. Please check your credentials.'
    });
  }
});

// GET /api/auth/google/url - Initiate Google OAuth Redirect / Popup
authRouter.get('/google/url', (req: Request, res: Response) => {
  const clientId = getGoogleClientId();
  if (!clientId || clientId === 'MY_GOOGLE_CLIENT_ID') {
    res.status(400).json({
      success: false,
      error: 'google_oauth_not_configured',
      message: 'Google OAuth Client ID is not configured in this environment.',
      setupHelp: {
        callbackUrl: `${getAppOrigin(req)}/api/auth/google/callback`,
        origin: getAppOrigin(req)
      }
    });
    return;
  }

  const origin = getAppOrigin(req);
  const redirectUri = encodeURIComponent(`${origin}/api/auth/google/callback`);
  const scope = encodeURIComponent('openid email profile');
  
  // Encode origin inside state parameter to ensure accurate callback redirection
  const statePayload = Buffer.from(JSON.stringify({
    nonce: Math.random().toString(36).substring(2),
    origin: origin
  })).toString('base64url');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${statePayload}&access_type=offline&prompt=select_account`;

  res.json({
    success: true,
    url: authUrl,
    origin,
    redirectUri: `${origin}/api/auth/google/callback`
  });
});

// GET /api/auth/google/callback - Handle Google OAuth redirect code exchange with popup postMessage
const googleCallbackHandler = async (req: Request, res: Response) => {
  const { code, error, error_description, state } = req.query;

  // Determine origin from state parameter if present
  let origin = getAppOrigin(req);
  if (typeof state === 'string') {
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (parsed.origin && typeof parsed.origin === 'string' && parsed.origin.startsWith('http')) {
        origin = parsed.origin.replace(/\/+$/, '');
      }
    } catch {}
  }

  if (error || !code) {
    const errorMsg = String(error_description || error || 'Google sign-in was cancelled or denied.');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>RetailIQ Authentication</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background: #0c0c0e; color: #ececec; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #18181b; border: 1px solid rgba(236,236,236,0.1); border-radius: 12px; padding: 32px 24px; max-width: 440px; }
            h2 { font-size: 18px; margin: 0 0 12px; color: #f87171; }
            p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0 0 20px; }
            button { background: #27272a; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Sign In Unsuccessful</h2>
            <p>${errorMsg}</p>
            <button onclick="window.close()">Close Window</button>
          </div>
          <script>
            const errorText = ${JSON.stringify(errorMsg)};
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: errorText }, '*');
              setTimeout(() => window.close(), 2500);
            } else {
              window.location.href = ${JSON.stringify(`${origin}/?auth_error=${encodeURIComponent(errorMsg)}`)};
            }
          </script>
        </body>
      </html>
    `);
    return;
  }

  try {
    const clientId = getGoogleClientId();
    const clientSecret = getGoogleClientSecret();
    const redirectUri = `${origin}/api/auth/google/callback`;

    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      const rawError = String(tokenData.error_description || tokenData.error || '');
      let errorMsg = rawError || 'Failed to exchange authorization code with Google.';
      if (rawError.toLowerCase().includes('client secret') || rawError.toLowerCase().includes('invalid_client')) {
        errorMsg = `Google reported that the Client Secret is invalid for Client ID (${clientId}). When you generate a new Client ID in Google Cloud Console, a matching Client Secret is generated with it. Please update the matching Client Secret or use Google One-Tap/GIS sign-in.`;
      }
      throw new Error(errorMsg);
    }

    // Retrieve user profile from Google UserInfo endpoint
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.email) {
      throw new Error('Failed to retrieve user profile from Google.');
    }

    const { token } = userStore.findOrCreateGoogleUser({
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      picture: profile.picture,
      sub: profile.sub
    });

    // Set secure cross-origin iframe compatible cookie
    res.cookie('retailiq_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    // Render HTML response that notifies window.opener via postMessage and closes popup
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>RetailIQ — Authentication Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background: #0c0c0e; color: #ececec; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #18181b; border: 1px solid rgba(236,236,236,0.1); border-radius: 12px; padding: 32px 24px; max-width: 380px; }
            .badge { width: 44px; height: 44px; margin: 0 auto 16px; border-radius: 50%; background: #245c45; display: flex; align-items: center; justify-content: center; color: white; }
            h2 { font-size: 18px; margin: 0 0 8px; font-weight: 600; }
            p { font-size: 13px; color: #a1a1aa; margin: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h2>Signed In to RetailIQ</h2>
            <p>Authentication complete. Returning to workspace...</p>
          </div>
          <script>
            const authToken = ${JSON.stringify(token)};
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: authToken }, '*');
              window.close();
            } else {
              window.location.href = ${JSON.stringify(`${origin}/?auth_token=${encodeURIComponent(token)}`)};
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('[RetailIQ Google OAuth Error]:', err);
    const errMsg = err.message || 'Google authentication failed.';
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>RetailIQ Authentication Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background: #0c0c0e; color: #ececec; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #18181b; border: 1px solid rgba(236,236,236,0.1); border-radius: 12px; padding: 32px 24px; max-width: 440px; }
            h2 { font-size: 18px; margin: 0 0 12px; color: #f87171; }
            p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0 0 20px; }
            button { background: #27272a; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Authentication Failed</h2>
            <p>${errMsg}</p>
            <button onclick="window.close()">Close Window</button>
          </div>
          <script>
            const errorMsg = ${JSON.stringify(errMsg)};
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: errorMsg }, '*');
              setTimeout(() => window.close(), 3000);
            } else {
              window.location.href = ${JSON.stringify(`${origin}/?auth_error=${encodeURIComponent(errMsg)}`)};
            }
          </script>
        </body>
      </html>
    `);
  }
};

authRouter.get('/google/callback', googleCallbackHandler);
authRouter.get('/google/callback/', googleCallbackHandler);

// POST /api/auth/google/credential - Google Identity Services One-Tap / Button callback
authRouter.post('/google/credential', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      res.status(400).json({ success: false, message: 'Google credential token is required.' });
      return;
    }

    // Verify token using Google tokeninfo endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const tokenInfo = await verifyRes.json();

    if (!verifyRes.ok || !tokenInfo.email) {
      res.status(400).json({ success: false, message: tokenInfo.error_description || 'Invalid Google credential token.' });
      return;
    }

    const { user, token } = userStore.findOrCreateGoogleUser({
      email: tokenInfo.email,
      name: tokenInfo.name || tokenInfo.email.split('@')[0],
      picture: tokenInfo.picture,
      sub: tokenInfo.sub
    });

    res.cookie('retailiq_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      user,
      token,
      message: 'Signed in with Google successfully.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to authenticate Google credential.'
    });
  }
});

// POST /api/auth/google/configure-secret - Configure or update matching Google Client Secret at runtime
authRouter.post('/google/configure-secret', (req: Request, res: Response) => {
  try {
    const { clientSecret } = req.body;
    if (!clientSecret || typeof clientSecret !== 'string' || clientSecret.trim().length < 8) {
      res.status(400).json({
        success: false,
        message: 'Valid Google Client Secret string is required (usually starts with GOCSPX-).'
      });
      return;
    }

    dynamicGoogleClientSecret = clientSecret.trim();
    res.json({
      success: true,
      message: 'Google Client Secret successfully updated. You may now continue with Google.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to update Google Client Secret.'
    });
  }
});

// POST /api/auth/forgot-password - Request password reset
authRouter.post('/forgot-password', (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, message: 'Valid email address is required.' });
      return;
    }

    const result = userStore.requestPasswordReset(email);

    // In production without an SMTP server configured, return the token for testing if on dev/demo
    const isDev = process.env.NODE_ENV !== 'production';

    res.json({
      success: true,
      message: 'If an account exists with this email, password reset instructions have been generated.',
      resetToken: isDev ? result.resetToken : undefined
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to process password reset.' });
  }
});

// POST /api/auth/reset-password - Complete password reset
authRouter.post('/reset-password', (req: Request, res: Response) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token) {
      res.status(400).json({ success: false, message: 'Password reset token is required.' });
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
      return;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' });
      return;
    }

    userStore.resetPasswordWithToken(token, newPassword);

    res.json({
      success: true,
      message: 'Your password has been successfully reset. You can now sign in with your new credentials.'
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to reset password.'
    });
  }
});

// POST /api/auth/logout - Invalidate session
authRouter.post('/logout', (req: Request, res: Response) => {
  const token = extractAuthToken(req);
  if (token) {
    userStore.invalidateSession(token);
  }

  res.clearCookie('retailiq_session', { path: '/' });
  res.json({
    success: true,
    message: 'Signed out successfully.'
  });
});
