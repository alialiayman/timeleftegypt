import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useNativeApp } from '../contexts/NativeAppContext';

const EVENT_TYPES = [
  { key: 'dinner', label: 'Dinner' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'movie_night', label: 'Movie Night' },
  { key: 'paddle', label: 'Paddle' },
  { key: 'soiree', label: 'Soiree' },
  { key: 'coffee_meetup', label: 'Coffee Meetup' },
  { key: 'library_meetup', label: 'Library Meetup' },
];

const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

const pad2 = (n) => String(n).padStart(2, '0');

const toDateValue = (dateObj) => {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const toTimeValue = (dateObj) => {
  const d = new Date(dateObj);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const makeDefaultNewEvent = () => {
  const now = new Date();
  return {
    title: '',
    description: '',
    type: 'dinner',
    locality: '',
    address: '',
    mapUrl: '',
    date: toDateValue(now),
    time: toTimeValue(now),
    price: '0',
    currency: 'EGP',
  };
};

function EventCard({ 
  event, 
  isBooked, 
  onBook, 
  onCancel, 
  busy,
  isCreator,
  onEdit,
  onDelete,
  onRunAlgorithm,
}) {
  const eventDate = event.dateTime ? new Date(event.dateTime).toLocaleString() : '-';
  const priceLabel = Number(event.price || 0) === 0 ? 'Free' : `${event.price} ${event.currency || 'EGP'}`;

  return (
    <View style={styles.eventCard}>
      <Text style={styles.eventTitle}>{event.title || 'Untitled event'}</Text>
      <Text style={styles.eventMeta}>Type: {event.type}</Text>
      <Text style={styles.eventMeta}>Date: {eventDate}</Text>
      <Text style={styles.eventMeta}>Locality: {event.locality || '-'}</Text>
      <Text style={styles.eventMeta}>Address: {event.address || '-'}</Text>
      {event.mapUrl ? <Text style={styles.eventMeta}>Map: {event.mapUrl}</Text> : null}
      <Text style={styles.eventMeta}>Price: {priceLabel}</Text>
      {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}

      {isCreator ? (
        <View>
          <Pressable style={styles.primaryButton} onPress={() => onRunAlgorithm(event)} disabled={busy}>
            <Text style={styles.primaryButtonText}>{busy ? '...' : 'Run Match Algorithm'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => onEdit(event)} disabled={busy}>
            <Text style={styles.secondaryButtonText}>{busy ? '...' : 'Edit Event'}</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, styles.deleteButton]} onPress={() => onDelete(event)} disabled={busy}>
            <Text style={[styles.secondaryButtonText, styles.deleteButtonText]}>{busy ? '...' : 'Delete Event'}</Text>
          </Pressable>
        </View>
      ) : isBooked ? (
        <Pressable style={styles.secondaryButton} onPress={() => onCancel(event)} disabled={busy}>
          <Text style={styles.secondaryButtonText}>{busy ? '...' : 'Cancel Booking'}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.primaryButton} onPress={() => onBook(event)} disabled={busy}>
          <Text style={styles.primaryButtonText}>{busy ? '...' : 'Book Event'}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function EventsScreen() {
  const { db, currentUser, userProfile } = useNativeApp();
  const [events, setEvents] = useState([]);
  const [bookingsMap, setBookingsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyEventId, setBusyEventId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newEvent, setNewEvent] = useState(makeDefaultNewEvent());
  const [createBusy, setCreateBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editFormData, setEditFormData] = useState(makeDefaultNewEvent());
  const [editBusy, setEditBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(null);

  useEffect(() => {
    if (!db) return undefined;
    const q = query(
      collection(db, 'events'), 
      where('status', '==', 'published')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ad = a?.dateTime || '';
          const bd = b?.dateTime || '';
          return ad > bd ? 1 : -1;
        });
        setEvents(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return unsub;
  }, [db]);

  useEffect(() => {
    if (!db || !currentUser?.uid) return undefined;
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const mapped = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        mapped[data.eventId] = { id: d.id, ...data };
      });
      setBookingsMap(mapped);
    });
    return unsub;
  }, [db, currentUser?.uid]);

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(''), 2800);
    return () => clearTimeout(t);
  }, [message]);

  const organizerLocalityLabel = userProfile?.organizerLocalityLabel || '';
  const organizerLocalityId = userProfile?.organizerLocalityId || '';
  const role = userProfile?.role || '';

  const canCreate = useMemo(
    () => Boolean(
      currentUser?.uid &&
      (role === 'admin' || role === 'event_admin' || role === 'super-admin' || role === 'super_admin')
    ),
    [currentUser?.uid, role]
  );

  useEffect(() => {
    setNewEvent((prev) => ({ ...prev, locality: organizerLocalityLabel }));
  }, [organizerLocalityLabel]);

  const dateOptions = useMemo(() => {
    const base = new Date();
    const list = [];
    for (let i = 0; i < 120; i += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push({
        value: toDateValue(d),
        label: d.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      });
    }
    return list;
  }, []);

  const timeOptions = useMemo(() => {
    const list = [];
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += 15) {
        const value = `${pad2(h)}:${pad2(m)}`;
        list.push({ value, label: value });
      }
    }
    return list;
  }, []);

  const handleCreate = async () => {
    if (!db || !currentUser?.uid) return;
    if (!newEvent.title.trim() || !newEvent.date || !newEvent.time) {
      setMessage('Title and date/time are required.');
      return;
    }
    if (!organizerLocalityLabel) {
      setMessage('Organizer locality is required before creating events.');
      return;
    }
    if (newEvent.mapUrl && !/^https?:\/\//i.test(newEvent.mapUrl.trim())) {
      setMessage('Map URL must start with http:// or https://');
      return;
    }

    setCreateBusy(true);
    try {
      const when = new Date(`${newEvent.date}T${newEvent.time}:00`);
      if (Number.isNaN(when.getTime())) {
        setMessage('Please select a valid date and time.');
        setCreateBusy(false);
        return;
      }
      const payload = {
        title: newEvent.title.trim(),
        description: newEvent.description.trim(),
        type: newEvent.type,
        locality: organizerLocalityLabel,
        localityId: organizerLocalityId,
        locationName: organizerLocalityLabel,
        address: newEvent.address.trim(),
        mapUrl: newEvent.mapUrl.trim(),
        googleMapsLink: newEvent.mapUrl.trim(),
        dateTime: when.toISOString(),
        price: Number(newEvent.price || 0),
        currency: newEvent.currency || 'EGP',
        currentAttendees: 0,
        attendeeIds: [],
        status: 'published',
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      await addDoc(collection(db, 'events'), payload);
      setNewEvent({ ...makeDefaultNewEvent(), locality: organizerLocalityLabel });
      setShowCreate(false);
      setMessage('Event created.');
    } catch (error) {
      console.error('Create native event failed:', error);
      setMessage('Could not create event.');
    } finally {
      setCreateBusy(false);
    }
  };

  const handleBook = async (event) => {
    if (!db || !currentUser?.uid) return;
    setBusyEventId(event.id);
    try {
      const bookingData = {
        userId: currentUser.uid,
        eventId: event.id,
        status: BOOKING_STATUS.CONFIRMED,
        amountPaid: Number(event.price || 0),
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'events', event.id);
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists()) throw new Error('Event not found');

        transaction.update(eventRef, {
          currentAttendees: increment(1),
          attendeeIds: [...new Set([...(eventSnap.data().attendeeIds || []), currentUser.uid])],
          lastUpdated: new Date().toISOString(),
        });
      });

      await addDoc(collection(db, 'bookings'), bookingData);
      setMessage('Booking confirmed.');
    } catch (error) {
      console.error('Native booking failed:', error);
      setMessage('Could not complete booking.');
    } finally {
      setBusyEventId(null);
    }
  };

  const handleCancel = async (event) => {
    if (!db || !currentUser?.uid) return;
    const booking = bookingsMap[event.id];
    if (!booking) return;

    setBusyEventId(event.id);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: BOOKING_STATUS.CANCELLED,
        lastUpdated: new Date().toISOString(),
      });

      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'events', event.id);
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists()) return;
        const existing = eventSnap.data();
        const nextIds = (existing.attendeeIds || []).filter((uid) => uid !== currentUser.uid);

        transaction.update(eventRef, {
          currentAttendees: Math.max(0, Number(existing.currentAttendees || 0) - 1),
          attendeeIds: nextIds,
          lastUpdated: new Date().toISOString(),
        });
      });

      setMessage('Booking cancelled.');
    } catch (error) {
      console.error('Native cancel failed:', error);
      setMessage('Could not cancel booking.');
    } finally {
      setBusyEventId(null);
    }
  };

  const handleEdit = (event) => {
    const eventDateTime = event.dateTime ? new Date(event.dateTime) : new Date();
    setEditingEvent(event);
    setEditFormData({
      title: event.title || '',
      description: event.description || '',
      type: event.type || 'dinner',
      locality: event.locality || organizerLocalityLabel,
      address: event.address || '',
      mapUrl: event.mapUrl || '',
      date: toDateValue(eventDateTime),
      time: toTimeValue(eventDateTime),
      price: String(event.price || 0),
      currency: event.currency || 'EGP',
    });
    setShowEditModal(true);
  };

  const handleUpdateEvent = async () => {
    if (!db || !editingEvent) return;
    if (!editFormData.title.trim() || !editFormData.date || !editFormData.time) {
      setMessage('Title and date/time are required.');
      return;
    }
    if (editFormData.mapUrl && !/^https?:\/\//i.test(editFormData.mapUrl.trim())) {
      setMessage('Map URL must start with http:// or https://');
      return;
    }

    setEditBusy(true);
    try {
      const when = new Date(`${editFormData.date}T${editFormData.time}:00`);
      if (Number.isNaN(when.getTime())) {
        setMessage('Please select a valid date and time.');
        setEditBusy(false);
        return;
      }

      const updatePayload = {
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        type: editFormData.type,
        address: editFormData.address.trim(),
        mapUrl: editFormData.mapUrl.trim(),
        googleMapsLink: editFormData.mapUrl.trim(),
        dateTime: when.toISOString(),
        price: Number(editFormData.price || 0),
        currency: editFormData.currency || 'EGP',
        lastUpdated: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'events', editingEvent.id), updatePayload);
      setShowEditModal(false);
      setEditingEvent(null);
      setMessage('Event updated successfully.');
    } catch (error) {
      console.error('Update event failed:', error);
      setMessage('Could not update event.');
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = (event) => {
    setDeletingEventId(event.id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!db || !deletingEventId) return;
    
    setEditBusy(true);
    try {
      await updateDoc(doc(db, 'events', deletingEventId), {
        status: 'deleted',
        lastUpdated: new Date().toISOString(),
      });
      setShowDeleteConfirm(false);
      setDeletingEventId(null);
      setMessage('Event deleted successfully.');
    } catch (error) {
      console.error('Delete event failed:', error);
      setMessage('Could not delete event.');
    } finally {
      setEditBusy(false);
    }
  };

  const handleRunAlgorithm = (event) => {
    // Placeholder for match algorithm
    setMessage(`Match algorithm placeholder: Would run for event "${event.title}"`);
    console.log('Running match algorithm for event:', event.id);
  };

  const renderItem = ({ item }) => {
    const booking = bookingsMap[item.id];
    const isBooked = booking?.status === BOOKING_STATUS.CONFIRMED;
    const isCreator = currentUser?.uid === item.createdBy;

    return (
      <EventCard
        event={item}
        isBooked={isBooked}
        onBook={handleBook}
        onCancel={handleCancel}
        busy={busyEventId === item.id}
        isCreator={isCreator}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRunAlgorithm={handleRunAlgorithm}
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Events</Text>
        {canCreate ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              setNewEvent({ ...makeDefaultNewEvent(), locality: organizerLocalityLabel });
              setShowCreate(true);
            }}
          >
            <Text style={styles.primaryButtonText}>Create</Text>
          </Pressable>
        ) : null}
      </View>

      {message ? <Text style={styles.banner}>{message}</Text> : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2EDC9A" />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>No published events yet.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Event</Text>

            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((type) => (
                <Pressable
                  key={type.key}
                  style={[styles.typeChip, newEvent.type === type.key && styles.typeChipActive]}
                  onPress={() => setNewEvent((prev) => ({ ...prev, type: type.key }))}
                >
                  <Text style={[styles.typeChipText, newEvent.type === type.key && styles.typeChipTextActive]}>
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={newEvent.title}
              onChangeText={(v) => setNewEvent((prev) => ({ ...prev, title: v }))}
              placeholder="Friday Movie Night"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              multiline
              value={newEvent.description}
              onChangeText={(v) => setNewEvent((prev) => ({ ...prev, description: v }))}
              placeholder="Describe the event"
            />

            <Text style={styles.inputLabel}>Locality</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{newEvent.locality || 'No organizer locality assigned'}</Text>
            </View>

            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={styles.input}
              value={newEvent.address}
              onChangeText={(v) => setNewEvent((prev) => ({ ...prev, address: v }))}
              placeholder="Street, building, venue details"
            />

            <Text style={styles.inputLabel}>Google Maps URL</Text>
            <TextInput
              style={styles.input}
              value={newEvent.mapUrl}
              onChangeText={(v) => setNewEvent((prev) => ({ ...prev, mapUrl: v }))}
              placeholder="https://maps.google.com/..."
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Date</Text>
            <Pressable style={styles.pickerField} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.pickerText}>{newEvent.date}</Text>
            </Pressable>

            <Text style={styles.inputLabel}>Time</Text>
            <Pressable style={styles.pickerField} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.pickerText}>{newEvent.time}</Text>
            </Pressable>

            <Text style={styles.inputLabel}>Price</Text>
            <TextInput
              style={styles.input}
              value={newEvent.price}
              onChangeText={(v) => setNewEvent((prev) => ({ ...prev, price: v }))}
              keyboardType="decimal-pad"
              placeholder="0"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.primaryButton, (createBusy || !organizerLocalityLabel) && styles.buttonDisabled]}
                disabled={createBusy || !organizerLocalityLabel}
                onPress={handleCreate}
              >
                <Text style={styles.primaryButtonText}>{createBusy ? 'Saving...' : 'Publish'}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setShowCreate(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showDatePicker} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.pickerHeader}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <Pressable onPress={() => setShowDatePicker(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={dateOptions}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const active = newEvent.date === item.value;
              return (
                <Pressable
                  style={[styles.pickerRow, active && styles.pickerRowActive]}
                  onPress={() => {
                    setNewEvent((prev) => ({ ...prev, date: item.value }));
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive]}>{item.label}</Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={showTimePicker} animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.pickerHeader}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <Pressable onPress={() => setShowTimePicker(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={timeOptions}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const active = newEvent.time === item.value;
              return (
                <Pressable
                  style={[styles.pickerRow, active && styles.pickerRowActive]}
                  onPress={() => {
                    setNewEvent((prev) => ({ ...prev, time: item.value }));
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive]}>{item.label}</Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={showEditModal} animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Event</Text>

            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((type) => (
                <Pressable
                  key={type.key}
                  style={[styles.typeChip, editFormData.type === type.key && styles.typeChipActive]}
                  onPress={() => setEditFormData((prev) => ({ ...prev, type: type.key }))}
                >
                  <Text style={[styles.typeChipText, editFormData.type === type.key && styles.typeChipTextActive]}>
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={editFormData.title}
              onChangeText={(v) => setEditFormData((prev) => ({ ...prev, title: v }))}
              placeholder="Friday Movie Night"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              multiline
              value={editFormData.description}
              onChangeText={(v) => setEditFormData((prev) => ({ ...prev, description: v }))}
              placeholder="Describe the event"
            />

            <Text style={styles.inputLabel}>Locality</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{editFormData.locality || 'No locality assigned'}</Text>
            </View>

            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={styles.input}
              value={editFormData.address}
              onChangeText={(v) => setEditFormData((prev) => ({ ...prev, address: v }))}
              placeholder="Street, building, venue details"
            />

            <Text style={styles.inputLabel}>Google Maps URL</Text>
            <TextInput
              style={styles.input}
              value={editFormData.mapUrl}
              onChangeText={(v) => setEditFormData((prev) => ({ ...prev, mapUrl: v }))}
              placeholder="https://maps.google.com/..."
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Date</Text>
            <Pressable style={styles.pickerField} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.pickerText}>{editFormData.date}</Text>
            </Pressable>

            <Text style={styles.inputLabel}>Time</Text>
            <Pressable style={styles.pickerField} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.pickerText}>{editFormData.time}</Text>
            </Pressable>

            <Text style={styles.inputLabel}>Price</Text>
            <TextInput
              style={styles.input}
              value={editFormData.price}
              onChangeText={(v) => setEditFormData((prev) => ({ ...prev, price: v }))}
              keyboardType="decimal-pad"
              placeholder="0"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.primaryButton, editBusy && styles.buttonDisabled]}
                disabled={editBusy}
                onPress={handleUpdateEvent}
              >
                <Text style={styles.primaryButtonText}>{editBusy ? 'Saving...' : 'Update Event'}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setShowEditModal(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Delete Event?</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete this event? This action cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                style={[styles.secondaryButton, styles.confirmButton]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={editBusy}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.deleteButton, styles.confirmButton]}
                onPress={handleConfirmDelete}
                disabled={editBusy}
              >
                <Text style={styles.deleteButtonText}>{editBusy ? '...' : 'Delete'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAF7',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    color: '#0369A1',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  eventMeta: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 3,
  },
  eventDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#2EDC9A',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#FAFAF7',
  },
  modalContent: {
    padding: 16,
    paddingBottom: 30,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#F3F4F6',
  },
  readOnlyText: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
  },
  pickerField: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
  },
  pickerText: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeText: {
    color: '#2EDC9A',
    fontWeight: '700',
  },
  pickerRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  pickerRowActive: {
    borderColor: '#2EDC9A',
    backgroundColor: '#F0FDF4',
  },
  pickerRowText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  pickerRowTextActive: {
    color: '#2EDC9A',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  typeChipActive: {
    borderColor: '#2EDC9A',
    backgroundColor: '#F0FDF4',
  },
  typeChipText: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#2EDC9A',
  },
  modalButtons: {
    marginTop: 10,
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#DC2626',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    margin: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    marginTop: 0,
  },
});
