import React, { useState } from 'react';
import Illustration from '../components/Illustration';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-card">
        <div className="auth-illustration">
          <Illustration name="welcome" size={150} />
        </div>
        <div className="auth-header">
          <h2>Welcome back</h2>
          <p className="auth-subheader">Sign in to your planner</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="text-error" style={{ marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="input-control"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch-text">
          <Link to="/forgot-password" className="auth-switch-link">Forgot password?</Link>
        </p>

        <p className="auth-switch-text">
          Don't have an account?
          <Link to="/signup" className="auth-switch-link">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
