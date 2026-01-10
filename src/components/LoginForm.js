import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function LoginForm() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
    } catch (error) {
      console.error('Error signing in:', error);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>⏰ Welcome to TimeLeft Reconnect</h1>
          <p>Join other TimeLeft members and reconnect at your table!</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="login-options">
          <div className="login-option">
            <h3>Sign in with Google</h3>
            <p>Use your Google account for a personalized experience</p>
            <button 
              className="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? 'Signing in...' : '🔐 Sign in with Google'}
            </button>
          </div>
        </div>

        <div className="login-footer">
          <p>
            Once you enter, you'll be assigned to a table where you can reconnect with other TimeLeft members.
            You can update your profile and preferences later.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;