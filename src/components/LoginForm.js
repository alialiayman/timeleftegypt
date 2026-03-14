import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

function LoginForm() {
  const { signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
    } catch (err) {
      console.error('Error signing in:', err);
      setError(t('errorAuth'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🌟 {t('appName')}</h1>
          <p>{t('signInTagline')}</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="login-options">
          <div className="login-option">
            <h3>{t('signIn')}</h3>
            <button
              className="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? t('loading') : `🔐 ${t('signInWithGoogle')}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
