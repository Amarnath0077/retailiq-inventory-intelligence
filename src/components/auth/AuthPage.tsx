import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Boxes, 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  KeyRound,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

type AuthViewMode = 'login' | 'register' | 'forgot_password' | 'reset_password';

export const AuthPage: React.FC = () => {
  const { 
    login, 
    register, 
    loginWithGoogle, 
    requestPasswordReset, 
    confirmPasswordReset,
    authConfig,
    error: globalError,
    clearError
  } = useAuth();

  const [mode, setMode] = useState<AuthViewMode>('login');
  
  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Forgot / Reset Password States
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status & Feedback States
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGoogleSetupModal, setShowGoogleSetupModal] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // Clear errors on mode switch
  const switchMode = (newMode: AuthViewMode) => {
    setMode(newMode);
    setFormError(null);
    setFormSuccess(null);
    clearError();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!loginEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      setFormError('Please enter a valid business email address.');
      return;
    }
    if (!loginPassword) {
      setFormError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(loginEmail, loginPassword, rememberMe);
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!regName.trim() || regName.trim().length < 2) {
      setFormError('Full name must be at least 2 characters.');
      return;
    }
    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setFormError('Please enter a valid work email.');
      return;
    }
    if (regPassword.length < 8) {
      setFormError('Password must contain at least 8 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setFormError('Passwords do not match. Please verify.');
      return;
    }
    if (!termsAccepted) {
      setFormError('Please accept the Terms of Service & Privacy Policy to create your account.');
      return;
    }

    setIsSubmitting(true);
    const result = await register(regName, regEmail, regPassword, regConfirmPassword);
    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error || 'Registration failed.');
    }
  };

  const handleGoogleClick = async () => {
    setFormError(null);
    if (!authConfig?.googleConfigured) {
      setShowGoogleSetupModal(true);
      return;
    }

    try {
      setIsSubmitting(true);
      await loginWithGoogle();
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err.message || 'Could not connect to Google authentication.');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!resetEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    const res = await requestPasswordReset(resetEmail);
    setIsSubmitting(false);

    if (res.success) {
      setFormSuccess(res.message);
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setMode('reset_password');
      }
    } else {
      setFormError(res.message);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!resetToken.trim()) {
      setFormError('Security reset token is required.');
      return;
    }
    if (newPassword.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const res = await confirmPasswordReset(resetToken, newPassword, newPasswordConfirm);
    setIsSubmitting(false);

    if (res.success) {
      setFormSuccess(res.message);
      setTimeout(() => {
        switchMode('login');
        setLoginEmail(resetEmail);
      }, 2000);
    } else {
      setFormError(res.message);
    }
  };

  const fillQuickDemo = () => {
    setLoginEmail('manager@retailiq.internal');
    setLoginPassword('RetailAdmin2026!');
    setFormError(null);
  };

  const copyRedirectUri = () => {
    const uri = authConfig?.callbackUrl || `${window.location.origin}/api/auth/google/callback`;
    navigator.clipboard.writeText(uri);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0F19] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans text-slate-100">
      {/* Subtle Ambient Radial Gradients */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-br from-indigo-900/30 via-violet-900/20 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tl from-teal-900/25 via-emerald-950/20 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:24px_24px] opacity-35 pointer-events-none" />

      {/* Main Container Card */}
      <div className="w-full max-w-5xl bg-[#111827]/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10">
        
        {/* LEFT COLUMN: Brand Hero, Value Prop & Live Abstract Retail Analytics */}
        <div className="hidden lg:flex lg:col-span-6 bg-gradient-to-b from-[#0F172A] via-[#131C31] to-[#0A101D] p-10 flex-col justify-between border-r border-slate-800/80 relative">
          {/* Subtle grid accent */}
          <div className="space-y-8">
            {/* Logo & Platform Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Boxes className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  RetailIQ
                  <span className="px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider font-semibold rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    Enterprise
                  </span>
                </span>
                <p className="text-xs text-slate-400">Retail Intelligence &amp; Inventory Operations</p>
              </div>
            </div>

            {/* Headline and narrative */}
            <div className="space-y-3 pt-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
                Smarter Inventory.<br />
                <span className="bg-gradient-to-r from-indigo-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
                  Better Decisions.
                </span>
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Connect your physical and digital merchandise records. Query stock turnover with natural-language AI, simulate replenishment thresholds, and benchmark retail market pricing.
              </p>
            </div>

            {/* Abstract Retail Data Visualizations */}
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-teal-400" />
                <span>Live Operational Benchmarks</span>
              </div>

              {/* Data Card 1: Stock Health & Fill Rate */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                    Overall Stock Availability
                  </span>
                  <span className="font-mono tabular-nums text-teal-300 font-semibold">94.8%</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: '94.8%' }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Target: 92%</span>
                  <span>+2.4% vs last cycle</span>
                </div>
              </div>

              {/* Data Card 2: AI Query & Replenishment Signal */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Active Forecast Engine
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Gemini 3.8 Flash
                  </span>
                </div>
                <p className="text-xs text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                  "Show 5 lowest-stock high velocity SKUs across stores"
                </p>
                <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                  <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                    <div className="text-[10px] text-slate-500 uppercase">Valuation</div>
                    <div className="text-xs font-semibold text-white font-mono">$1.42M</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                    <div className="text-[10px] text-slate-500 uppercase">Turnover</div>
                    <div className="text-xs font-semibold text-white font-mono">4.8x</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                    <div className="text-[10px] text-slate-500 uppercase">Safety Stock</div>
                    <div className="text-xs font-semibold text-emerald-400 font-mono">Optimal</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Footnote */}
          <div className="pt-6 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              Multi-tenant Isolated Security
            </span>
            <span>Version 2.4</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Authentication Forms */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center bg-[#0F172A]/70">
          
          {/* Top Brand Tag on Mobile */}
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center text-white">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">RetailIQ</span>
              <span className="text-xs text-slate-400 ml-2">Inventory Intelligence</span>
            </div>
          </div>

          {/* Mode Headers */}
          <div className="mb-6">
            {mode === 'login' && (
              <>
                <h2 className="text-2xl font-bold text-white tracking-tight">Sign in to your workspace</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Access inventory metrics, AI replenishment query engine, and analytics.
                </p>
              </>
            )}

            {mode === 'register' && (
              <>
                <h2 className="text-2xl font-bold text-white tracking-tight">Create your RetailIQ account</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Start analyzing datasets and automating inventory decisions in seconds.
                </p>
              </>
            )}

            {mode === 'forgot_password' && (
              <>
                <h2 className="text-2xl font-bold text-white tracking-tight">Reset your password</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your email address and we'll dispatch secure reset credentials.
                </p>
              </>
            )}

            {mode === 'reset_password' && (
              <>
                <h2 className="text-2xl font-bold text-white tracking-tight">Set new account password</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Create a secure password with at least 8 characters.
                </p>
              </>
            )}
          </div>

          {/* Feedback & Error Alerts */}
          {(formError || globalError) && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{formError || globalError}</div>
            </div>
          )}

          {formSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-teal-950/50 border border-teal-800/80 text-teal-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{formSuccess}</div>
            </div>
          )}

          {/* Quick Demo Fill Helper */}
          {mode === 'login' && (
            <div className="mb-5 p-3 rounded-xl bg-slate-900/90 border border-indigo-500/20 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-teal-400 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-200">Exploring RetailIQ?</span>
                  <div className="text-[11px] text-slate-400 font-mono">manager@retailiq.internal</div>
                </div>
              </div>
              <button
                type="button"
                onClick={fillQuickDemo}
                className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Auto-fill
              </button>
            </div>
          )}

          {/* ================= OPTION A: CONTINUE WITH GOOGLE ================= */}
          {(mode === 'login' || mode === 'register') && (
            <div className="space-y-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleGoogleClick}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {/* Official Google G Logo */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-[#0F172A] px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider shrink-0">
                  Or continue with email
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>
            </div>
          )}

          {/* ================= OPTION B: LOGIN FORM ================= */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 mt-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 transition-colors focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot_password')}
                    className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 transition-colors focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-md border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-xs text-slate-400">Remember session for 30 days</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to RetailIQ</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Switch to Register */}
              <div className="text-center pt-2 text-xs text-slate-400">
                New to RetailIQ?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Create an account
                </button>
              </div>
            </form>
          )}

          {/* ================= OPTION B: CREATE ACCOUNT FORM ================= */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 mt-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Alex Morgan"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 transition-colors focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="alex@merchandise.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 transition-colors focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">
                  Password (min 8 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={8}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 transition-colors focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 transition-colors focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Terms acknowledgement */}
              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 rounded-md border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 mt-0.5"
                  />
                  <span className="text-[11px] text-slate-400 leading-normal">
                    I agree to the RetailIQ{' '}
                    <span className="text-indigo-400 hover:underline">Terms of Service</span> and{' '}
                    <span className="text-indigo-400 hover:underline">Privacy Policy</span>.
                  </span>
                </label>
              </div>

              {/* Submit Register Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-teal-600/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create RetailIQ Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Switch to Login */}
              <div className="text-center pt-1 text-xs text-slate-400">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {/* ================= FORGOT PASSWORD ================= */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 transition-colors focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Dispatching Token...' : 'Send Password Reset Token'}
              </button>

              <div className="text-center pt-2 text-xs text-slate-400">
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ================= RESET PASSWORD WITH TOKEN ================= */}
          {mode === 'reset_password' && (
            <form onSubmit={handleResetSubmit} className="space-y-3.5 mt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">
                  Security Reset Token
                </label>
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white font-mono placeholder-slate-500 transition-colors focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">
                  New Password (min 8 chars)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={8}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 transition-colors focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 transition-colors focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Updating Password...' : 'Save New Password & Sign In'}
              </button>

              <div className="text-center pt-2 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Cancel &amp; return to Sign In
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* GOOGLE OAUTH CLOUD CONFIGURATION MODAL */}
      {showGoogleSetupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-white font-bold text-sm">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <span>Google OAuth Production Setup</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleSetupModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Google OAuth requires an OAuth 2.0 Web Client ID registered in Google Cloud Console with your verified deployment domain:
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">1. Authorized JavaScript Origins:</div>
                <code className="text-teal-300 font-mono text-[11px] block bg-slate-950 p-1.5 rounded border border-slate-800 select-all">
                  {authConfig?.origin || window.location.origin}
                </code>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">2. Authorized Redirect URI:</span>
                  <button
                    type="button"
                    onClick={copyRedirectUri}
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  >
                    {copiedCallback ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCallback ? 'Copied' : 'Copy URI'}</span>
                  </button>
                </div>
                <code className="text-teal-300 font-mono text-[11px] block bg-slate-950 p-1.5 rounded border border-slate-800 select-all break-all">
                  {authConfig?.callbackUrl || `${window.location.origin}/api/auth/google/callback`}
                </code>
              </div>

              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-indigo-200 text-[11px] space-y-1">
                <div className="font-semibold text-indigo-300">3. Environment Variables:</div>
                <p className="text-slate-300">
                  Set <code className="text-teal-300 font-mono">GOOGLE_CLIENT_ID</code> and <code className="text-teal-300 font-mono">GOOGLE_CLIENT_SECRET</code> in your Vercel or deployment environment.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                In the meantime, sign in with email/password or use the demo lead account.
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowGoogleSetupModal(false);
                  fillQuickDemo();
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shrink-0"
              >
                Use Email Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
