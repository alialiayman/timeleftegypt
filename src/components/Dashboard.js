import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot, getDocs, documentId
} from 'firebase/firestore';
import { BOOKING_STATUS } from '../models';
import InterestsEditor from './InterestsEditor';

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
    updateUserProfile,
  } = useAuth();

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Locality-based event discovery
  const [localityEvents, setLocalityEvents] = useState([]);
  const [localityEventsLoading, setLocalityEventsLoading] = useState(true);

  // Interests editing state
  const [interests, setInterests] = useState([]);
  const [interestsSaving, setInterestsSaving] = useState(false);
  const [interestsMessage, setInterestsMessage] = useState('');
  const isDev = process.env.NODE_ENV !== 'production';

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

      if (bookings.length === 0) {
        setUpcomingEvents([]);
        setEventsLoading(false);
        return;
      }

      const eventIds = bookings.map(b => b.eventId);
      // Batch fetch events using 'in' queries (max 10 per batch)
      const eventMap = {};
      for (let i = 0; i < eventIds.length; i += 10) {
        const batch = eventIds.slice(i, i + 10);
        const evSnap = await getDocs(
          query(collection(db, 'events'), where(documentId(), 'in', batch))
        );
        evSnap.docs.forEach(d => { eventMap[d.id] = { id: d.id, ...d.data() }; });
      }

      // Filter to upcoming, non-cancelled events
      const events = Object.values(eventMap).filter(
        ev => ev.dateTime && ev.dateTime >= now && ev.status !== 'cancelled'
      );
      events.sort((a, b) => (a.dateTime > b.dateTime ? 1 : -1));
      setUpcomingEvents(events);
      setEventsLoading(false);
    }, () => setEventsLoading(false));

    return unsub;
  }, [userProfile?.id]);

  // Load published events in the Friend's chosen locality
  useEffect(() => {
    const userLocality = userProfile?.localityLabel || '';
    const userLocalityId = userProfile?.localityId || '';
    if (!userLocality && !userLocalityId) {
      setLocalityEvents([]);
      setLocalityEventsLoading(false);
      return;
    }

    // Use a single-field equality query on localityId — Firestore auto-indexes all
    // single fields so no composite index is required. Sorting is done client-side.
    // A composite (status + dateTime) query needs a manual Firestore index and
    // fails silently when absent, showing an empty list.
    const q = userLocalityId
      ? query(collection(db, 'events'), where('localityId', '==', userLocalityId))
      : query(collection(db, 'events'), where('status', '==', 'published'));

    const unsub = onSnapshot(q, (snap) => {
      const now = new Date().toISOString();
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = all.filter(ev => {
        if (!ev.dateTime || ev.dateTime < now) return false;
        if (ev.status !== 'published') return false;
        // When querying by localityId the match is already guaranteed;
        // keep the label fallback for events that pre-date the localityId field.
        if (userLocalityId && ev.localityId) return ev.localityId === userLocalityId;
        return !!userLocality && ev.locality === userLocality;
      });
      filtered.sort((a, b) => (a.dateTime > b.dateTime ? 1 : -1));
      setLocalityEvents(filtered);
      setLocalityEventsLoading(false);
    }, (err) => {
      console.error('Error loading locality events:', err);
      setLocalityEventsLoading(false);
    });

    return unsub;
  }, [userProfile?.localityLabel, userProfile?.localityId]); // eslint-disable-line react-hooks/exhaustive-deps

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
              className="btn btn-secondary"
              onClick={() => setCurrentView('profile')}
            >
              {t('editProfile')}
            </button>
            <button className="btn btn-danger" onClick={handleLogout}>
              {t('logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Interests Section */}
      <div className="interests-section">
        <h3>{t('yourInterests')}</h3>

        <InterestsEditor
          interests={interests}
          onChange={setInterests}
        />

        <div className="interests-add-row">
          <button
            className="btn btn-primary btn-sm"
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

      {/* Events in Your Locality */}
      <div className="events-section">
        <h3>📍 {t('localityEventsTitle')}</h3>
        {isDev && (
          <div className="info-note" style={{ marginBottom: '0.75rem' }}>
            Debug: localityId={userProfile?.localityId || '—'} | localityLabel={userProfile?.localityLabel || '—'} | matchedEvents={localityEvents.length}
          </div>
        )}

        {!userProfile?.localityLabel && !userProfile?.localityId ? (
          <div className="empty-state">
            <p>{t('setLocalityPrompt')}</p>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentView('profile')}
            >
              {t('editProfile')}
            </button>
          </div>
        ) : localityEventsLoading ? (
          <div className="loading-container" style={{ height: 'auto', padding: '2rem' }}>
            <div className="loading-spinner"></div>
          </div>
        ) : localityEvents.length === 0 ? (
          <div className="empty-state">
            <p>{t('noLocalityEvents')}</p>
          </div>
        ) : (
          <div className="events-grid">
            {localityEvents.map(event => (
              <div key={event.id} className="event-card">
                <div className="event-header">
                  <div className="event-title">
                    <span className="event-emoji">
                      {EVENT_TYPE_ICONS[event.type] || '🎉'}
                    </span>
                    <h4>{event.title}</h4>
                  </div>
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
                      {event.locality || t('eventVenueHidden')}
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

                <div className="event-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setCurrentView('events')}
                  >
                    {t('eventBrowse')}
                  </button>
                </div>
              </div>
            ))}
          </div>
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
              className="btn btn-primary"
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

                {/* Assigned venue reveal for booked users */}
                {event.locationRevealed && event.venueGroups?.length > 0 && (() => {
                  const uid = userProfile?.id;
                  const assigned = event.venueGroups.find(g => Array.isArray(g.attendeeIds) && g.attendeeIds.includes(uid));
                  if (!assigned) return null;
                  return (
                    <div className="assigned-venue-card assigned-venue-card--inline">
                      <p className="assigned-venue-label">🎉 {t('yourVenue')}</p>
                      <p className="venue-name">{assigned.name}</p>
                      {assigned.address && <p className="venue-address">📍 {assigned.address}</p>}
                      {assigned.mapsLink && (
                        <a href={assigned.mapsLink} target="_blank" rel="noopener noreferrer"
                          className="btn-secondary btn-sm venue-map-link">
                          🗺️ {t('venueMapsLink')}
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
