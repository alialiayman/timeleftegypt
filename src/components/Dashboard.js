import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
import { useNativeApp } from '../contexts/NativeAppContext';

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function DashboardScreen({ onSignOut }) {
  const { db, currentUser, userProfile, profileLoading } = useNativeApp();
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (!db) return undefined;
    const q = query(collection(db, 'events'), where('status', '==', 'published'));
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
      },
      () => setEvents([])
    );

    return unsub;
  }, [db]);

  useEffect(() => {
    if (!db || !currentUser?.uid) return undefined;
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'confirmed')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBookings(list);
      },
      () => setBookings([])
    );

    return unsub;
  }, [db, currentUser?.uid]);

  const bookedEventIds = useMemo(() => new Set(bookings.map((b) => b.eventId)), [bookings]);

  const bookedUpcoming = useMemo(() => {
    const now = new Date().toISOString();
    return events.filter((ev) => bookedEventIds.has(ev.id) && ev.dateTime >= now);
  }, [events, bookedEventIds]);

  const localityEvents = useMemo(() => {
    const now = new Date().toISOString();
    const localityId = userProfile?.localityId || '';
    const localityLabel = userProfile?.localityLabel || '';
    return events.filter((ev) => {
      if (!ev.dateTime || ev.dateTime < now) return false;
      if (localityId && ev.localityId) return ev.localityId === localityId;
      if (localityLabel) return ev.locality === localityLabel;
      return true;
    });
  }, [events, userProfile?.localityId, userProfile?.localityLabel]);

  const renderEventRow = ({ item }) => {
    const when = item.dateTime ? new Date(item.dateTime).toLocaleString() : '-';
    const price = Number(item.price || 0) === 0 ? 'Free' : `${item.price} ${item.currency || 'EGP'}`;
    return (
      <View style={styles.eventRow}>
        <Text style={styles.eventTitle}>{item.title || 'Untitled event'}</Text>
        <Text style={styles.eventMeta}>{when}</Text>
        <Text style={styles.eventMeta}>{item.locality || '-'}</Text>
        <Text style={styles.eventMeta}>{price}</Text>
      </View>
    );
  };

  if (profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Dashboard</Text>

      <SectionCard title="Profile">
        <Text style={styles.infoLine}>Name: {userProfile?.displayName || userProfile?.name || currentUser?.displayName || '-'}</Text>
        <Text style={styles.infoLine}>Email: {userProfile?.email || currentUser?.email || '-'}</Text>
        <Text style={styles.infoLine}>City: {userProfile?.city || '-'}</Text>
        <Text style={styles.infoLine}>Area: {userProfile?.localityLabel || '-'}</Text>
      </SectionCard>

      <SectionCard title="Quick Actions">
        <Pressable style={styles.secondaryButton} onPress={onSignOut}>
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title={`Upcoming Booked (${bookedUpcoming.length})`}>
        {bookedUpcoming.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming booked events.</Text>
        ) : (
          <FlatList
            data={bookedUpcoming.slice(0, 4)}
            keyExtractor={(item) => item.id}
            renderItem={renderEventRow}
            scrollEnabled={false}
          />
        )}
      </SectionCard>

      <SectionCard title={`Events In Your Area (${localityEvents.length})`}>
        {localityEvents.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming events in your area.</Text>
        ) : (
          <FlatList
            data={localityEvents.slice(0, 4)}
            keyExtractor={(item) => item.id}
            renderItem={renderEventRow}
            scrollEnabled={false}
          />
        )}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffaf5',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoLine: {
    fontSize: 14,
    lineHeight: 21,
    color: '#1F2937',
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: '#2EDC9A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#1F2937',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  eventRow: {
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff7ed',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7c2d12',
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: 13,
    color: '#9a3412',
    marginBottom: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#9a3412',
  },
});
