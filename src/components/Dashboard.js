import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot, doc, getDoc
} from 'firebase/firestore';
import { BOOKING_STATUS } from '../models';

const EVENT_TYPE_ICONS = {
  dinner: '🍽️',
  breakfast: '☀️',
  lunch: '🌤️',
  movie_night: '🎬',
  paddle: '🏓',
  soiree: '✨',
  coffee_meetup: '☕',
  library_meetup: '📚',
};

function Dashboard({ setCurrentView }) {
  const { t } = useTranslation();
  const {
    userProfile,
    logout,
    isAdmin,
    isSuperAdmin,
    updateUserProfile,
  } = useAuth();

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Interests editing state
  const [interests, setInterests] = useState([]);
  const [interestInput, setInterestInput] = useState('');
  const [interestsSaving, setInterestsSaving] = useState(false);
  const [interestsMessage, setInterestsMessage] = useState('');
  const interestInputRef = useRef(null);

  // Sync interests from userProfile
  useEffect(() => {
    if (userProfile) {
      const raw = userProfile.preferences?.interests;
      if (Array.isArray(raw)) {
        setInterests(raw);
      } else if (typeof raw === 'string' && raw.trim()) {
        // Legacy: comma-separated string
        setInterests(raw.split(',').map(s => s.trim()).filter(Boolean));
      } else {
        setInterests([]);
      }
    }
  }, [userProfile]);

  // Load upcoming RSVP'd events
  useEffect(() => {
    if (!userProfile?.id) return;

    const bookingsQ = query(
      collection(db, 'bookings'),
      where('userId', '==', userProfile.id),
      where('status', '==', BOOKING_STATUS.CONFIRMED)
    );

    const unsub = onSnapshot(bookingsQ, async (snap) => {
      const now = new Date().toISOString();
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fetch event details for each booking
      const eventPromises = bookings.map(async (booking) => {
        try {
          const eventSnap = await getDoc(doc(db, 'events', booking.eventId));
          if (!eventSnap.exists()) return null;
          const event = { id: eventSnap.id, ...eventSnap.data() };
          // Only include upcoming events
          if (event.dateTime && event.dateTime >= now && event.status !== 'cancelled') {
            return event;
          }
          return null;
        } catch {
          return null;
        }
      });

      const events = (await Promise.all(eventPromises)).filter(Boolean);
      events.sort((a, b) => (a.dateTime > b.dateTime ? 1 : -1));
      setUpcomingEvents(events);
      setEventsLoading(false);
    }, () => setEventsLoading(false));

    return unsub;
  }, [userProfile?.id]);

  const handleLogout = async () => {
    if (window.confirm(t('logout') + '?')) {
      try {
        await logout();
      } catch (error) {
        console.error('Error during logout:', error);
      }
    }
  };

  const getLocationDisplay = () => {
    if (userProfile?.localityLabel) return `📍 ${userProfile.localityLabel}`;
    if (userProfile?.city) return `📍 ${userProfile.city}`;
    return '📍 —';
  };

  // Interests management
  const handleAddInterest = () => {
    const val = interestInput.trim();
    if (!val) return;
    if (interests.includes(val)) return;
    setInterests([...interests, val]);
    setInterestInput('');
    interestInputRef.current?.focus();
  };

  const handleRemoveInterest = (interest) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const handleInterestKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddInterest();
    }
  };

  const handleSaveInterests = async () => {
    try {
      setInterestsSaving(true);
      await updateUserProfile({
        preferences: {
          ...userProfile?.preferences,
          interests,
        },
      });
      setInterestsMessage(t('interestsSaved'));
      setTimeout(() => setInterestsMessage(''), 3000);
    } catch (err) {
      console.error('Error saving interests:', err);
    } finally {
      setInterestsSaving(false);
    }
  };

  return (
    <div className="dashboard">
      {/* Profile Header */}
      <div className="dashboard-header">
        <div className="user-info">
          <div className="user-avatar">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="Profile" />
            ) : (
              <div className="avatar-placeholder">
                {(userProfile?.displayName || userProfile?.name || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="user-details">
            <h2>{userProfile?.displayName || userProfile?.name || 'User'}</h2>
            {userProfile?.fullName && userProfile.fullName !== userProfile.displayName && (
              <p className="full-name">{userProfile.fullName}</p>
            )}
            <p className="location">{getLocationDisplay()}</p>
            {userProfile?.gender && (
              <p className="gender">{userProfile.gender}</p>
            )}
          </div>
          <div className="user-actions">
            <button
              className="btn-secondary"
              onClick={() => setCurrentView('profile')}
            >
              {t('editProfile')}
            </button>
            {isAdmin() && (
              <button
                className="btn-primary"
                onClick={() => setCurrentView('admin')}
              >
                {t('admin')}
              </button>
            )}
            {isSuperAdmin() && (
              <button
                className="btn-primary"
                onClick={() => setCurrentView('superAdmin')}
              >
                {t('superAdmin')}
              </button>
            )}
            <button className="btn-danger" onClick={handleLogout}>
              {t('logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Interests Section */}
      <div className="interests-section">
        <h3>{t('yourInterests')}</h3>

        <div className="interests-display">
          {interests.length === 0 ? (
            <p className="no-interests-msg">{t('noInterests')}</p>
          ) : (
            interests.map((interest, index) => (
              <span key={index} className="interest-badge">
                {interest}
                <button
                  className="interest-remove-btn"
                  onClick={() => handleRemoveInterest(interest)}
                  title={t('removeInterest')}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>

        <div className="interests-add-row">
          <input
            ref={interestInputRef}
            type="text"
            className="interest-input"
            value={interestInput}
            onChange={e => setInterestInput(e.target.value)}
            onKeyDown={handleInterestKeyDown}
            placeholder={t('interestPlaceholder')}
            maxLength={50}
          />
          <button
            className="btn-secondary btn-sm"
            onClick={handleAddInterest}
            disabled={!interestInput.trim()}
          >
            {t('addInterest')}
          </button>
          <button
            className="btn-primary btn-sm"
            onClick={handleSaveInterests}
            disabled={interestsSaving}
          >
            {interestsSaving ? '...' : t('saveInterests')}
          </button>
        </div>
        {interestsMessage && (
          <p className="interests-saved-msg">{interestsMessage}</p>
        )}
      </div>

      {/* Upcoming RSVP'd Events */}
      <div className="events-section">
        <h3>{t('upcomingEvents')}</h3>

        {eventsLoading ? (
          <div className="loading-container" style={{ height: 'auto', padding: '2rem' }}>
            <div className="loading-spinner"></div>
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="empty-state">
            <p>{t('noRsvpdEvents')}</p>
            <button
              className="btn-primary"
              onClick={() => setCurrentView('events')}
            >
              {t('eventBrowse')}
            </button>
          </div>
        ) : (
          <div className="events-grid">
            {upcomingEvents.map(event => (
              <div key={event.id} className="event-card booked">
                <div className="event-header">
                  <div className="event-title">
                    <span className="event-emoji">
                      {EVENT_TYPE_ICONS[event.type] || '🎉'}
                    </span>
                    <h4>{event.title}</h4>
                  </div>
                  <span className="booked-badge">✓ {t('bookingConfirmed')}</span>
                </div>

                <div className="event-details">
                  <div className="event-detail">
                    <span className="detail-icon">📅</span>
                    <span className="detail-text">
                      {event.dateTime
                        ? new Date(event.dateTime).toLocaleString()
                        : '—'}
                    </span>
                  </div>
                  <div className="event-detail">
                    <span className="detail-icon">📍</span>
                    <span className="detail-text location-tbd">
                      {event.locality || event.locationName || t('eventVenueHidden')}
                    </span>
                  </div>
                  {event.price === 0 ? (
                    <div className="event-detail">
                      <span className="detail-icon">💰</span>
                      <span className="detail-text">{t('eventFree')}</span>
                    </div>
                  ) : (
                    <div className="event-detail">
                      <span className="detail-icon">💰</span>
                      <span className="detail-text">
                        {event.price} {event.currency}
                      </span>
                    </div>
                  )}
                </div>

                {event.description && (
                  <p className="event-description">{event.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
