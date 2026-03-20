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
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNativeApp } from '../contexts/NativeAppContext';

const RATING_LEVELS = [
  { score: 1, icon: 'emoticon-sad-outline', label: 'I did not like this person', bg: '#FEE2E2', border: '#FCA5A5' },
  { score: 2, icon: 'emoticon-frown-outline', label: 'I did not enjoy this interaction', bg: '#FEF3C7', border: '#FCD34D' },
  { score: 3, icon: 'emoticon-neutral-outline', label: 'I felt neutral about this person', bg: '#E5E7EB', border: '#D1D5DB' },
  { score: 4, icon: 'emoticon-happy-outline', label: 'I liked this person', bg: '#D1FAE5', border: '#86EFAC' },
  { score: 5, icon: 'emoticon-excited-outline', label: 'I really liked this person', bg: '#A7F3D0', border: '#2EDC9A' },
];

const LEGACY_VALUE_BY_SCORE = {
  1: 'not_at_all',
  2: 'not_at_all',
  3: 'like_a_little',
  4: 'like_a_little',
  5: 'like_a_lot',
};

export default function FriendsScreen() {
  const { db, currentUser } = useNativeApp();
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [metPeople, setMetPeople] = useState([]);
  const [ratingsByUserId, setRatingsByUserId] = useState({});

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

        if (alive) {
          setMetPeople(people);
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

  const renderItem = ({ item }) => {
    const selectedScore = ratingsByUserId[item.userId] || 0;
    const isSaving = savingUserId === item.userId;
    const selectedLevel = RATING_LEVELS.find((level) => level.score === selectedScore);
    return (
      <View style={styles.card}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.displayName || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.displayName}</Text>
            <Text style={styles.userMeta}>Met in {item.sharedEventsCount} event{item.sharedEventsCount > 1 ? 's' : ''}</Text>
            <Text style={styles.userMeta}>Last: {item.lastEventTitle}</Text>
          </View>
        </View>

        <View style={styles.ratingRow}>
          {RATING_LEVELS.map((level) => {
            const active = selectedScore === level.score;
            return (
              <Pressable
                key={level.score}
                style={[
                  styles.ratingButton,
                  { backgroundColor: level.bg, borderColor: level.border },
                  active && styles.ratingButtonActive,
                ]}
                onPress={() => saveRating(item, level.score)}
                disabled={isSaving}
              >
                <MaterialCommunityIcons
                  name={level.icon}
                  size={22}
                  color={active ? '#0B5D40' : '#6B7280'}
                />
                <Text style={[styles.ratingLabel, active && styles.ratingLabelActive]}>{level.score}</Text>
              </Pressable>
            );
          })}
        </View>

        {selectedLevel ? (
          <Text style={styles.ratingConfirmation}>{selectedLevel.label}</Text>
        ) : null}
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
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  userRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 16,
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
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  ratingButton: {
    width: '18%',
    minWidth: 58,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingButtonActive: {
    borderColor: '#2EDC9A',
    transform: [{ scale: 1.06 }],
  },
  ratingEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  ratingLabelActive: {
    color: '#0B5D40',
  },
  ratingConfirmation: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '700',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 10,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
