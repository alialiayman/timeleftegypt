import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNativeApp } from '../contexts/NativeAppContext';
import NotificationBadge from './NotificationBadge';

const SORT_OPTIONS = [
  { key: 'date', label: 'By Date' },
  { key: 'interest', label: 'By Interest' },
];

function EventCard({ item }) {
  const when = item.dateTime ? new Date(item.dateTime).toLocaleString() : '-';
  const price = Number(item.price || 0) === 0 ? 'Free' : `${item.price} ${item.currency || 'EGP'}`;
  const spotsLeft = item.maxAttendees
    ? Math.max(0, item.maxAttendees - (item.currentAttendees || 0))
    : null;

  return (
    <View style={styles.eventCard}>
      <View style={styles.eventHeaderRow}>
        <View style={styles.eventTypePill}>
          <Text style={styles.eventTypeText}>{item.type || 'event'}</Text>
        </View>
        {spotsLeft !== null && spotsLeft <= 5 && spotsLeft > 0 && (
          <View style={styles.urgentPill}>
            <Text style={styles.urgentText}>Only {spotsLeft} left!</Text>
          </View>
        )}
      </View>
      <Text style={styles.eventTitle}>{item.title || 'Untitled event'}</Text>
      <Text style={styles.eventMeta}>{'\u{1F551}'} {when}</Text>
      <Text style={styles.eventMeta}>{'\u{1F4CD}'} {item.locality || '-'}</Text>
      <Text style={styles.eventMeta}>{'\u{1F4B0}'} {price}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { db, currentUser, userProfile, profileLoading } = useNativeApp();
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sortMode, setSortMode] = useState('date');
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Load all published events
  useEffect(() => {
    if (!db) return undefined;
    const q = query(collection(db, 'events'), where('status', '==', 'published'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => ((a?.dateTime || '') > (b?.dateTime || '') ? 1 : -1));
        setEvents(list);
      },
      () => setEvents([])
    );
    return unsub;
  }, [db]);

  // Load user bookings
  useEffect(() => {
    if (!db || !currentUser?.uid) return undefined;
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'confirmed')
    );
    const unsub = onSnapshot(
      q,
      (snap) => setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setBookings([])
    );
    return unsub;
  }, [db, currentUser?.uid]);

  // Load unread notifications for current user
  useEffect(() => {
    if (!db || !currentUser?.uid) return undefined;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('read', '==', false)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setNotifications([])
    );
    return unsub;
  }, [db, currentUser?.uid]);

  const bookedEventIds = useMemo(() => new Set(bookings.map((b) => b.eventId)), [bookings]);
  const now = useMemo(() => new Date().toISOString(), []);

  const userInterests = useMemo(() => {
    const raw = userProfile?.preferences?.interests;
    if (Array.isArray(raw)) return raw.map((i) => i.toLowerCase());
    if (typeof raw === 'string') return raw.split(',').map((i) => i.trim().toLowerCase()).filter(Boolean);
    return [];
  }, [userProfile?.preferences?.interests]);

  // Upcoming events in user's locality
  const localityEvents = useMemo(() => {
    const localityId = userProfile?.localityId || '';
    const localityLabel = userProfile?.localityLabel || '';
    return events.filter((ev) => {
      if (!ev.dateTime || ev.dateTime < now) return false;
      if (localityId && ev.localityId) return ev.localityId === localityId;
      if (localityLabel) return (ev.locality || '').includes(localityLabel);
      return true;
    });
  }, [events, userProfile?.localityId, userProfile?.localityLabel, now]);

  // Sorted events
  const sortedEvents = useMemo(() => {
    if (sortMode === 'interest' && userInterests.length > 0) {
      return [...localityEvents].sort((a, b) => {
        const aMatch = userInterests.some(
          (i) => (a.type || '').toLowerCase().includes(i) || (a.title || '').toLowerCase().includes(i)
        );
        const bMatch = userInterests.some(
          (i) => (b.type || '').toLowerCase().includes(i) || (b.title || '').toLowerCase().includes(i)
        );
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return (a.dateTime || '') > (b.dateTime || '') ? 1 : -1;
      });
    }
    return localityEvents;
  }, [localityEvents, sortMode, userInterests]);

  const bookedUpcoming = useMemo(
    () => sortedEvents.filter((ev) => bookedEventIds.has(ev.id)),
    [sortedEvents, bookedEventIds]
  );

  const firstName = useMemo(() => {
    const full = userProfile?.displayName || userProfile?.name || currentUser?.displayName || '';
    return full.split(' ')[0] || 'there';
  }, [userProfile, currentUser]);

  const unreadCount = notifications.length;

  if (profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2EDC9A" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hey, {firstName} {'\u{1F44B}'}</Text>
          <Text style={styles.greetingSub}>Discover upcoming events near you</Text>
        </View>
        <NotificationBadge count={unreadCount} onPress={() => setShowNotifPanel((v) => !v)} />
      </View>

      {/* Notification panel */}
      {showNotifPanel && (
        <View style={styles.notifPanel}>
          <Text style={styles.notifPanelTitle}>Notifications</Text>
          {notifications.length === 0 ? (
            <Text style={styles.notifEmpty}>All caught up! No new notifications.</Text>
          ) : (
            notifications.slice(0, 10).map((n) => (
              <View key={n.id} style={styles.notifRow}>
                <MaterialCommunityIcons
                  name={
                    n.type === 'connect_request'
                      ? 'handshake-outline'
                      : n.type === 'venue_revealed'
                      ? 'map-marker-check'
                      : 'bell'
                  }
                  size={18}
                  color="#2EDC9A"
                  style={styles.notifIcon}
                />
                <Text style={styles.notifMessage}>{n.message || 'New notification'}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* Upcoming booked events */}
      {bookedUpcoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{'\u{1F4C5}'} Your Upcoming Events ({bookedUpcoming.length})</Text>
          {bookedUpcoming.slice(0, 3).map((item) => (
            <EventCard key={item.id} item={item} />
          ))}
        </View>
      )}

      {/* Sort controls */}
      <View style={styles.sortRow}>
        <Text style={styles.sectionTitle}>
          {'\u{1F30D}'} Events in Your Area ({sortedEvents.length})
        </Text>
        <View style={styles.sortButtons}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.sortButton, sortMode === opt.key && styles.sortButtonActive]}
              onPress={() => setSortMode(opt.key)}
            >
              <Text style={[styles.sortButtonText, sortMode === opt.key && styles.sortButtonTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {sortedEvents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No upcoming events in your area yet.</Text>
          <Text style={styles.emptyHint}>Update your locality in Profile to see local events.</Text>
        </View>
      ) : (
        sortedEvents.map((item) => <EventCard key={item.id} item={item} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAF7',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAF7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 2,
  },
  greetingSub: {
    fontSize: 14,
    color: '#6B7280',
  },
  notifPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 14,
  },
  notifPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  notifIcon: {
    marginTop: 2,
  },
  notifMessage: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  notifEmpty: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 8,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  sortButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
  },
  sortButtonActive: {
    borderColor: '#2EDC9A',
    backgroundColor: '#ECFDF5',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  sortButtonTextActive: {
    color: '#065F46',
  },
  eventCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  eventHeaderRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  eventTypePill: {
    backgroundColor: '#EDE9FE',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  eventTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B21B6',
    textTransform: 'capitalize',
  },
  urgentPill: {
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  urgentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  eventMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 3,
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});
