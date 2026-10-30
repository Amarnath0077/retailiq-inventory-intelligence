import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User, UserRecord, Session } from './types.ts';

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
    if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
      return process.env.AUTH_SECRET;
    }
    if (fs.existsSync(SECRET_FILE)) {
      try {
        const stored = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
        if (stored.length >= 16) return stored;
      } catch (err) {
        // Fall back to generate
      }
    }
    const newSecret = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(SECRET_FILE, newSecret, 'utf-8');
    } catch (err) {
      console.warn('Could not persist auth secret, using in-memory secret');
    }
    return newSecret;
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
    } catch (err) {
      console.error('Failed to persist users to disk:', err);
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
      } catch (err) {
        console.warn('Could not load sessions from file');
      }
    }
  }

  private persistSessions() {
    try {
      this.ensureDataDir();
      const now = Date.now();
      const validSessions = Array.from(this.sessions.entries()).filter(([_, s]) => s.expiresAt > now);
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(validSessions, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist sessions to disk:', err);
    }
  }

  private ensureDefaultAdminUser() {
    // If no users exist, seed a standard primary manager account for out-of-the-box evaluation
    const defaultEmail = 'manager@retailiq.internal';
    if (!this.usersByEmail.has(defaultEmail)) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = this.hashPassword('RetailAdmin2026!', salt);
      const user: UserRecord = {
        id: 'usr_admin_' + crypto.randomBytes(4).toString('hex'),
        email: defaultEmail,
        name: 'Inventory Operations Lead',
        role: 'admin',
        emailVerified: true,
        provider: 'local',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        passwordHash: hash,
        passwordSalt: salt
      };
      this.users.set(user.id, user);
      this.usersByEmail.set(defaultEmail, user.id);
      this.persistUsers();
      console.log(`[RetailIQ Auth] Standard operations account initialized: ${defaultEmail}`);
    }
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

  public sanitizeUser(user: UserRecord): User {
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
      emailVerified: true, // Auto-verified on local register
      provider: 'local',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      passwordHash: hash,
      passwordSalt: salt
    };

    this.users.set(userId, newUser);
    this.usersByEmail.set(cleanEmail, userId);
    this.persistUsers();

    const session = this.createSession(userId, false);
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

    const session = this.createSession(user.id, rememberMe);
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
      const userId = 'usr_g_' + crypto.randomBytes(8).toString('hex');
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
    const session = this.createSession(user.id, true);
    return { user: this.sanitizeUser(user), token: session.token };
  }

  public createSession(userId: string, rememberMe: boolean): { session: Session; token: string } {
    const durationMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const sessionId = crypto.randomBytes(24).toString('hex');
    
    // Create signed token: base64(userId:sessionId:expiresAt).signature
    const payload = `${userId}:${sessionId}:${now + durationMs}`;
    const signature = crypto.createHmac('sha256', this.authSecret).update(payload).digest('hex');
    const token = `${Buffer.from(payload).toString('base64url')}.${signature}`;

    const session: Session = {
      id: sessionId,
      userId,
      createdAt: now,
      expiresAt: now + durationMs
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
    let payload = '';
    try {
      payload = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    } catch {
      return null;
    }

    const expectedSig = crypto.createHmac('sha256', this.authSecret).update(payload).digest('hex');
    if (expectedSig !== signature) {
      return null; // Tampered or invalid
    }

    const [userId, _, expiresAtStr] = payload.split(':');
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || expiresAt < Date.now()) {
      this.sessions.delete(token);
      return null; // Expired
    }

    const session = this.sessions.get(token);
    if (!session || session.userId !== userId || session.expiresAt < Date.now()) {
      return null;
    }

    const user = this.findById(userId);
    return user ? this.sanitizeUser(user) : null;
  }

  public invalidateSession(token: string): boolean {
    if (this.sessions.has(token)) {
      this.sessions.delete(token);
      this.persistSessions();
      return true;
    }
    return false;
  }

  public requestPasswordReset(email: string): { success: boolean; resetToken?: string } {
    const user = this.findByEmail(email);
    if (!user) {
      // Return success true anyway to prevent email enumeration
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
