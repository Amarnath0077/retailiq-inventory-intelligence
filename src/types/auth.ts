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

export interface AuthConfig {
  googleConfigured: boolean;
  clientId: string | null;
  origin: string;
  callbackUrl: string;
  setupInstructions?: {
    title: string;
    message: string;
    steps: string[];
  } | null;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  authConfig: AuthConfig | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, confirmPassword?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  submitGoogleCredential: (credential: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string; resetToken?: string }>;
  confirmPasswordReset: (token: string, newPassword: string, confirmPassword?: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  clearError: () => void;
}
