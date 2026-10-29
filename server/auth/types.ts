export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'inventory_manager' | 'analyst';
  emailVerified: boolean;
  provider: 'local' | 'google';
  createdAt: string;
  lastLoginAt: string;
}

export interface UserRecord extends User {
  passwordHash?: string;
  passwordSalt?: string;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpires?: number;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  userAgent?: string;
  ip?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
  requiresEmailVerification?: boolean;
}
