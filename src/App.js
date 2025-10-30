import React, { useState } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import UserProfile from './components/UserProfile';
import AdminPanel from './components/AdminPanel';

function AppContent() {
  const { currentUser, userProfile, loading, isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginForm />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'profile':
        return <UserProfile onBack={() => setCurrentView('dashboard')} />;
      case 'admin':
        return isAdmin() ? 
          <AdminPanel onBack={() => setCurrentView('dashboard')} /> :
          <Dashboard setCurrentView={setCurrentView} />;
      default:
        return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>🍽️ Dining Table Assignment</h1>
          <div className="header-user">
            <span>Welcome, {userProfile?.displayName || userProfile?.name || 'User'}!</span>
            <nav className="header-nav">
              <button 
                className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentView('dashboard')}
              >
                Dashboard
              </button>
              <button 
                className={`nav-btn ${currentView === 'profile' ? 'active' : ''}`}
                onClick={() => setCurrentView('profile')}
              >
                Profile
              </button>
              {isAdmin() && (
                <button 
                  className={`nav-btn ${currentView === 'admin' ? 'active' : ''}`}
                  onClick={() => setCurrentView('admin')}
                >
                  Admin
                </button>
              )}
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
