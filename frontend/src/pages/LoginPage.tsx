import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/boards';
import { useDrawStore } from '../store/useDrawStore';

function PencilLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="#ff6b35" />
      <path
        d="M18.5 7.5L20.5 9.5L10.5 19.5L8 20L8.5 17.5L18.5 7.5Z"
        fill="white"
        stroke="white"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 9.5L18.5 11.5"
        stroke="#ff6b35"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DotGrid() {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }}
    >
      <defs>
        <pattern
          id="dots-auth"
          x="0"
          y="0"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.5" cy="1.5" r="1" fill="#dde0e8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots-auth)" />
    </svg>
  );
}

interface LoginPageProps {
  mode?: 'login' | 'signup';
}

export default function LoginPage({ mode: propMode }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine mode from prop or URL pathname
  const isSignup = propMode ? propMode === 'signup' : location.pathname === '/signup';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [btnHovered, setBtnHovered] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setUser = useDrawStore((s) => s.setUser);

  // Clear errors when toggling between login and signup
  useEffect(() => {
    setError('');
  }, [isSignup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = isSignup
        ? await authApi.register(email, password)
        : await authApi.login(email, password);

      localStorage.setItem('drawplan_token', data.token);
      setUser(data.user);
      navigate('/boards');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '11px 14px',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif",
    color: '#1a1a2e',
    backgroundColor: '#ffffff',
    border: `1.5px solid ${focusedField === field ? '#7c5cff' : '#e5e7eb'}`,
    borderRadius: '10px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(124,92,255,0.12)' : 'none',
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: '#fafafa',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
    >
      <DotGrid />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
          padding: '24px',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            justifyContent: 'center',
            marginBottom: '40px',
          }}
        >
          <PencilLogo />
          <span
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#1a1a2e',
              letterSpacing: '-0.4px',
            }}
          >
            DrawPlan
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '36px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#1a1a2e',
              margin: '0 0 6px',
              letterSpacing: '-0.3px',
            }}
          >
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#9ca3af',
              margin: '0 0 28px',
            }}
          >
            {isSignup
              ? 'Start drawing and planning for free'
              : 'Sign in to your DrawPlan account'}
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                style={inputStyle('email')}
                required
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                style={inputStyle('password')}
                required
                minLength={isSignup ? 6 : undefined}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fee2e2',
                  color: '#ef4444',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
              style={{
                marginTop: '6px',
                width: '100%',
                padding: '11px',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                color: '#ffffff',
                backgroundColor: loading ? '#937dfa' : btnHovered ? '#6b4df0' : '#7c5cff',
                border: 'none',
                borderRadius: '10px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s, box-shadow 0.15s',
                boxShadow: btnHovered && !loading
                  ? '0 4px 14px rgba(124,92,255,0.4)'
                  : '0 2px 8px rgba(124,92,255,0.25)',
                letterSpacing: '0.01em',
              }}
            >
              {loading
                ? isSignup
                  ? 'Creating account…'
                  : 'Signing in…'
                : isSignup
                ? 'Create account'
                : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '14px',
            color: '#9ca3af',
          }}
        >
          {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => {
              navigate(isSignup ? '/login' : '/signup');
            }}
            style={{
              color: '#7c5cff',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: "'Inter', sans-serif",
              padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#6b4df0')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#7c5cff')}
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
