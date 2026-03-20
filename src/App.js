import React, { useEffect, useState } from 'react';
import './App.css';
import './i18n';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import LegalPage from './components/LegalPage';
import Dashboard from './components/Dashboard';
import UserProfile from './components/UserProfile';
import AdminPanel from './components/AdminPanel';
import SuperAdminPanel from './components/SuperAdminPanel';
import EventsScreen from './components/EventsScreen';

const getLegalTypeFromPath = (pathname) => {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/privacy-policy' || normalized === '/privacy') return 'privacy';
  if (normalized === '/terms-of-service' || normalized === '/terms') return 'terms';
  return null;
};

function AppContent() {
  const { currentUser, userProfile, loading, isAdmin, isSuperAdmin, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] = useState('dashboard');
  const [legalType, setLegalType] = useState(() => getLegalTypeFromPath(window.location.pathname));

  useEffect(() => {
    const onNavigation = () => setLegalType(getLegalTypeFromPath(window.location.pathname));
    window.addEventListener('popstate', onNavigation);
    return () => window.removeEventListener('popstate', onNavigation);
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  /** Returns the display-role string based on priority: Super Admin > Admin > Friend */
  const getDisplayRole = () => {
    const role = userProfile?.role;
    if (role === 'super-admin' || role === 'super_admin') return t('roleSuperAdmin');
    if (role === 'admin' || role === 'event_admin') return t('roleAdmin');
    return t('roleFriend');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (legalType) {
    return <LegalPage type={legalType} />;
  }

  if (!currentUser) {
    return <LandingPage />;
  }

  if (!userProfile) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{t('loadingProfile')}</p>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'profile':
        return <UserProfile onBack={() => setCurrentView('dashboard')} />;
      case 'admin':
        return isAdmin() ?
          <AdminPanel onBack={() => setCurrentView('dashboard')} /> :
          <Dashboard setCurrentView={setCurrentView} onSignOut={logout} />;
      case 'superAdmin':
        return isSuperAdmin() ?
          <SuperAdminPanel onBack={() => setCurrentView('dashboard')} /> :
          <Dashboard setCurrentView={setCurrentView} onSignOut={logout} />;
      case 'events':
        return <EventsScreen setCurrentView={setCurrentView} />;
      default:
        return <Dashboard setCurrentView={setCurrentView} onSignOut={logout} />;
    }
  };

  const displayName = userProfile?.displayName || userProfile?.name || 'User';

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>🌟 {t('appName')}</h1>
          <div className="header-user">
            <span className="header-greeting">
              {t('welcomeRole', { role: getDisplayRole(), name: displayName })}
            </span>
            <nav className="header-nav">
              <button
                className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentView('dashboard')}
              >
                {t('dashboard')}
              </button>
              <button
                className={`nav-btn ${currentView === 'events' ? 'active' : ''}`}
                onClick={() => setCurrentView('events')}
              >
                {t('events')}
              </button>
              <button
                className={`nav-btn ${currentView === 'profile' ? 'active' : ''}`}
                onClick={() => setCurrentView('profile')}
              >
                {t('profile')}
              </button>
              {isAdmin() && (
                <button
                  className={`nav-btn ${currentView === 'admin' ? 'active' : ''}`}
                  onClick={() => setCurrentView('admin')}
                >
                  {t('admin')}
                </button>
              )}
              {isSuperAdmin() && (
                <button
                  className={`nav-btn nav-btn-super ${currentView === 'superAdmin' ? 'active' : ''}`}
                  onClick={() => setCurrentView('superAdmin')}
                >
                  {t('superAdmin')}
                </button>
              )}
              <button className="nav-btn lang-btn" onClick={toggleLanguage}>
                {i18n.language === 'en' ? 'عربي' : 'EN'}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="app-main">
        {renderCurrentView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

