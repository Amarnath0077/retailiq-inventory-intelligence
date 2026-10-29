import { Router, Request, Response } from 'express';
import { userStore } from './userStore.ts';
import { requireAuth, extractAuthToken } from './authMiddleware.ts';

export const authRouter = Router();

function getAppOrigin(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.trim() && !process.env.APP_URL.includes('MY_APP_URL')) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

// GET /api/auth/config - Public configuration for OAuth and UI setup
authRouter.get('/config', (req: Request, res: Response) => {
  const origin = getAppOrigin(req);
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
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
        '5. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment or Vercel project settings.'
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

    // Set secure HttpOnly cookie
    res.cookie('retailiq_session', token, {
      httpOnly: true,
      secure: req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
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
      secure: req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
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

// GET /api/auth/google/url - Initiate Google OAuth Redirect
authRouter.get('/google/url', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
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
  const state = Math.random().toString(36).substring(2);

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;

  res.json({
    success: true,
    url: authUrl
  });
});

// GET /api/auth/google/callback - Handle Google OAuth redirect code exchange
authRouter.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;
  const origin = getAppOrigin(req);

  if (error || !code) {
    res.redirect(`${origin}/?auth_error=${encodeURIComponent(String(error || 'Google login was cancelled.'))}`);
    return;
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
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
      throw new Error(tokenData.error_description || 'Failed to exchange authorization code with Google.');
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

    res.cookie('retailiq_session', token, {
      httpOnly: true,
      secure: req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    // Redirect to dashboard with token parameter for client storage
    res.redirect(`${origin}/?auth_token=${encodeURIComponent(token)}`);
  } catch (err: any) {
    console.error('[RetailIQ Google OAuth Error]:', err);
    res.redirect(`${origin}/?auth_error=${encodeURIComponent(err.message || 'Google authentication failed.')}`);
  }
});

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
      secure: req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
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
