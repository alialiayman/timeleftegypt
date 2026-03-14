import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, doc, where, increment, arrayUnion, arrayRemove, runTransaction
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

export default function EventsScreen() {
  const { t } = useTranslation();
  const { currentUser, isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [myBookings, setMyBookings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(null);
  const [message, setMessage] = useState('');

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    type: 'dinner',
    locationName: '',
    dateTime: '',
    maxAttendees: 20,
    price: 0,
    currency: 'EGP',
  });

  // Load published events — single where clause to avoid composite index requirement
  useEffect(() => {
    const q = query(
      collection(db, 'events'),
      where('status', '==', 'published'),
      orderBy('dateTime', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const evts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(evts);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

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
    const existing = myBookings[event.id];
    if (existing && existing.status === BOOKING_STATUS.CONFIRMED) {
      showMessage('Already booked! ✅');
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

      // Use Firestore transaction for atomic capacity check + increment
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'events', event.id);
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists()) throw new Error('Event not found');
        const data = eventSnap.data();
        const current = data.currentAttendees || 0;
        const max = data.maxAttendees || 0;
        if (current >= max) throw new Error('Event is fully booked');
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
      // Use atomic decrement and array remove to avoid race conditions
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

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const eventData = createEvent({
        ...newEvent,
        price: Number(newEvent.price),
        maxAttendees: Number(newEvent.maxAttendees),
        // Convert datetime-local string to ISO 8601 with timezone
        dateTime: newEvent.dateTime ? new Date(newEvent.dateTime).toISOString() : '',
        status: 'published',
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
      delete eventData.id;

      await addDoc(collection(db, 'events'), eventData);
      setShowCreateForm(false);
      setNewEvent({
        title: '', description: '', type: 'dinner',
        locationName: '', dateTime: '', maxAttendees: 20, price: 0, currency: 'EGP',
      });
      showMessage('Event created!');
    } catch (err) {
      console.error('Create event error:', err);
      showMessage(t('errorGeneral'));
    }
  };

  const spotsLeft = (event) => (event.maxAttendees || 0) - (event.currentAttendees || 0);

  const getBookingStatus = (eventId) => myBookings[eventId]?.status;

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
        {isAdmin() && (
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? '✕ Cancel' : `+ ${t('eventCreate')}`}
          </button>
        )}
      </div>

      {message && <div className="message-banner">{message}</div>}

      {/* Admin Create Event Form */}
      {showCreateForm && isAdmin() && (
        <div className="card create-event-form">
          <h3>{t('eventCreate')}</h3>
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
                required
                value={newEvent.locationName}
                onChange={e => setNewEvent(p => ({ ...p, locationName: e.target.value }))}
                placeholder="Venue name or area"
              />
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
                  max="500"
                  value={newEvent.maxAttendees}
                  onChange={e => setNewEvent(p => ({ ...p, maxAttendees: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>{t('eventPrice')} (EGP)</label>
                <input
                  type="number"
                  min="0"
                  value={newEvent.price}
                  onChange={e => setNewEvent(p => ({ ...p, price: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {t('eventPublish')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div className="empty-state">
          <p>{t('noEvents')}</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(event => {
            const left = spotsLeft(event);
            const bookingStatus = getBookingStatus(event.id);
            const isBooked = bookingStatus === BOOKING_STATUS.CONFIRMED;
            const isFull = left <= 0;

            return (
              <div key={event.id} className="event-card card">
                <div className="event-type-badge">
                  {EVENT_TYPE_LABELS[event.type] || event.type}
                </div>
                <h3>{event.title}</h3>
                <p className="event-description">{event.description}</p>
                <div className="event-meta">
                  <span className="event-meta-item">
                    📍 {event.locationName}
                  </span>
                  <span className="event-meta-item">
                    📅 {event.dateTime ? new Date(event.dateTime).toLocaleString() : ''}
                  </span>
                  <span className="event-meta-item">
                    👥 {isFull ? t('fullyBooked') : t('spotsLeft', { count: left })}
                  </span>
                  <span className="event-meta-item">
                    💰 {event.price === 0 ? t('eventFree') : `${event.price} ${event.currency}`}
                  </span>
                </div>

                <div className="event-actions">
                  {isBooked ? (
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
                      disabled={isFull || bookingLoading === event.id}
                    >
                      {bookingLoading === event.id ? '...' : t('bookEvent')}
                    </button>
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
