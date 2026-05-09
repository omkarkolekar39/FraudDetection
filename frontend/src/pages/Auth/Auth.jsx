import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ScanSearch,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { loginOperator } from '../../api/loginEndpoints';
import { registerOperator } from '../../api/registerEndpoints';
import brandMark from '../../assets/logo.svg';
import { useAuth } from '../../contexts/useAuth';
import './Auth.css';

const initialForm = {
  username: '',
  password: '',
  role: 'Viewer',
};

const roleCards = [
  {
    value: 'Admin',
    title: 'Admin',
    helper: 'Reserved for the platform owner and approval authority.',
    icon: ShieldCheck,
  },
  {
    value: 'Analyst',
    title: 'Analyst',
    helper: 'Starts with Viewer access until an Admin approves elevated permissions.',
    icon: ScanSearch,
  },
  {
    value: 'Viewer',
    title: 'Viewer',
    helper: 'Immediate read-only access to dashboards, insights, and investigations.',
    icon: Users,
  },
];

function Auth({ defaultMode = 'login' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login } = useAuth();
  const mode = defaultMode;
  const routeState = location.state ?? {};

  const [form, setForm] = useState(() => ({
    ...initialForm,
    username: routeState.prefillUsername || '',
  }));
  const [status, setStatus] = useState(() => ({
    type: routeState.authStatusType || '',
    message: routeState.authStatusMessage || '',
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function clearStatus() {
    if (status.message) {
      setStatus({ type: '', message: '' });
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    clearStatus();
    setForm((previous) => ({
      ...previous,
      [name]: name === 'username' ? value.replace(/^\s+/, '') : value,
    }));
  }

  function buildRouteState(extraState = {}) {
    return {
      ...(location.state?.from ? { from: location.state.from } : {}),
      ...extraState,
    };
  }

  function navigateToMode(nextMode, extraState = {}) {
    navigate(nextMode === 'register' ? '/register' : '/login', {
      replace: true,
      state: buildRouteState({
        prefillUsername: form.username.trim(),
        ...extraState,
      }),
    });
  }

  function validateForm() {
    const username = form.username.trim();

    if (username.length < 3) {
      return 'Username must be at least 3 characters long.';
    }

    if (form.password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }

    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearStatus();

    const validationError = validateForm();
    if (validationError) {
      setStatus({ type: 'error', message: validationError });
      return;
    }

    const username = form.username.trim();
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const response = await loginOperator({
          username,
          password: form.password,
        });

        login(response);

        const destination = location.state?.from?.pathname || '/dashboard';
        navigate(destination, { replace: true });
        return;
      }

      const response = await registerOperator({
        username,
        password: form.password,
        role: form.role,
      });

      navigateToMode('login', {
        authStatusType: 'success',
        authStatusMessage:
          response.message ||
          'Account created successfully. Sign in to continue.',
        prefillUsername: username,
      });
    } catch (requestError) {
      setStatus({
        type: 'error',
        message:
          requestError.message ||
          'Authentication request failed. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="auth-page">
      <div className={`auth-wrapper ${mode === 'register' ? 'panel-active' : ''}`}>
        <section className="auth-form-box register-form-box">
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-form__brand">
              <img alt="Sentinel AI logo" className="auth-form__logo" src={brandMark} />
              <span>Sentinel AI</span>
            </div>

            <h1>Create Account</h1>
            <p className="auth-form__subtitle">
              Set up secure access for the financial fraud platform. Analyst requests begin with Viewer access until approval.
            </p>

            <div className="auth-role-grid" role="radiogroup" aria-label="Choose an account role">
              {roleCards.map((role) => {
                const Icon = role.icon;
                const isSelected = form.role === role.value;

                return (
                  <button
                    key={role.value}
                    aria-pressed={isSelected}
                    className={`auth-role-card ${isSelected ? 'auth-role-card--selected' : ''}`}
                    onClick={() => {
                      clearStatus();
                      setForm((previous) => ({ ...previous, role: role.value }));
                    }}
                    type="button"
                  >
                    <span className={`auth-role-card__pill ${isSelected ? 'auth-role-card__pill--selected' : ''}`}>
                      {role.title}
                    </span>
                    <span className="auth-role-card__icon">
                      <Icon size={22} />
                    </span>
                    <strong>{role.title}</strong>
                    <span className="auth-role-card__helper">{role.helper}</span>
                  </button>
                );
              })}
            </div>

            <label className="auth-form__label" htmlFor="register-username">
              Username
            </label>
            <input
              id="register-username"
              autoComplete="username"
              className="auth-form__input"
              name="username"
              onChange={updateField}
              placeholder="Enter a username"
              value={form.username}
            />

            <label className="auth-form__label" htmlFor="register-password">
              Password
            </label>
            <div className="auth-form__password">
              <input
                id="register-password"
                autoComplete="new-password"
                className="auth-form__input"
                name="password"
                onChange={updateField}
                placeholder="Create a password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="auth-form__password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {status.message ? (
              <div className={`auth-form__alert auth-form__alert--${status.type === 'success' ? 'success' : 'danger'}`}>
                {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{status.message}</span>
              </div>
            ) : null}

            <button className="auth-form__submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? <Loader2 className="auth-form__spinner spinning" size={18} /> : null}
              <span>{isSubmitting ? 'Submitting...' : form.role === 'Analyst' ? 'Request Access' : 'Create Account'}</span>
            </button>

            <div className="mobile-switch">
              <p>Already have an account?</p>
              <button onClick={() => navigateToMode('login')} type="button">
                Sign In
              </button>
            </div>
          </form>
        </section>

        <section className="auth-form-box login-form-box">
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-form__brand">
              <img alt="Sentinel AI logo" className="auth-form__logo" src={brandMark} />
              <span>Sentinel AI</span>
            </div>

            <h1>Sign In</h1>
            <p className="auth-form__subtitle">
              Use your existing credentials to continue into the right workspace and resume your investigation.
            </p>

            <label className="auth-form__label" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              autoComplete="username"
              className="auth-form__input"
              name="username"
              onChange={updateField}
              placeholder="Enter your username"
              value={form.username}
            />

            <label className="auth-form__label" htmlFor="login-password">
              Password
            </label>
            <div className="auth-form__password">
              <input
                id="login-password"
                autoComplete="current-password"
                className="auth-form__input"
                name="password"
                onChange={updateField}
                placeholder="Enter your password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="auth-form__password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {status.message ? (
              <div className={`auth-form__alert auth-form__alert--${status.type === 'success' ? 'success' : 'danger'}`}>
                {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{status.message}</span>
              </div>
            ) : null}

            <button className="auth-form__submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? <Loader2 className="auth-form__spinner spinning" size={18} /> : null}
              <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
            </button>

            <div className="mobile-switch">
              <p>Need an account?</p>
              <button onClick={() => navigateToMode('register')} type="button">
                Sign Up
              </button>
            </div>
          </form>
        </section>

        <aside className="slide-panel-wrapper" aria-hidden="true">
          <div className="slide-panel">
            <div className="panel-content panel-content-left">
              <img alt="Sentinel AI logo" className="panel-content__logo" src={brandMark} />
              <h2>Welcome Back</h2>
              <p>
                Sign in to reopen your dashboards, monitoring flows, and recent fraud investigations without losing context.
              </p>
              <button className="transparent-btn" onClick={() => navigateToMode('login')} type="button">
                Sign In
              </button>
            </div>

            <div className="panel-content panel-content-right">
              <img alt="Sentinel AI logo" className="panel-content__logo" src={brandMark} />
              <h2>Build Your Access</h2>
              <p>
                Create a Viewer, Analyst, or Admin account with the same polished access flow as your SentinelAI reference.
              </p>
              <button className="transparent-btn" onClick={() => navigateToMode('register')} type="button">
                Sign Up
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Auth;
