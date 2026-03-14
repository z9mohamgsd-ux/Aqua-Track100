import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const GOOGLE_ENABLED = !!import.meta.env.VITE_GOOGLE_ENABLED || true;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

type Step = 'credentials' | 'otp';

export default function LoginPage() {
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresVerification) {
        setSessionToken(result.sessionToken!);
        setMaskedEmail(result.maskedEmail!);
        setStep('otp');
        setResendCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== '') && next.join('').length === 6) {
      handleOtpSubmit(next.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setOtp(pasted.split(''));
      handleOtpSubmit(pasted);
    }
  };

  const handleOtpSubmit = async (code?: string) => {
    const finalCode = code ?? otp.join('');
    if (finalCode.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      await verifyOtp(sessionToken, finalCode);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresVerification) {
        setSessionToken(result.sessionToken!);
        setResendCooldown(60);
        setOtp(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      }
    } catch {
      setError('Failed to resend code. Please go back and try again.');
    } finally {
      setLoading(false);
    }
  };

  const logoBlock = (
    <div className="text-center space-y-1 mb-6">
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
          </svg>
        </div>
        <span className="text-xl font-bold text-foreground">AquaTrack</span>
      </div>
    </div>
  );

  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 p-8 rounded-2xl border border-border bg-card shadow-lg">
          {logoBlock}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/40 mb-4">
              <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
            <p className="text-sm text-muted-foreground mt-1">
              We sent a 6-digit code to <span className="font-medium text-foreground">{maskedEmail}</span>
            </p>
          </div>

          <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="w-11 h-12 text-center text-lg font-bold rounded-lg border-2 border-border bg-background text-foreground focus:border-blue-500 focus:outline-none focus:ring-0 transition"
                autoFocus={i === 0}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900 text-center">
              {error}
            </p>
          )}

          <button
            onClick={() => handleOtpSubmit()}
            disabled={loading || otp.join('').length !== 6}
            className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold transition"
          >
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>

          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              Didn't receive it?{' '}
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-blue-500 hover:underline font-medium disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </p>
            <button
              onClick={() => { setStep('credentials'); setError(''); setOtp(['', '', '', '', '', '']); }}
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-5 p-8 rounded-2xl border border-border bg-card shadow-lg">
        {logoBlock}
        <div className="text-center -mt-2 mb-2">
          <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sign in to your account</p>
        </div>

        {GOOGLE_ENABLED && (
          <>
            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition"
            >
              <GoogleIcon />
              Continue with Google
            </a>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleCredentials} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="owner@aquatrack.io"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold transition"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/signup" className="text-blue-500 hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
