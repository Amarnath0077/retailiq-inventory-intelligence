import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User, UserRecord, Session, TokenClaims } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In serverless environments (Vercel / Lambda), use /tmp where writes are permitted
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? '/tmp/retailiq_data' : path.resolve(__dirname, '../data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.resolve(DATA_DIR, 'sessions.json');
const SECRET_FILE = path.resolve(DATA_DIR, 'auth_secret.key');

class UserStore {
  private users: Map<string, UserRecord> = new Map(); // keyed by id
  private usersByEmail: Map<string, string> = new Map(); // email -> id
  private sessions: Map<string, Session> = new Map(); // session token -> Session
  private revokedSessions: Set<string> = new Set(); // explicitly revoked session/token IDs
  private authSecret: string;

  constructor() {
    this.ensureDataDir();
    this.authSecret = this.loadOrCreateSecret();
    this.loadUsers();
    this.loadSessions();
    this.ensureDefaultAdminUser();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch {
      // In read-only filesystems, proceed gracefully with in-memory persistence
    }
  }

  private loadOrCreateSecret(): string {
    // Check SESSION_SECRET first (the exact env var configured on Vercel), then AUTH_SECRET and JWT_SECRET
    const configuredSecret = 
      process.env.SESSION_SECRET ||
      process.env.AUTH_SECRET ||
      process.env.JWT_SECRET ||
      process.env.SECRET_KEY;

    if (configuredSecret && configuredSecret.trim().length >= 8) {
      return configuredSecret.trim();
    }

    if (fs.existsSync(SECRET_FILE)) {
      try {
        const stored = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
        if (stored.length >= 16) return stored;
      } catch {
        // Fall through
      }
    }

    // Deterministic master secret for serverless containers so all lambda instances compute identical HMAC signatures
    const stableSecret = 'retailiq_serverless_stateless_session_secret_master_key_2026_v9';
    try {
      this.ensureDataDir();
      fs.writeFileSync(SECRET_FILE, stableSecret, 'utf-8');
    } catch {
      // In-memory fallback
    }
    return stableSecret;
  }

  private loadUsers() {
    if (fs.existsSync(USERS_FILE)) {
      try {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        const list: UserRecord[] = JSON.parse(raw);
        for (const u of list) {
          this.users.set(u.id, u);
          this.usersByEmail.set(u.email.toLowerCase(), u.id);
        }
      } catch (err) {
        console.error('Failed to parse users.json, initializing fresh store:', err);
      }
    }
  }

  private persistUsers() {
    try {
      this.ensureDataDir();
      const list = Array.from(this.users.values());
      fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch {
      // Proceed in-memory on restricted filesystems
    }
  }

  private loadSessions() {
    if (fs.existsSync(SESSIONS_FILE)) {
      try {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        const list: [string, Session][] = JSON.parse(raw);
        const now = Date.now();
        for (const [token, session] of list) {
          if (session.expiresAt > now) {
            this.sessions.set(token, session);
          }
        }
      } catch {
        // Fall through
      }
    }
  }

  private persistSessions() {
    try {
      this.ensureDataDir();
      const now = Date.now();
      const validSessions = Array.from(this.sessions.entries()).filter(([_, s]) => s.expiresAt > now);
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(validSessions, null, 2), 'utf-8');
    } catch {
      // Proceed in-memory
    }
  }

  private ensureDefaultAdminUser() {
    // Standard operations lead account with deterministic salt & ID
    // Guarantees reliable cross-container verification on every Vercel lambda cold start
    const defaultEmail = 'manager@retailiq.internal';
    const deterministicId = 'usr_admin_default_lead';
    const deterministicSalt = 'retailiq_salt_admin_demo_seed_2026_x89';
    const hash = this.hashPassword('RetailAdmin2026!', deterministicSalt);

    const user: UserRecord = {
      id: deterministicId,
      email: defaultEmail,
      name: 'Inventory Operations Lead',
      role: 'admin',
      emailVerified: true,
      provider: 'local',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: new Date().toISOString(),
      passwordHash: hash,
      passwordSalt: deterministicSalt
    };

    this.users.set(deterministicId, user);
    this.usersByEmail.set(defaultEmail, deterministicId);
  }

  public hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    const computed = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  }

  public findByEmail(email: string): UserRecord | null {
    const id = this.usersByEmail.get(email.toLowerCase().trim());
    if (!id) return null;
    return this.users.get(id) || null;
  }

  public findById(id: string): UserRecord | null {
    return this.users.get(id) || null;
  }

  public sanitizeUser(user: UserRecord | User): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      emailVerified: user.emailVerified,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  }

  public registerUser(name: string, email: string, password: string): { user: User; token: string } {
    const cleanEmail = email.toLowerCase().trim();
    if (this.usersByEmail.has(cleanEmail)) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(password, salt);
    const userId = 'usr_' + crypto.randomBytes(8).toString('hex');

    const newUser: UserRecord = {
      id: userId,
      email: cleanEmail,
      name: name.trim(),
      role: 'inventory_manager',
      emailVerified: true,
      provider: 'local',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      passwordHash: hash,
      passwordSalt: salt
    };

    this.users.set(userId, newUser);
    this.usersByEmail.set(cleanEmail, userId);
    this.persistUsers();

    const session = this.createSession(userId, false, newUser);
    return { user: this.sanitizeUser(newUser), token: session.token };
  }

  public authenticate(email: string, password: string, rememberMe = false): { user: User; token: string } {
    const cleanEmail = email.toLowerCase().trim();
    const user = this.findByEmail(cleanEmail);

    if (!user || !user.passwordHash || !user.passwordSalt) {
      throw new Error('Invalid email address or password.');
    }

    const isValid = this.verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      throw new Error('Invalid email address or password.');
    }

    user.lastLoginAt = new Date().toISOString();
    this.persistUsers();

    const session = this.createSession(user.id, rememberMe, user);
    return { user: this.sanitizeUser(user), token: session.token };
  }

  public findOrCreateGoogleUser(googlePayload: {
    email: string;
    name: string;
    picture?: string;
    sub: string;
  }): { user: User; token: string } {
    const cleanEmail = googlePayload.email.toLowerCase().trim();
    let user = this.findByEmail(cleanEmail);

    if (!user) {
      // Deterministic user ID based on Google sub/email to guarantee cross-container consistency
      const idHash = crypto.createHash('sha256').update(googlePayload.sub || cleanEmail).digest('hex').slice(0, 16);
      const userId = `usr_g_${idHash}`;
      user = {
        id: userId,
        email: cleanEmail,
        name: googlePayload.name || cleanEmail.split('@')[0],
        avatar: googlePayload.picture,
        role: 'inventory_manager',
        emailVerified: true,
        provider: 'google',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      this.users.set(userId, user);
      this.usersByEmail.set(cleanEmail, userId);
    } else {
      user.lastLoginAt = new Date().toISOString();
      if (googlePayload.picture) user.avatar = googlePayload.picture;
      if (!user.name && googlePayload.name) user.name = googlePayload.name;
    }

    this.persistUsers();
    const session = this.createSession(user.id, true, user);
    return { user: this.sanitizeUser(user), token: session.token };
  }

  public createSession(userId: string, rememberMe: boolean, userRecord?: User | UserRecord): { session: Session; token: string } {
    const durationMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expiresAt = now + durationMs;
    const sessionId = crypto.randomBytes(16).toString('hex');

    const effectiveUser = userRecord || this.findById(userId);

    // Self-contained, tamper-proof signed claims for stateless verification on Vercel
    const claims: TokenClaims = {
      uid: userId,
      email: effectiveUser?.email || '',
      name: effectiveUser?.name || 'RetailIQ User',
      avatar: effectiveUser?.avatar,
      role: (effectiveUser?.role as any) || 'inventory_manager',
      emailVerified: Boolean(effectiveUser?.emailVerified),
      provider: effectiveUser?.provider || 'local',
      iat: now,
      exp: expiresAt,
      sid: sessionId
    };

    const payloadBase64 = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = crypto.createHmac('sha256', this.authSecret).update(payloadBase64).digest('base64url');
    const token = `${payloadBase64}.${signature}`;

    const session: Session = {
      id: sessionId,
      userId,
      createdAt: now,
      expiresAt
    };

    this.sessions.set(token, session);
    this.persistSessions();

    return { session, token };
  }

  public validateToken(token: string): User | null {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    if (!payloadBase64 || !signature) return null;

    // Verify cryptographic HMAC signature using shared secret
    const expectedSigBase64Url = crypto.createHmac('sha256', this.authSecret).update(payloadBase64).digest('base64url');
    const expectedSigHex = crypto.createHmac('sha256', this.authSecret).update(payloadBase64).digest('hex');

    if (signature !== expectedSigBase64Url && signature !== expectedSigHex) {
      return null; // Tampered or invalid signature
    }

    let rawPayload = '';
    try {
      rawPayload = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    } catch {
      return null;
    }

    // Path A: Stateless JSON claims (serverless-proof)
    try {
      const claims: TokenClaims = JSON.parse(rawPayload);
      if (claims && claims.uid && claims.exp) {
        if (claims.exp < Date.now()) {
          this.sessions.delete(token);
          return null; // Expired
        }

        // Check if explicitly invalidated
        if (this.revokedSessions.has(token) || (claims.sid && this.revokedSessions.has(claims.sid))) {
          return null;
        }

        // Check if user exists in local memory
        let user = this.findById(claims.uid);
        if (!user) {
          // Reconstitute user record from cryptographically verified signed claims
          // This allows Container B on Vercel to authenticate users created on Container A without an external DB roundtrip
          user = {
            id: claims.uid,
            email: claims.email || '',
            name: claims.name || 'RetailIQ User',
            avatar: claims.avatar,
            role: claims.role || 'inventory_manager',
            emailVerified: Boolean(claims.emailVerified),
            provider: claims.provider || 'local',
            createdAt: new Date(claims.iat || Date.now()).toISOString(),
            lastLoginAt: new Date().toISOString()
          };
          this.users.set(user.id, user);
          if (user.email) {
            this.usersByEmail.set(user.email.toLowerCase(), user.id);
          }
        }

        return this.sanitizeUser(user);
      }
    } catch {
      // Fall through to legacy colon format
    }

    // Path B: Legacy format "userId:sessionId:expiresAt"
    const [userId, _, expiresAtStr] = rawPayload.split(':');
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || expiresAt < Date.now()) {
      this.sessions.delete(token);
      return null; // Expired
    }

    const session = this.sessions.get(token);
    if (session && session.userId !== userId) {
      return null;
    }

    const user = this.findById(userId);
    return user ? this.sanitizeUser(user) : null;
  }

  public invalidateSession(token: string): boolean {
    let wasValid = false;
    if (this.sessions.has(token)) {
      this.sessions.delete(token);
      wasValid = true;
    }
    this.revokedSessions.add(token);

    try {
      const parts = token.split('.');
      if (parts[0]) {
        const raw = Buffer.from(parts[0], 'base64url').toString('utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.sid) {
          this.revokedSessions.add(parsed.sid);
        }
      }
    } catch {
      // Ignore
    }

    this.persistSessions();
    return wasValid;
  }

  public requestPasswordReset(email: string): { success: boolean; resetToken?: string } {
    const user = this.findByEmail(email);
    if (!user) {
      return { success: true };
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    this.persistUsers();

    return { success: true, resetToken };
  }

  public resetPasswordWithToken(token: string, newPassword: string): boolean {
    if (!token || !newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    let targetUser: UserRecord | null = null;
    for (const u of this.users.values()) {
      if (u.resetToken === token && u.resetTokenExpires && u.resetTokenExpires > Date.now()) {
        targetUser = u;
        break;
      }
    }

    if (!targetUser) {
      throw new Error('Invalid or expired password reset token.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    targetUser.passwordSalt = salt;
    targetUser.passwordHash = this.hashPassword(newPassword, salt);
    targetUser.resetToken = undefined;
    targetUser.resetTokenExpires = undefined;
    this.persistUsers();

    return true;
  }
}

export const userStore = new UserStore();

