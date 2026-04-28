import { useState } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import api from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Login() {
  const { login, register, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot'
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', company_name: '',
  });

  // Redirect to home if already logged in
  if (!isLoadingAuth && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await api.post('/api/auth/forgot-password', { email: form.email });
        setInfo('If that email is registered, a reset link has been sent.');
        setLoading(false);
        return;
      }
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          company_name: form.company_name,
        });
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img
            src="/cadence-logo.png"
            alt="Cadence"
            className="w-8 h-8 object-contain"
          />
          <span className="font-bold text-2xl text-primary">Cadence</span>
        </div>

        <Card className="p-8">
          <h1 className="text-2xl font-bold mb-1">
            {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset your password'}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'login'
              ? 'Sign in to your Cadence account'
              : mode === 'register'
              ? 'Start your 30-day free trial'
              : "Enter your email and we'll send a reset link"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <input
                    name="full_name"
                    type="text"
                    required
                    value={form.full_name}
                    onChange={handleChange}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Company Name</label>
                  <input
                    name="company_name"
                    type="text"
                    required
                    value={form.company_name}
                    onChange={handleChange}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Acme Inc."
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@company.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
                      className="text-xs text-muted-foreground hover:text-primary"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  value={form.password}
                  onChange={handleChange}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {info && (
              <p className="text-sm text-green-600">{info}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : 'Send Reset Link'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === 'forgot' ? (
              <>
                Remember it?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                  className="text-primary font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => { setMode('register'); setError(''); setInfo(''); }}
                  className="text-primary font-medium hover:underline"
                >
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                  className="text-primary font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
