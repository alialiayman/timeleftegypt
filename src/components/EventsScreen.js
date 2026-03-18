import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, where, increment,
  arrayUnion, arrayRemove, runTransaction, getDocs, documentId
} from 'firebase/firestore';
import { EVENT_TYPES, BOOKING_STATUS, createEvent, createBooking } from '../models';
import { notifyLocalityMembersOfEvent } from '../services/emailService';

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
  const { currentUser, userProfile, isAdmin, isSuperAdmin } = useAuth();
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

  // Booked friends for event owner view
  const [bookedFriends, setBookedFriends] = useState([]);
  const [bookedFriendsLoading, setBookedFriendsLoading] = useState(false);

  // Presence/late status loading
  const [presenceLoading, setPresenceLoading] = useState(false);
  const isDev = process.env.NODE_ENV !== 'production';

  const canCreate = !!(currentUser && userProfile);

  // For organizers (admins), locality is derived from Master assignment
  const organizerLocality = userProfile?.organizerLocalityLabel || userProfile?.organizerLocalityId || '';

  const [newEvent, setNewEvent] = useState({
    title: '', description: '', type: 'dinner',
    locality: '', dateTime: '',
    maxAttendees: '', price: 0, currency: 'EGP',
  });

  // When the create form is opened, pre-populate locality:
  // - For organizers: from their Master-assigned locality
  // - For friends: from their profile locality
  useEffect(() => {
    if (!showCreateForm) return;
    if (isAdmin() && organizerLocality) {
      setNewEvent(prev => ({ ...prev, locality: organizerLocality }));
    } else if (!isAdmin()) {
      const friendLocality = userProfile?.localityLabel || userProfile?.localityId || '';
      const friendLocalityId = userProfile?.localityId || '';
      if (friendLocality) {
        setNewEvent(prev => ({ ...prev, locality: friendLocality, localityId: friendLocalityId }));
      }
    }
  }, [showCreateForm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load events
  useEffect(() => {
    let q;
    if (isAdmin()) {
      q = query(collection(db, 'events'), orderBy('dateTime', 'asc'));
    } else {
      // Avoid a composite where+orderBy query that requires a manual Firestore index.
      // Single-field equality queries are auto-indexed; sorting is done client-side.
      const userLocalityId = userProfile?.localityId || '';
      q = userLocalityId
        ? query(collection(db, 'events'), where('localityId', '==', userLocalityId))
        : query(collection(db, 'events'), where('status', '==', 'published'));
    }
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ad = a?.dateTime || '';
        const bd = b?.dateTime || '';
        return ad > bd ? 1 : -1;
      });
      setEvents(list);
      setLoading(false);
    }, (err) => {
      console.error('Error loading events:', err);
      setLoading(false);
    });
    return unsub;
  }, [isAdmin, currentUser, userProfile?.localityId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Load booked friends when an event owner opens the event detail
  useEffect(() => {
    if (!selectedEvent || !currentUser) return;
    const isOwner = selectedEvent.createdBy === currentUser.uid;
    if (!isOwner && !isSuperAdmin()) return;

    setBookedFriendsLoading(true);
    const q = query(
      collection(db, 'bookings'),
      where('eventId', '==', selectedEvent.id),
      where('status', '==', BOOKING_STATUS.CONFIRMED)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const userIds = [...new Set(bookings.map(b => b.userId).filter(uid => uid !== currentUser.uid))];
      if (userIds.length === 0) {
        setBookedFriends([]);
        setBookedFriendsLoading(false);
        return;
      }
      try {
        const friends = [];
        for (let i = 0; i < userIds.length; i += 10) {
          const batch = userIds.slice(i, i + 10);
          const snap2 = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', batch)));
          snap2.docs.forEach(d => {
            const booking = bookings.find(b => b.userId === d.id);
            friends.push({ id: d.id, ...d.data(), booking });
          });
        }
        setBookedFriends(friends);
      } catch (err) {
        console.error('Error loading booked friends:', err);
      } finally {
        setBookedFriendsLoading(false);
      }
    }, () => setBookedFriendsLoading(false));
    return unsub;
  }, [selectedEvent?.id, currentUser, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Capacity overflow is allowed: bookings continue past maxAttendees.
      // The scheduler will later assign overflow attendees to additional venues.
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'events', event.id);
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists()) throw new Error('Event not found');
        transaction.update(eventRef, {
          currentAttendees: increment(1),
          attendeeIds: arrayUnion(currentUser.uid),
          lastUpdated: new Date().toISOString(),
        });
      });
      await addDoc(collection(db, 'bookings'), bookingData);
      showMessage(t('bookingSuccess'));
    } catch (err) {
      showMessage(t('errorBooking'));
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

  /* ── Presence / Late Status (friend, after venue reveal) ── */
  const handlePresenceAction = async (event, status) => {
    const booking = myBookings[event.id];
    if (!booking) return;
    setPresenceLoading(true);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        presenceStatus: status,
        lastUpdated: new Date().toISOString(),
      });
      showMessage(status === 'confirmed_present' ? t('presenceConfirmed') : t('lateMarked'));
    } catch (err) { showMessage(t('errorGeneral')); }
    finally { setPresenceLoading(false); }
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
      // For organizers, locality is always inherited from their Master-assigned locality
      const persistedLocality = isAdmin() && organizerLocality
        ? organizerLocality
        : editForm.locality;
      await updateDoc(doc(db, 'events', selectedEvent.id), {
        title: editForm.title, description: editForm.description,
        type: editForm.type, locality: persistedLocality,
        locationName: persistedLocality,
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

    // Validate: organizers must have a locality assigned
    if (isAdmin() && !organizerLocality) {
      showMessage(t('organizerNoLocality'));
      return;
    }

    // Validate: date/time must be in the future
    if (newEvent.dateTime) {
      const eventDate = new Date(newEvent.dateTime);
      if (eventDate <= new Date()) {
        showMessage(t('eventDatePast'));
        return;
      }
    }

    try {
      const isFriend = !isAdmin();

      // For organizers, always use the Master-assigned locality.
      // For friends, use their profile locality (pre-filled) or what they entered.
      const eventLocality = isAdmin()
        ? (userProfile?.organizerLocalityLabel || userProfile?.organizerLocalityId || '')
        : (newEvent.locality || userProfile?.localityLabel || '');
      const eventLocalityId = isAdmin()
        ? (userProfile?.organizerLocalityId || '')
        : (newEvent.localityId || userProfile?.localityId || '');

      const eventData = createEvent({
        ...newEvent,
        locality: eventLocality,
        localityId: eventLocalityId,
        price: Number(newEvent.price),
        maxAttendees: newEvent.maxAttendees ? Number(newEvent.maxAttendees) : null,
        dateTime: newEvent.dateTime ? new Date(newEvent.dateTime).toISOString() : '',
        status: isFriend ? 'pending_approval' : 'published',
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
        locationName: eventLocality,
        locationRevealed: false,
        schedulingCompleted: false, venueGroups: [], attendeeIds: [],
      });
      delete eventData.id;
      await addDoc(collection(db, 'events'), eventData);
      setShowCreateForm(false);
      setNewEvent({ title: '', description: '', type: 'dinner', locality: '', dateTime: '', maxAttendees: '', price: 0, currency: 'EGP' });
      showMessage(isFriend ? t('eventPendingApproval') : t('eventPublish'));

      // Email locality members when a published event is created by an organizer
      if (!isFriend && userProfile?.organizerLocalityId) {
        try {
          const membersSnap = await getDocs(
            query(
              collection(db, 'users'),
              where('localityId', '==', userProfile.organizerLocalityId)
            )
          );
          const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (members.length > 0) {
            await notifyLocalityMembersOfEvent({
              members,
              eventTitle: eventData.title,
              localityLabel: eventLocality,
              eventDateTime: eventData.dateTime,
            });
          }
        } catch (emailErr) {
          // Non-fatal: log but don't disrupt the success flow
          console.error('Failed to send locality member notifications:', emailErr);
        }
      }
    } catch (err) {
      console.error('Create event error:', err);
      showMessage(t('errorGeneral'));
    }
  };

  /* ── Helpers ── */
  const spotsLeft = (event) => event.maxAttendees ? event.maxAttendees - (event.currentAttendees || 0) : null;
  const getBookingStatus = (eventId) => myBookings[eventId]?.status;
  const getLocationDisplay = (event) => {
    if (isAdmin()) return event.locality || event.locationName || '—';
    if (event.locationRevealed) return event.locationName || '—';
    return event.locality || t('eventVenueHidden');
  };
  const getAssignedVenueGroup = (event) => {
    if (!event.venueGroups?.length || !currentUser) return null;
    return event.venueGroups.find(g => g.attendeeIds?.includes(currentUser.uid)) || null;
  };

  // For Friends (non-admin), filter published events to their own locality.
  // Match by localityId (preferred, more robust) or fall back to label comparison.
  const userLocality = !isAdmin() ? (userProfile?.localityLabel || '') : '';
  const userLocalityId = !isAdmin() ? (userProfile?.localityId || '') : '';

  const eventMatchesUserLocality = (ev) => {
    if (!userLocality && !userLocalityId) return true;
    if (userLocalityId && ev.localityId) return ev.localityId === userLocalityId;
    return !!userLocality && ev.locality === userLocality;
  };

  const allVisibleEvents = isAdmin()
    ? events
    : [
        ...events.filter(ev => eventMatchesUserLocality(ev)),
        ...myPendingEvents.filter(pe => !events.some(e => e.id === pe.id)),
      ];
  const localityMatchedPublishedCount = !isAdmin()
    ? events.filter(ev => ev.status === 'published' && eventMatchesUserLocality(ev)).length
    : 0;

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
              {isAdmin() ? (
                organizerLocality ? (
                  <>
                    <input type="text" value={organizerLocality} readOnly className="input-readonly" />
                    <small className="locality-readonly-note">📍 {t('eventLocalityReadOnly')}</small>
                  </>
                ) : (
                  <p className="info-note">⚠️ {t('organizerNoLocality')}</p>
                )
              ) : (
                <input type="text" value={editForm.locality}
                  onChange={e => setEditForm(p => ({ ...p, locality: e.target.value }))}
                  placeholder="e.g. Egypt Cairo New Cairo" />
              )}
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
    // Only event owner or Master may edit/delete; regular Organizers can view but not modify events they don't own
    const canAdminEdit = isSuperAdmin() || isOwner;
    const bookingStatus = getBookingStatus(event.id);
    const isBooked = bookingStatus === BOOKING_STATUS.CONFIRMED;
    const assignedVenue = getAssignedVenueGroup(event);
    const myBooking = myBookings[event.id];
    // isFriendView: the current user is a non-admin viewer (not the event owner either)
    const isFriendView = !isAdmin() && !isOwner;

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
              {(isOwner || isSuperAdmin()) && (
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
              {/* Organizer-only fields: hidden from Friends */}
              {!isFriendView && (
                <>
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
                </>
              )}
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
                {/* Presence/Late actions after venue reveal */}
                <div className="presence-actions">
                  <p className="presence-label">{t('presenceStatus')}:</p>
                  {myBooking?.presenceStatus === 'confirmed_present' ? (
                    <span className="presence-badge presence-badge--confirmed">✅ {t('presenceConfirmed')}</span>
                  ) : myBooking?.presenceStatus === 'going_late' ? (
                    <span className="presence-badge presence-badge--late">⏰ {t('lateMarked')}</span>
                  ) : (
                    <div className="presence-buttons">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handlePresenceAction(event, 'confirmed_present')}
                        disabled={presenceLoading}
                      >
                        {t('confirmPresence')}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePresenceAction(event, 'going_late')}
                        disabled={presenceLoading}
                      >
                        {t('markLate')}
                      </button>
                    </div>
                  )}
                </div>
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

            {/* Booked friends list — visible only to event owner or Master */}
            {(isOwner || isSuperAdmin()) && (
              <div className="booked-friends-section">
                <h3>👥 {t('bookedFriends')}</h3>
                {bookedFriendsLoading ? (
                  <div className="loading-container" style={{ height: 'auto', padding: '1rem' }}>
                    <div className="loading-spinner"></div>
                  </div>
                ) : bookedFriends.length === 0 ? (
                  <p className="empty-state-inline">{t('noBookedFriends')}</p>
                ) : (
                  <div className="booked-friends-list">
                    {bookedFriends.map(friend => (
                      <div key={friend.id} className="booked-friend-item">
                        <div className="friend-avatar">
                          {friend.photoURL
                            ? <img src={friend.photoURL} alt="" />
                            : (friend.displayName || friend.name || '?')[0].toUpperCase()
                          }
                        </div>
                        <div className="friend-info">
                          <strong>{friend.displayName || friend.name || '—'}</strong>
                          {friend.email && <small>{friend.email}</small>}
                          {friend.localityLabel && <small>📍 {friend.localityLabel}</small>}
                        </div>
                        {friend.booking?.presenceStatus && (
                          <span className={`presence-badge presence-badge--${friend.booking.presenceStatus === 'confirmed_present' ? 'confirmed' : 'late'}`}>
                            {friend.booking.presenceStatus === 'confirmed_present' ? '✅' : '⏰'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
                    disabled={bookingLoading === event.id || userProfile?.isBlocked}>
                    {bookingLoading === event.id ? '...' : t('bookEvent')}
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

      {!isAdmin() && isDev && (
        <div className="info-note" style={{ marginBottom: '0.75rem' }}>
          Debug: localityId={userProfile?.localityId || '—'} | localityLabel={userProfile?.localityLabel || '—'} | publishedLoaded={events.length} | localityMatchedPublished={localityMatchedPublishedCount} | visibleTotal={allVisibleEvents.length}
        </div>
      )}

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
              {isAdmin() ? (
                organizerLocality ? (
                  <>
                    <input type="text" value={organizerLocality} readOnly className="input-readonly" />
                    <small className="locality-readonly-note">📍 {t('eventLocalityReadOnly')}</small>
                  </>
                ) : (
                  <p className="info-note">⚠️ {t('organizerNoLocality')}</p>
                )
              ) : userProfile?.localityLabel ? (
                <>
                  <input type="text" value={newEvent.locality || userProfile.localityLabel} readOnly className="input-readonly" />
                  <small className="locality-readonly-note">📍 {t('eventLocalityReadOnly')}</small>
                </>
              ) : (
                <>
                  <input type="text" value={newEvent.locality}
                    onChange={e => setNewEvent(p => ({ ...p, locality: e.target.value }))}
                    placeholder="e.g. Egypt Cairo New Cairo" />
                  <small>{t('eventVenueNote')}</small>
                </>
              )}
            </div>
            <div className="form-group">
              <label>{t('eventDate')}</label>
              <input
                type="datetime-local"
                required
                value={newEvent.dateTime}
                min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                onChange={e => setNewEvent(p => ({ ...p, dateTime: e.target.value }))}
              />
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
            const isPending = event.status === 'pending_approval';
            // Spots-left info is only shown to admins; Friends see a clean card
            const showSpotsLeft = isAdmin() && left !== null;

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
                  {showSpotsLeft && (
                    <span className="event-meta-item">👥 {t('spotsLeft', { count: left })}</span>
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
