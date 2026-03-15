import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, where, increment, arrayUnion, arrayRemove, runTransaction
} from 'firebase/firestore';
import { EVENT_TYPES, BOOKING_STATUS, createEvent, createBooking } from '../models';

const EVENT_TYPE_LABELS = {
  dinner: '🍽️ Dinner',
  breakfast: '☀️ Breakfast',
  lunch: '🌤️ Lunch',
  movie_night: '🎬 Movie Night',
  paddle: '🏓 Paddle',
  soiree: '✨ Soirée',
  coffee_meetup: '☕ Coffee Meetup',
  library_meetup: '📚 Library Meetup',
};

const CURRENCIES = ['EGP', 'USD', 'EUR'];

export default function EventsScreen() {
  const { t } = useTranslation();
  const { currentUser, userProfile, isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [myBookings, setMyBookings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(null);
  const [message, setMessage] = useState('');

  // Can the current user create events?
  const canCreate = currentUser && userProfile;

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    type: 'dinner',
    locality: '',       // Public-facing administrative area
    locationName: '',   // Internal venue (hidden from public)
    dateTime: '',
    maxAttendees: '',   // Optional
    price: 0,
    currency: 'EGP',
  });

  // Load events: admins see all; others see published + their own pending_approval
  useEffect(() => {
    let q;
    if (isAdmin()) {
      q = query(
        collection(db, 'events'),
        orderBy('dateTime', 'asc')
      );
    } else {
      q = query(
        collection(db, 'events'),
        where('status', '==', 'published'),
        orderBy('dateTime', 'asc')
      );
    }
    const unsub = onSnapshot(q, (snap) => {
      let evts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Non-admins can also see their own pending_approval events
      if (!isAdmin() && currentUser) {
        // They're already filtered to published by query; fetch own pending separately below
      }
      setEvents(evts);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [isAdmin, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also load current user's own pending_approval events (non-admins)
  const [myPendingEvents, setMyPendingEvents] = useState([]);
  useEffect(() => {
    if (!currentUser || isAdmin()) return;
    const q = query(
      collection(db, 'events'),
      where('createdBy', '==', currentUser.uid),
      where('status', '==', 'pending_approval')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMyPendingEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, [currentUser, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load current user's bookings
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const bmap = {};
      snap.docs.forEach(d => { bmap[d.data().eventId] = { id: d.id, ...d.data() }; });
      setMyBookings(bmap);
    });
    return unsub;
  }, [currentUser]);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleBookEvent = async (event) => {
    if (!currentUser) return;
    if (userProfile?.isBlocked) {
      showMessage('Your account is blocked. You cannot book events.');
      return;
    }
    const existing = myBookings[event.id];
    if (existing && existing.status === BOOKING_STATUS.CONFIRMED) {
      showMessage(t('bookingConfirmed') + ' ✅');
      return;
    }
    setBookingLoading(event.id);
    try {
      const bookingData = createBooking({
        userId: currentUser.uid,
        eventId: event.id,
        status: BOOKING_STATUS.CONFIRMED,
        amountPaid: event.price || 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
      delete bookingData.id;

      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'events', event.id);
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists()) throw new Error('Event not found');
        const data = eventSnap.data();
        const current = data.currentAttendees || 0;
        const max = data.maxAttendees;
        if (max && current >= max) throw new Error('Event is fully booked');
        transaction.update(eventRef, {
          currentAttendees: increment(1),
          attendeeIds: arrayUnion(currentUser.uid),
          lastUpdated: new Date().toISOString(),
        });
      });

      await addDoc(collection(db, 'bookings'), bookingData);
      showMessage(t('bookingSuccess'));
    } catch (err) {
      console.error('Booking error:', err);
      if (err.message === 'Event is fully booked') {
        showMessage(t('fullyBooked'));
      } else {
        showMessage(t('errorBooking'));
      }
    } finally {
      setBookingLoading(null);
    }
  };

  const handleCancelBooking = async (event) => {
    const booking = myBookings[event.id];
    if (!booking) return;
    setBookingLoading(event.id);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: BOOKING_STATUS.CANCELLED,
        lastUpdated: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'events', event.id), {
        currentAttendees: increment(-1),
        attendeeIds: arrayRemove(currentUser.uid),
        lastUpdated: new Date().toISOString(),
      });
      showMessage(t('bookingCancel'));
    } catch (err) {
      console.error('Cancel error:', err);
      showMessage(t('errorGeneral'));
    } finally {
      setBookingLoading(null);
    }
  };

  const handleDeleteEvent = async (event) => {
    if (!window.confirm(t('eventDelete') + '?')) return;
    try {
      await deleteDoc(doc(db, 'events', event.id));
      showMessage(t('eventDelete') + ' ✅');
    } catch (err) {
      console.error('Delete event error:', err);
      showMessage(t('errorGeneral'));
    }
  };

  const handleApproveEvent = async (event) => {
    try {
      await updateDoc(doc(db, 'events', event.id), {
        status: 'published',
        lastUpdated: new Date().toISOString(),
      });
      showMessage(t('eventPublish') + ' ✅');
    } catch (err) {
      console.error('Approve event error:', err);
      showMessage(t('errorGeneral'));
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const isFriend = !isAdmin();
      const eventStatus = isFriend ? 'pending_approval' : 'published';

      const eventData = createEvent({
        ...newEvent,
        price: Number(newEvent.price),
        maxAttendees: newEvent.maxAttendees ? Number(newEvent.maxAttendees) : null,
        dateTime: newEvent.dateTime ? new Date(newEvent.dateTime).toISOString() : '',
        status: eventStatus,
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        // Store venue separately; it is internal and not displayed publicly
        venueLocation: newEvent.locationName,
        locationName: newEvent.locality || newEvent.locationName,
        locality: newEvent.locality,
        locationRevealed: false,
      });
      delete eventData.id;

      await addDoc(collection(db, 'events'), eventData);
      setShowCreateForm(false);
      setNewEvent({
        title: '', description: '', type: 'dinner',
        locality: '', locationName: '', dateTime: '',
        maxAttendees: '', price: 0, currency: 'EGP',
      });
      showMessage(isFriend ? t('eventPendingApproval') : t('eventPublish'));
    } catch (err) {
      console.error('Create event error:', err);
      showMessage(t('errorGeneral'));
    }
  };

  const spotsLeft = (event) => {
    if (!event.maxAttendees) return null;
    return event.maxAttendees - (event.currentAttendees || 0);
  };

  const getBookingStatus = (eventId) => myBookings[eventId]?.status;

  /** Venue display: only reveal to admins; others see locality or generic message */
  const getLocationDisplay = (event) => {
    if (isAdmin()) {
      return event.venueLocation || event.locationName || '—';
    }
    if (event.locationRevealed) {
      return event.locationName || '—';
    }
    return event.locality || t('eventVenueHidden');
  };

  // Combine published events + own pending events for non-admins
  const allVisibleEvents = isAdmin()
    ? events
    : [
        ...events,
        ...myPendingEvents.filter(pe => !events.some(e => e.id === pe.id)),
      ];

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="events-screen">
      <div className="events-header">
        <h2>{t('eventBrowse')}</h2>
        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? `✕ ${t('eventCancel')}` : `+ ${t('eventCreate')}`}
          </button>
        )}
      </div>

      {message && <div className="message-banner">{message}</div>}

      {/* Create Event Form */}
      {showCreateForm && canCreate && (
        <div className="card create-event-form">
          <h3>{t('eventCreate')}</h3>
          {!isAdmin() && (
            <p className="info-note">📋 {t('eventApprovalNote')}</p>
          )}
          <form onSubmit={handleCreateEvent}>
            <div className="form-group">
              <label>{t('eventType')}</label>
              <select
                value={newEvent.type}
                onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}
              >
                {EVENT_TYPES.map(type => (
                  <option key={type} value={type}>
                    {EVENT_TYPE_LABELS[type] || type}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('eventTitle')}</label>
              <input
                type="text"
                required
                value={newEvent.title}
                onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Friday Movie Night"
              />
            </div>
            <div className="form-group">
              <label>{t('eventDescription')}</label>
              <textarea
                value={newEvent.description}
                onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Describe the event..."
              />
            </div>
            <div className="form-group">
              <label>{t('eventLocation')}</label>
              <input
                type="text"
                value={newEvent.locality}
                onChange={e => setNewEvent(p => ({ ...p, locality: e.target.value }))}
                placeholder="e.g. Egypt → Cairo → New Cairo"
              />
              <small>{t('eventVenueNote')}</small>
            </div>
            <div className="form-group">
              <label>{t('eventVenue')}</label>
              <input
                type="text"
                value={newEvent.locationName}
                onChange={e => setNewEvent(p => ({ ...p, locationName: e.target.value }))}
                placeholder="e.g. Cinema ABC (internal only)"
              />
              <small className="venue-note">🔒 {t('eventVenueNote')}</small>
            </div>
            <div className="form-group">
              <label>{t('eventDate')}</label>
              <input
                type="datetime-local"
                required
                value={newEvent.dateTime}
                onChange={e => setNewEvent(p => ({ ...p, dateTime: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('eventMaxAttendees')}</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={newEvent.maxAttendees}
                  onChange={e => setNewEvent(p => ({ ...p, maxAttendees: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label>{t('eventPrice')}</label>
                <div className="price-currency-row">
                  <input
                    type="number"
                    min="0"
                    value={newEvent.price}
                    onChange={e => setNewEvent(p => ({ ...p, price: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <select
                    value={newEvent.currency}
                    onChange={e => setNewEvent(p => ({ ...p, currency: e.target.value }))}
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {isAdmin() ? t('eventPublish') : t('eventSubmitApproval')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events List */}
      {allVisibleEvents.length === 0 ? (
        <div className="empty-state">
          <p>{t('noEvents')}</p>
        </div>
      ) : (
        <div className="events-grid">
          {allVisibleEvents.map(event => {
            const left = spotsLeft(event);
            const bookingStatus = getBookingStatus(event.id);
            const isBooked = bookingStatus === BOOKING_STATUS.CONFIRMED;
            const isFull = left !== null && left <= 0;
            const isPending = event.status === 'pending_approval';
            const isOwner = event.createdBy === currentUser?.uid;

            return (
              <div key={event.id} className={`event-card card ${isPending ? 'event-pending' : ''}`}>
                <div className="event-type-badge">
                  {EVENT_TYPE_LABELS[event.type] || event.type}
                </div>
                {isPending && (
                  <div className="pending-badge">⏳ {t('eventPendingApproval')}</div>
                )}
                <h3>{event.title}</h3>
                <p className="event-description">{event.description}</p>
                <div className="event-meta">
                  <span className="event-meta-item">
                    📍 {getLocationDisplay(event)}
                  </span>
                  <span className="event-meta-item">
                    📅 {event.dateTime ? new Date(event.dateTime).toLocaleString() : ''}
                  </span>
                  {left !== null && (
                    <span className="event-meta-item">
                      👥 {isFull ? t('fullyBooked') : t('spotsLeft', { count: left })}
                    </span>
                  )}
                  <span className="event-meta-item">
                    💰 {event.price === 0 ? t('eventFree') : `${event.price} ${event.currency}`}
                  </span>
                  {isAdmin() && (
                    <span className="event-meta-item">
                      🎟️ {t('eventAttendeesCount', { count: event.currentAttendees || 0 })}
                    </span>
                  )}
                </div>

                <div className="event-actions">
                  {/* Admin actions */}
                  {isAdmin() && isPending && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleApproveEvent(event)}
                    >
                      ✅ {t('approvals')}
                    </button>
                  )}
                  {(isAdmin() || isOwner) && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteEvent(event)}
                    >
                      🗑️ {t('eventDelete')}
                    </button>
                  )}

                  {/* Booking actions (only for published events) */}
                  {!isPending && (
                    isBooked ? (
                      <>
                        <span className="booking-confirmed-badge">✅ {t('bookingConfirmed')}</span>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCancelBooking(event)}
                          disabled={bookingLoading === event.id}
                        >
                          {t('cancelBooking')}
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleBookEvent(event)}
                        disabled={isFull || bookingLoading === event.id || userProfile?.isBlocked}
                      >
                        {bookingLoading === event.id ? '...' : isFull ? t('fullyBooked') : t('bookEvent')}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
