import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, where, increment,
  arrayUnion, arrayRemove, runTransaction, getDocs
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
const DEFAULT_GROUP_SIZE = 20;

function computeGroupCount(attendeeCount) {
  if (!attendeeCount || attendeeCount <= 0) return 1;
  return Math.max(1, Math.ceil(attendeeCount / DEFAULT_GROUP_SIZE));
}

function distributeAttendees(attendeeIds, groupCount) {
  const groups = Array.from({ length: groupCount }, () => []);
  attendeeIds.forEach((uid, i) => {
    groups[i % groupCount].push(uid);
  });
  return groups;
}

export default function EventsScreen() {
  const { t } = useTranslation();
  const { currentUser, userProfile, isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [myBookings, setMyBookings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(null);
  const [message, setMessage] = useState('');

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  const [showScheduler, setShowScheduler] = useState(false);
  const [schedulerGroups, setSchedulerGroups] = useState([]);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  const canCreate = !!(currentUser && userProfile);

  const [newEvent, setNewEvent] = useState({
    title: '', description: '', type: 'dinner',
    locality: '', locationName: '', dateTime: '',
    maxAttendees: '', price: 0, currency: 'EGP',
  });

  // Load events
  useEffect(() => {
    let q;
    if (isAdmin()) {
      q = query(collection(db, 'events'), orderBy('dateTime', 'asc'));
    } else {
      q = query(
        collection(db, 'events'),
        where('status', '==', 'published'),
        orderBy('dateTime', 'asc')
      );
    }
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [isAdmin, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'bookings'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const bmap = {};
      snap.docs.forEach(d => { bmap[d.data().eventId] = { id: d.id, ...d.data() }; });
      setMyBookings(bmap);
    });
    return unsub;
  }, [currentUser]);

  // Keep selectedEvent in sync with live data
  useEffect(() => {
    if (selectedEvent) {
      const all = [...events, ...myPendingEvents];
      const updated = all.find(e => e.id === selectedEvent.id);
      if (updated) setSelectedEvent(updated);
    }
  }, [events, myPendingEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  /* ── Booking ── */
  const handleBookEvent = async (event) => {
    if (!currentUser) return;
    if (userProfile?.isBlocked) { showMessage(t('accountBlockedNote')); return; }
    const existing = myBookings[event.id];
    if (existing && existing.status === BOOKING_STATUS.CONFIRMED) {
      showMessage(t('bookingConfirmed') + ' ✅'); return;
    }
    setBookingLoading(event.id);
    try {
      const bookingData = createBooking({
        userId: currentUser.uid, eventId: event.id,
        status: BOOKING_STATUS.CONFIRMED, amountPaid: event.price || 0,
        createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
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
      if (err.message === 'Event is fully booked') showMessage(t('fullyBooked'));
      else showMessage(t('errorBooking'));
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
        status: BOOKING_STATUS.CANCELLED, lastUpdated: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'events', event.id), {
        currentAttendees: increment(-1),
        attendeeIds: arrayRemove(currentUser.uid),
        lastUpdated: new Date().toISOString(),
      });
      showMessage(t('bookingCancel'));
    } catch (err) { showMessage(t('errorGeneral')); }
    finally { setBookingLoading(null); }
  };

  /* ── Admin: Approve, Delete, Edit ── */
  const handleApproveEvent = async (event) => {
    try {
      await updateDoc(doc(db, 'events', event.id), {
        status: 'published', lastUpdated: new Date().toISOString(),
      });
      showMessage(t('eventPublish') + ' ✅');
    } catch (err) { showMessage(t('errorGeneral')); }
  };

  const handleDeleteEvent = async (event) => {
    if (!window.confirm(t('eventDelete') + '?')) return;
    try {
      await deleteDoc(doc(db, 'events', event.id));
      setSelectedEvent(null);
      showMessage(t('eventDelete') + ' ✅');
    } catch (err) { showMessage(t('errorGeneral')); }
  };

  const openEditMode = (event) => {
    setEditForm({
      title: event.title || '',
      description: event.description || '',
      type: event.type || 'dinner',
      locality: event.locality || '',
      locationName: event.venueLocation || event.locationName || '',
      dateTime: event.dateTime ? event.dateTime.slice(0, 16) : '',
      maxAttendees: event.maxAttendees || '',
      price: event.price ?? 0,
      currency: event.currency || 'EGP',
    });
    setEditMode(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      await updateDoc(doc(db, 'events', selectedEvent.id), {
        title: editForm.title, description: editForm.description,
        type: editForm.type, locality: editForm.locality,
        venueLocation: editForm.locationName, locationName: editForm.locality,
        dateTime: editForm.dateTime ? new Date(editForm.dateTime).toISOString() : selectedEvent.dateTime,
        maxAttendees: editForm.maxAttendees ? Number(editForm.maxAttendees) : null,
        price: Number(editForm.price), currency: editForm.currency,
        lastUpdated: new Date().toISOString(),
      });
      setEditMode(false);
      showMessage(t('saveEvent') + ' ✅');
    } catch (err) { showMessage(t('errorGeneral')); }
    finally { setEditLoading(false); }
  };

  /* ── Scheduler ── */
  const handleOpenScheduler = async (event) => {
    const attendeeCount = event.currentAttendees || 0;
    const groupCount = computeGroupCount(attendeeCount);
    let attendeeIds = event.attendeeIds || [];
    if (attendeeIds.length === 0 && attendeeCount > 0) {
      try {
        const snap = await getDocs(
          query(collection(db, 'bookings'),
            where('eventId', '==', event.id),
            where('status', '==', BOOKING_STATUS.CONFIRMED))
        );
        attendeeIds = snap.docs.map(d => d.data().userId);
      } catch (err) { console.error('Error loading attendees:', err); }
    }
    const distributed = distributeAttendees(attendeeIds, groupCount);
    setSchedulerGroups(distributed.map((ids, i) => ({
      id: 'group_' + (i + 1), name: '', address: '', mapsLink: '',
      attendeeIds: ids, capacity: DEFAULT_GROUP_SIZE,
    })));
    setShowScheduler(true);
  };

  const handleAddGroup = () => {
    setSchedulerGroups(prev => [...prev, {
      id: 'group_' + (prev.length + 1), name: '', address: '',
      mapsLink: '', attendeeIds: [], capacity: DEFAULT_GROUP_SIZE,
    }]);
  };

  const handleRemoveGroup = (idx) => {
    setSchedulerGroups(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      const displaced = prev[idx]?.attendeeIds || [];
      if (displaced.length > 0 && updated.length > 0) {
        displaced.forEach((uid, i) => {
          const target = i % updated.length;
          updated[target] = { ...updated[target], attendeeIds: [...updated[target].attendeeIds, uid] };
        });
      }
      return updated;
    });
  };

  const handleGroupChange = (idx, field, value) => {
    setSchedulerGroups(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  };

  const handleSaveScheduler = async () => {
    if (schedulerGroups.some(g => !g.name.trim())) {
      showMessage(t('schedulerVenueNameRequired')); return;
    }
    setSchedulerLoading(true);
    try {
      const venueGroups = schedulerGroups.map((g, i) => ({
        id: g.id || ('group_' + (i + 1)), name: g.name.trim(),
        address: g.address.trim(), mapsLink: g.mapsLink.trim(),
        attendeeIds: g.attendeeIds, capacity: g.capacity,
      }));
      await updateDoc(doc(db, 'events', selectedEvent.id), {
        venueGroups, locationRevealed: true, schedulingCompleted: true,
        lastUpdated: new Date().toISOString(),
      });
      setShowScheduler(false);
      showMessage(t('schedulerSaved'));
    } catch (err) { showMessage(t('errorGeneral')); }
    finally { setSchedulerLoading(false); }
  };

  /* ── Create Event ── */
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const isFriend = !isAdmin();
      const eventData = createEvent({
        ...newEvent,
        price: Number(newEvent.price),
        maxAttendees: newEvent.maxAttendees ? Number(newEvent.maxAttendees) : null,
        dateTime: newEvent.dateTime ? new Date(newEvent.dateTime).toISOString() : '',
        status: isFriend ? 'pending_approval' : 'published',
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
        venueLocation: newEvent.locationName, locationName: newEvent.locality,
        locality: newEvent.locality, locationRevealed: false,
        schedulingCompleted: false, venueGroups: [], attendeeIds: [],
      });
      delete eventData.id;
      await addDoc(collection(db, 'events'), eventData);
      setShowCreateForm(false);
      setNewEvent({ title: '', description: '', type: 'dinner', locality: '', locationName: '', dateTime: '', maxAttendees: '', price: 0, currency: 'EGP' });
      showMessage(isFriend ? t('eventPendingApproval') : t('eventPublish'));
    } catch (err) { showMessage(t('errorGeneral')); }
  };

  /* ── Helpers ── */
  const spotsLeft = (event) => event.maxAttendees ? event.maxAttendees - (event.currentAttendees || 0) : null;
  const getBookingStatus = (eventId) => myBookings[eventId]?.status;
  const getLocationDisplay = (event) => {
    if (isAdmin()) return event.venueLocation || event.locationName || '—';
    if (event.locationRevealed) return event.locationName || '—';
    return event.locality || t('eventVenueHidden');
  };
  const getAssignedVenueGroup = (event) => {
    if (!event.venueGroups?.length || !currentUser) return null;
    return event.venueGroups.find(g => g.attendeeIds?.includes(currentUser.uid)) || null;
  };

  const allVisibleEvents = isAdmin()
    ? events
    : [...events, ...myPendingEvents.filter(pe => !events.some(e => e.id === pe.id))];

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{t('loading')}</p>
      </div>
    );
  }

  /* ── Scheduler View ── */
  if (selectedEvent && showScheduler) {
    return (
      <div className="events-screen">
        {message && <div className="message-banner">{message}</div>}
        <div className="card scheduler-panel">
          <div className="scheduler-header">
            <h2>📅 {t('schedulerTitle')}</h2>
            <p className="scheduler-event-name">{selectedEvent.title}</p>
            <p className="scheduler-desc">{t('schedulerDesc')}</p>
            <p className="scheduler-groups-count">{t('schedulerGroupsNeeded', { count: schedulerGroups.length })}</p>
          </div>
          <div className="scheduler-groups">
            {schedulerGroups.map((group, idx) => (
              <div key={group.id} className="card scheduler-group">
                <div className="scheduler-group-header">
                  <h3>{t('schedulerVenueGroupLabel', { num: idx + 1 })}</h3>
                  <span className="scheduler-attendees-badge">{t('schedulerAttendeesAssigned', { count: group.attendeeIds.length })}</span>
                  {schedulerGroups.length > 1 && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemoveGroup(idx)}>{t('schedulerRemoveGroup')}</button>
                  )}
                </div>
                <div className="form-group">
                  <label>{t('schedulerVenueName')} *</label>
                  <input type="text" required value={group.name}
                    onChange={e => handleGroupChange(idx, 'name', e.target.value)}
                    placeholder={t('schedulerVenueNamePlaceholder')} />
                </div>
                <div className="form-group">
                  <label>{t('schedulerVenueAddress')}</label>
                  <input type="text" value={group.address}
                    onChange={e => handleGroupChange(idx, 'address', e.target.value)}
                    placeholder={t('schedulerAddressPlaceholder')} />
                </div>
                <div className="form-group">
                  <label>{t('schedulerVenueMapsLink')}</label>
                  <input type="url" value={group.mapsLink}
                    onChange={e => handleGroupChange(idx, 'mapsLink', e.target.value)}
                    placeholder="https://maps.google.com/..." />
                </div>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={handleAddGroup}>+ {t('schedulerAddGroup')}</button>
            <button className="btn btn-primary" onClick={handleSaveScheduler} disabled={schedulerLoading}>
              {schedulerLoading ? t('schedulerRunning') : t('schedulerSave')}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowScheduler(false)}>{t('schedulerCancel')}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Edit View ── */
  if (selectedEvent && editMode) {
    return (
      <div className="events-screen">
        {message && <div className="message-banner">{message}</div>}
        <div className="card create-event-form">
          <div className="events-header">
            <h2>✏️ {t('editEvent')}</h2>
            <button className="btn btn-secondary" onClick={() => setEditMode(false)}>← {t('cancelEdit')}</button>
          </div>
          <form onSubmit={handleSaveEdit}>
            <div className="form-group">
              <label>{t('eventType')}</label>
              <select value={editForm.type} onChange={e => setEditForm(p => ({ ...p, type: e.target.value }))}>
                {EVENT_TYPES.map(type => <option key={type} value={type}>{EVENT_TYPE_LABELS[type] || type}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t('eventTitle')}</label>
              <input type="text" required value={editForm.title}
                onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('eventDescription')}</label>
              <textarea value={editForm.description} rows={3}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>{t('eventLocation')}</label>
              <input type="text" value={editForm.locality}
                onChange={e => setEditForm(p => ({ ...p, locality: e.target.value }))}
                placeholder="e.g. Egypt Cairo New Cairo" />
            </div>
            <div className="form-group">
              <label>{t('eventVenue')}</label>
              <input type="text" value={editForm.locationName}
                onChange={e => setEditForm(p => ({ ...p, locationName: e.target.value }))}
                placeholder="e.g. Cinema ABC (internal only)" />
            </div>
            <div className="form-group">
              <label>{t('eventDate')}</label>
              <input type="datetime-local" required value={editForm.dateTime}
                onChange={e => setEditForm(p => ({ ...p, dateTime: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('eventMaxAttendees')}</label>
                <input type="number" min="1" value={editForm.maxAttendees}
                  onChange={e => setEditForm(p => ({ ...p, maxAttendees: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('eventPrice')}</label>
                <div className="price-currency-row">
                  <input type="number" min="0" value={editForm.price} style={{ flex: 1 }}
                    onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))} />
                  <select value={editForm.currency}
                    onChange={e => setEditForm(p => ({ ...p, currency: e.target.value }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={editLoading}>
                {editLoading ? '...' : t('saveEvent')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)}>{t('cancelEdit')}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ── Detail View ── */
  if (selectedEvent) {
    const event = selectedEvent;
    const isPending = event.status === 'pending_approval';
    const isOwner = event.createdBy === currentUser?.uid;
    const canAdminEdit = isAdmin() || isOwner;
    const bookingStatus = getBookingStatus(event.id);
    const isBooked = bookingStatus === BOOKING_STATUS.CONFIRMED;
    const left = spotsLeft(event);
    const isFull = left !== null && left <= 0;
    const assignedVenue = getAssignedVenueGroup(event);

    return (
      <div className="events-screen">
        {message && <div className="message-banner">{message}</div>}
        <div className="event-detail card">
          <div className="event-detail-header">
            <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)}>← {t('closeDetail')}</button>
            <div className="event-detail-actions">
              {canAdminEdit && (
                <button className="btn btn-primary btn-sm" onClick={() => openEditMode(event)}>✏️ {t('editEvent')}</button>
              )}
              {canAdminEdit && (
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteEvent(event)}>🗑️ {t('eventDelete')}</button>
              )}
              {isAdmin() && (
                <button className="btn btn-primary btn-sm" onClick={() => handleOpenScheduler(event)}>📅 {t('runScheduler')}</button>
              )}
            </div>
          </div>

          <div className="event-detail-body">
            <div className="event-type-badge event-type-badge--large">{EVENT_TYPE_LABELS[event.type] || event.type}</div>
            <h2 className="event-detail-title">{event.title}</h2>
            {event.description && <p className="event-detail-description">{event.description}</p>}

            <div className="event-detail-meta">
              <div className="detail-row">
                <span className="detail-label">📍 {t('eventLocation')}</span>
                <span className="detail-value">{getLocationDisplay(event)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">📅 {t('eventDate')}</span>
                <span className="detail-value">{event.dateTime ? new Date(event.dateTime).toLocaleString() : '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">💰 {t('eventPriceLabel')}</span>
                <span className="detail-value">{event.price === 0 ? t('eventFree') : (event.price + ' ' + event.currency)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">👥 {t('eventAttendeesLabel')}</span>
                <span className="detail-value">
                  {event.currentAttendees || 0}{event.maxAttendees ? (' / ' + event.maxAttendees) : ''}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">🔖 {t('eventApprovalStatus')}</span>
                <span className={'status-badge status-badge--' + event.status}>
                  {event.status === 'published' ? ('✅ ' + t('locationApproved'))
                    : event.status === 'pending_approval' ? ('⏳ ' + t('eventPendingApproval'))
                    : event.status === 'cancelled' ? ('❌ ' + t('bookingCancelled'))
                    : event.status}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">📋 {t('eventScheduleStatus')}</span>
                <span className={'status-badge ' + (event.schedulingCompleted ? 'status-badge--published' : 'status-badge--pending_approval')}>
                  {event.schedulingCompleted ? ('✅ ' + t('eventScheduled')) : ('⏳ ' + t('eventNotScheduled'))}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">🏠 {t('eventVenueRevealStatus')}</span>
                <span className={'status-badge ' + (event.locationRevealed ? 'status-badge--published' : 'status-badge--pending_approval')}>
                  {event.locationRevealed ? ('✅ ' + t('eventVenueRevealed')) : ('🔒 ' + t('eventVenueNotRevealed'))}
                </span>
              </div>
            </div>

            {!isAdmin() && isBooked && event.locationRevealed && assignedVenue && (
              <div className="assigned-venue-card">
                <h3>🎉 {t('yourVenue')}</h3>
                <p className="venue-name">{assignedVenue.name}</p>
                {assignedVenue.address && <p className="venue-address">📍 {assignedVenue.address}</p>}
                {assignedVenue.mapsLink && (
                  <a href={assignedVenue.mapsLink} target="_blank" rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm">🗺️ {t('venueMapsLink')}</a>
                )}
              </div>
            )}

            {isAdmin() && event.venueGroups?.length > 0 && (
              <div className="venue-groups-section">
                <h3>🏢 {t('venueDetails')}</h3>
                {event.venueGroups.map((g, i) => (
                  <div key={g.id} className="venue-group-item">
                    <strong>{t('schedulerVenueGroupLabel', { num: i + 1 })}: {g.name}</strong>
                    {g.address && <span> — {g.address}</span>}
                    <span className="attendees-count"> ({t('schedulerAttendeesAssigned', { count: g.attendeeIds?.length || 0 })})</span>
                  </div>
                ))}
              </div>
            )}

            <div className="event-detail-booking">
              {isPending && !isAdmin() && <div className="info-note">⏳ {t('eventApprovalNote')}</div>}
              {isAdmin() && isPending && (
                <button className="btn btn-primary" onClick={() => handleApproveEvent(event)}>✅ {t('approvals')}</button>
              )}
              {!isPending && !isAdmin() && (
                isBooked ? (
                  <div className="booking-confirmed-area">
                    <span className="booking-confirmed-badge">✅ {t('bookingConfirmed')}</span>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => handleCancelBooking(event)} disabled={bookingLoading === event.id}>
                      {t('cancelBooking')}
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-primary"
                    onClick={() => handleBookEvent(event)}
                    disabled={isFull || bookingLoading === event.id || userProfile?.isBlocked}>
                    {bookingLoading === event.id ? '...' : isFull ? t('fullyBooked') : t('bookEvent')}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Events List View ── */
  return (
    <div className="events-screen">
      <div className="events-header">
        <h2>{t('eventBrowse')}</h2>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? ('✕ ' + t('eventCancel')) : ('+ ' + t('eventCreate'))}
          </button>
        )}
      </div>

      {message && <div className="message-banner">{message}</div>}

      {showCreateForm && canCreate && (
        <div className="card create-event-form">
          <h3>{t('eventCreate')}</h3>
          {!isAdmin() && <p className="info-note">📋 {t('eventApprovalNote')}</p>}
          <form onSubmit={handleCreateEvent}>
            <div className="form-group">
              <label>{t('eventType')}</label>
              <select value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}>
                {EVENT_TYPES.map(type => <option key={type} value={type}>{EVENT_TYPE_LABELS[type] || type}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t('eventTitle')}</label>
              <input type="text" required value={newEvent.title}
                onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Friday Movie Night" />
            </div>
            <div className="form-group">
              <label>{t('eventDescription')}</label>
              <textarea value={newEvent.description} rows={3}
                onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe the event..." />
            </div>
            <div className="form-group">
              <label>{t('eventLocation')}</label>
              <input type="text" value={newEvent.locality}
                onChange={e => setNewEvent(p => ({ ...p, locality: e.target.value }))}
                placeholder="e.g. Egypt Cairo New Cairo" />
              <small>{t('eventVenueNote')}</small>
            </div>
            <div className="form-group">
              <label>{t('eventVenue')}</label>
              <input type="text" value={newEvent.locationName}
                onChange={e => setNewEvent(p => ({ ...p, locationName: e.target.value }))}
                placeholder="e.g. Cinema ABC (internal only)" />
              <small className="venue-note">🔒 {t('eventVenueNote')}</small>
            </div>
            <div className="form-group">
              <label>{t('eventDate')}</label>
              <input type="datetime-local" required value={newEvent.dateTime}
                onChange={e => setNewEvent(p => ({ ...p, dateTime: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('eventMaxAttendees')}</label>
                <input type="number" min="1" max="1000" value={newEvent.maxAttendees}
                  onChange={e => setNewEvent(p => ({ ...p, maxAttendees: e.target.value }))}
                  placeholder="Optional" />
              </div>
              <div className="form-group">
                <label>{t('eventPrice')}</label>
                <div className="price-currency-row">
                  <input type="number" min="0" value={newEvent.price} style={{ flex: 1 }}
                    onChange={e => setNewEvent(p => ({ ...p, price: e.target.value }))} />
                  <select value={newEvent.currency}
                    onChange={e => setNewEvent(p => ({ ...p, currency: e.target.value }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
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

            return (
              <div
                key={event.id}
                className={'event-card card' + (isPending ? ' event-pending' : '')}
                onClick={() => setSelectedEvent(event)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedEvent(event);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="event-type-badge">{EVENT_TYPE_LABELS[event.type] || event.type}</div>
                {isPending && <div className="pending-badge">⏳ {t('eventPendingApproval')}</div>}
                {isBooked && event.locationRevealed && getAssignedVenueGroup(event) && (
                  <div className="venue-revealed-badge">🎉 {t('venueAssigned')}</div>
                )}
                <h3>{event.title}</h3>
                <p className="event-description">{event.description}</p>
                <div className="event-meta">
                  <span className="event-meta-item">📍 {getLocationDisplay(event)}</span>
                  <span className="event-meta-item">📅 {event.dateTime ? new Date(event.dateTime).toLocaleString() : ''}</span>
                  {left !== null && (
                    <span className="event-meta-item">👥 {isFull ? t('fullyBooked') : t('spotsLeft', { count: left })}</span>
                  )}
                  <span className="event-meta-item">💰 {event.price === 0 ? t('eventFree') : (event.price + ' ' + event.currency)}</span>
                </div>
                <div className="event-card-footer">
                  {isBooked
                    ? <span className="booking-confirmed-badge">✅ {t('bookingConfirmed')}</span>
                    : <span className="click-hint">👆 {t('eventDetails')}</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
