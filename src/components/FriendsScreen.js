import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useNativeApp } from '../contexts/NativeAppContext';

/**
 * Emoji-based rating levels — compact, fits one row in portrait mode.
 * score: 1–5 mapped to a sentiment emoji with accessible label.
 */
const RATING_LEVELS = [
  { score: 1, emoji: '\uD83D\uDE22', label: 'Did not like', bg: '#FEE2E2', border: '#FCA5A5' },
  { score: 2, emoji: '\uD83D\uDE1E', label: 'Uncomfortable', bg: '#FEF3C7', border: '#FCD34D' },
  { score: 3, emoji: '\uD83D\uDE10', label: 'Neutral',       bg: '#E5E7EB', border: '#D1D5DB' },
  { score: 4, emoji: '\uD83D\uDE0A', label: 'Liked',         bg: '#D1FAE5', border: '#86EFAC' },
  { score: 5, emoji: '\uD83D\uDE0D', label: 'Loved it',      bg: '#A7F3D0', border: '#2EDC9A' },
];

const LEGACY_VALUE_BY_SCORE = {
  1: 'not_at_all',
  2: 'not_at_all',
  3: 'like_a_little',
  4: 'like_a_little',
  5: 'like_a_lot',
};

export default function FriendsScreen() {
  const { db, currentUser, userProfile } = useNativeApp();
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [connectingUserId, setConnectingUserId] = useState(null);
  const [metPeople, setMetPeople] = useState([]);
  const [ratingsByUserId, setRatingsByUserId] = useState({});
  const [sentRequests, setSentRequests] = useState(new Set());

  useEffect(() => {
    let alive = true;

    const loadMetPeople = async () => {
      if (!db || !currentUser?.uid) {
        if (alive) setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nowIso = new Date().toISOString();

        const myBookingsSnap = await getDocs(
          query(
            collection(db, 'bookings'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'confirmed')
          )
        );

        const myBookings = myBookingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!myBookings.length) {
          if (alive) {
            setMetPeople([]);
            setRatingsByUserId({});
          }
          return;
        }

        const pastEventBookings = [];
        for (const b of myBookings) {
          if (!b.eventId) continue;
          const eventDocSnap = await getDoc(doc(db, 'events', b.eventId));
          if (!eventDocSnap.exists()) continue;
          const eventData = eventDocSnap.data();
          if (!eventData?.dateTime || eventData.dateTime >= nowIso) continue;
          pastEventBookings.push({ booking: b, event: { id: b.eventId, ...eventData } });
        }

        if (!pastEventBookings.length) {
          if (alive) {
            setMetPeople([]);
            setRatingsByUserId({});
          }
          return;
        }

        const metMap = {};
        for (const item of pastEventBookings) {
          const eventId = item.event.id;
          const attendeesSnap = await getDocs(
            query(
              collection(db, 'bookings'),
              where('eventId', '==', eventId),
              where('status', '==', 'confirmed')
            )
          );

          attendeesSnap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const uid = data.userId;
            if (!uid || uid === currentUser.uid) return;

            if (!metMap[uid]) {
              metMap[uid] = {
                userId: uid,
                sharedEventIds: new Set(),
                lastMetAt: item.event.dateTime,
                lastEventId: eventId,
                lastEventTitle: item.event.title || 'Event',
              };
            }

            metMap[uid].sharedEventIds.add(eventId);
            if ((item.event.dateTime || '') > (metMap[uid].lastMetAt || '')) {
              metMap[uid].lastMetAt = item.event.dateTime;
              metMap[uid].lastEventId = eventId;
              metMap[uid].lastEventTitle = item.event.title || 'Event';
            }
          });
        }

        const people = [];
        for (const uid of Object.keys(metMap)) {
          const userSnap = await getDoc(doc(db, 'users', uid));
          const userData = userSnap.exists() ? userSnap.data() : {};
          people.push({
            userId: uid,
            displayName: userData.displayName || userData.name || userData.email || 'Unknown user',
            city: userData.city || '',
            localityLabel: userData.localityLabel || '',
            photoURL: userData.photoURL || '',
            sharedEventsCount: metMap[uid].sharedEventIds.size,
            lastMetAt: metMap[uid].lastMetAt,
            lastEventId: metMap[uid].lastEventId,
            lastEventTitle: metMap[uid].lastEventTitle,
          });
        }

        people.sort((a, b) => (a.lastMetAt < b.lastMetAt ? 1 : -1));

        const ratingsSnap = await getDocs(
          query(collection(db, 'ratings'), where('fromUserId', '==', currentUser.uid))
        );

        const latestRatings = {};
        ratingsSnap.docs.forEach((d) => {
          const r = d.data();
          if (!r?.toUserId) return;
          const score = Number(r.score || r.ratingLevel || 0);
          const normalizedScore = score >= 1 && score <= 5 ? score : null;
          const mappedScore =
            normalizedScore ||
            (r.value === 'like_a_lot' ? 5 : r.value === 'like_a_little' ? 4 : r.value === 'not_at_all' ? 1 : null);
          if (!mappedScore) return;

          const existing = latestRatings[r.toUserId];
          if (!existing || (r.createdAt || '') > (existing.createdAt || '')) {
            latestRatings[r.toUserId] = {
              id: d.id,
              score: mappedScore,
              createdAt: r.createdAt || '',
              eventId: r.eventId || '',
            };
          }
        });

        // Load already-sent connect requests
        const connectSnap = await getDocs(
          query(collection(db, 'connectRequests'), where('requesterId', '==', currentUser.uid))
        );
        const alreadySent = new Set(connectSnap.docs.map((d) => d.data().targetUserId).filter(Boolean));

        if (alive) {
          setMetPeople(people);
          setSentRequests(alreadySent);
          const mapped = {};
          people.forEach((p) => {
            if (latestRatings[p.userId]?.score) {
              mapped[p.userId] = latestRatings[p.userId].score;
            }
          });
          setRatingsByUserId(mapped);
        }
      } catch (error) {
        console.error('Load met people failed:', error);
        if (alive) {
          setMetPeople([]);
          setRatingsByUserId({});
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadMetPeople();

    return () => {
      alive = false;
    };
  }, [db, currentUser?.uid]);

  const canRateCount = useMemo(() => metPeople.length, [metPeople]);

  const saveRating = async (person, score) => {
    if (!db || !currentUser?.uid || !person?.userId) return;
    setSavingUserId(person.userId);
    try {
      const existingSnap = await getDocs(
        query(
          collection(db, 'ratings'),
          where('fromUserId', '==', currentUser.uid),
          where('toUserId', '==', person.userId),
          where('eventId', '==', person.lastEventId)
        )
      );

      const payload = {
        fromUserId: currentUser.uid,
        toUserId: person.userId,
        eventId: person.lastEventId,
        value: LEGACY_VALUE_BY_SCORE[score],
        score,
        ratingLevel: score,
        createdAt: new Date().toISOString(),
      };

      if (!existingSnap.empty) {
        const first = existingSnap.docs[0];
        await updateDoc(first.ref, payload);
      } else {
        await addDoc(collection(db, 'ratings'), payload);
      }

      setRatingsByUserId((prev) => ({ ...prev, [person.userId]: score }));
    } catch (error) {
      console.error('Save rating failed:', error);
    } finally {
      setSavingUserId(null);
    }
  };

  const sendConnectRequest = async (person) => {
    if (!db || !currentUser?.uid || !person?.userId) return;
    if (sentRequests.has(person.userId)) {
      Alert.alert('Already sent', 'You already sent a connect request to this person.');
      return;
    }

    setConnectingUserId(person.userId);
    try {
      const requesterName =
        userProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Someone';

      // Create a connect request record
      await addDoc(collection(db, 'connectRequests'), {
        requesterId: currentUser.uid,
        requesterName,
        targetUserId: person.userId,
        status: 'pending',
        message: `${requesterName} would like to connect with you.`,
        createdAt: new Date().toISOString(),
        respondedAt: null,
      });

      // Send a notification to the target user
      await addDoc(collection(db, 'notifications'), {
        userId: person.userId,
        type: 'connect_request',
        fromUserId: currentUser.uid,
        eventId: person.lastEventId || '',
        message: `${requesterName} sent you a connect request. They met you at "${person.lastEventTitle}".`,
        read: false,
        createdAt: new Date().toISOString(),
      });

      setSentRequests((prev) => new Set([...prev, person.userId]));
      Alert.alert('Request sent!', `Your connect request was sent to ${person.displayName}.`);
    } catch (error) {
      console.error('Send connect request failed:', error);
      Alert.alert('Error', 'Could not send connect request. Please try again.');
    } finally {
      setConnectingUserId(null);
    }
  };

  const renderItem = ({ item }) => {
    const selectedScore = ratingsByUserId[item.userId] || 0;
    const isSaving = savingUserId === item.userId;
    const isConnecting = connectingUserId === item.userId;
    const alreadySent = sentRequests.has(item.userId);
    const locationLabel = item.localityLabel || item.city || '';

    return (
      <View style={styles.card}>
        {/* User row */}
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.displayName || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.displayName}</Text>
            {locationLabel ? (
              <Text style={styles.userMeta}>
                {'\uD83D\uDCCD'} {locationLabel}
              </Text>
            ) : null}
            <Text style={styles.userMeta}>
              Met in {item.sharedEventsCount} event{item.sharedEventsCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Compact emoji rating row */}
        <View style={styles.ratingSection}>
          <Text style={styles.rateLabel}>Rate:</Text>
          <View style={styles.ratingRow}>
            {RATING_LEVELS.map((level) => {
              const active = selectedScore === level.score;
              return (
                <Pressable
                  key={level.score}
                  style={[
                    styles.emojiButton,
                    { backgroundColor: level.bg, borderColor: active ? level.border : 'transparent' },
                    active && styles.emojiButtonActive,
                  ]}
                  onPress={() => saveRating(item, level.score)}
                  disabled={isSaving}
                  accessibilityLabel={level.label}
                >
                  <Text style={styles.emojiText}>{level.emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Request to Connect button */}
        <Pressable
          style={[styles.connectButton, (isConnecting || alreadySent) && styles.connectButtonSent]}
          onPress={() => sendConnectRequest(item)}
          disabled={isConnecting || alreadySent}
        >
          <Text style={styles.connectButtonEmoji}>{alreadySent ? '\u2705' : '\uD83E\uDD1D'}</Text>
          <Text style={[styles.connectButtonText, alreadySent && styles.connectButtonTextSent]}>
            {isConnecting ? 'Sending...' : alreadySent ? 'Request Sent' : 'Request to Connect'}
          </Text>
        </Pressable>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2EDC9A" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Friends</Text>
      <Text style={styles.subtitle}>People you met in previous events ({canRateCount})</Text>

      {metPeople.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No previous event connections yet.</Text>
          <Text style={styles.emptyHint}>Once you attend events, the people you meet will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={metPeople}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FAFAF7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 12,
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  userRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#5B21B6',
    fontWeight: '700',
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  userMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  rateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  emojiButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButtonActive: {
    transform: [{ scale: 1.12 }],
  },
  emojiText: {
    fontSize: 20,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFBEB',
  },
  connectButtonSent: {
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  connectButtonEmoji: {
    fontSize: 18,
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  connectButtonTextSent: {
    color: '#065F46',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
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
