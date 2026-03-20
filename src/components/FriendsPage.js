import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
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

const FACE_LEVELS = [
  { score: 1, emoji: '😢', short: '1', confirmation: 'I did not like this person' },
  { score: 2, emoji: '😞', short: '2', confirmation: 'I did not enjoy this interaction' },
  { score: 3, emoji: '😐', short: '3', confirmation: 'I felt neutral about this person' },
  { score: 4, emoji: '🙂', short: '4', confirmation: 'I liked this person' },
  { score: 5, emoji: '😍', short: '5', confirmation: 'I really liked this person' },
];

const LEGACY_VALUE_BY_SCORE = {
  1: 'not_at_all',
  2: 'not_at_all',
  3: 'like_a_little',
  4: 'like_a_little',
  5: 'like_a_lot',
};

export default function FriendsPage() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState('');
  const [metPeople, setMetPeople] = useState([]);
  const [ratingsByUserId, setRatingsByUserId] = useState({});

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!currentUser?.uid) {
        if (active) setLoading(false);
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
          if (active) {
            setMetPeople([]);
            setRatingsByUserId({});
          }
          return;
        }

        const pastEvents = [];
        for (const booking of myBookings) {
          if (!booking.eventId) continue;
          const eventSnap = await getDoc(doc(db, 'events', booking.eventId));
          if (!eventSnap.exists()) continue;
          const eventData = eventSnap.data();
          if (!eventData?.dateTime || eventData.dateTime >= nowIso) continue;
          pastEvents.push({ id: booking.eventId, ...eventData });
        }

        if (!pastEvents.length) {
          if (active) {
            setMetPeople([]);
            setRatingsByUserId({});
          }
          return;
        }

        const metMap = {};
        for (const event of pastEvents) {
          const attendeesSnap = await getDocs(
            query(
              collection(db, 'bookings'),
              where('eventId', '==', event.id),
              where('status', '==', 'confirmed')
            )
          );

          attendeesSnap.docs.forEach((d) => {
            const b = d.data();
            const uid = b.userId;
            if (!uid || uid === currentUser.uid) return;

            if (!metMap[uid]) {
              metMap[uid] = {
                userId: uid,
                sharedEventIds: new Set(),
                lastMetAt: event.dateTime,
                lastEventId: event.id,
                lastEventTitle: event.title || t('events'),
              };
            }

            metMap[uid].sharedEventIds.add(event.id);
            if ((event.dateTime || '') > (metMap[uid].lastMetAt || '')) {
              metMap[uid].lastMetAt = event.dateTime;
              metMap[uid].lastEventId = event.id;
              metMap[uid].lastEventTitle = event.title || t('events');
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

        const latest = {};
        ratingsSnap.docs.forEach((d) => {
          const rating = d.data();
          if (!rating?.toUserId) return;

          const numeric = Number(rating.score || rating.ratingLevel || 0);
          const normalized = numeric >= 1 && numeric <= 5
            ? numeric
            : rating.value === 'like_a_lot'
              ? 5
              : rating.value === 'like_a_little'
                ? 4
                : rating.value === 'not_at_all'
                  ? 1
                  : null;

          if (!normalized) return;

          const prev = latest[rating.toUserId];
          if (!prev || (rating.createdAt || '') > (prev.createdAt || '')) {
            latest[rating.toUserId] = {
              score: normalized,
              createdAt: rating.createdAt || '',
            };
          }
        });

        if (active) {
          setMetPeople(people);
          const mapped = {};
          people.forEach((person) => {
            if (latest[person.userId]?.score) mapped[person.userId] = latest[person.userId].score;
          });
          setRatingsByUserId(mapped);
        }
      } catch (error) {
        console.error('FriendsPage load failed:', error);
        if (active) {
          setMetPeople([]);
          setRatingsByUserId({});
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [currentUser?.uid, t]);

  const title = useMemo(() => t('metPeople'), [t]);

  const saveRating = async (person, score) => {
    if (!currentUser?.uid || !person?.userId || !person?.lastEventId) return;
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
        await updateDoc(existingSnap.docs[0].ref, payload);
      } else {
        await addDoc(collection(db, 'ratings'), payload);
      }

      setRatingsByUserId((prev) => ({ ...prev, [person.userId]: score }));
    } catch (error) {
      console.error('FriendsPage save rating failed:', error);
    } finally {
      setSavingUserId('');
    }
  };

  if (loading) {
    return (
      <section className="met-people-section">
        <h3>{title}</h3>
        <p>{t('loading')}</p>
      </section>
    );
  }

  return (
    <section className="met-people-section friends-page">
      <h3>{title}</h3>
      {metPeople.length === 0 ? (
        <p>{t('metPeopleEmpty')}</p>
      ) : (
        <div className="met-people-list">
          {metPeople.map((person) => {
            const selected = ratingsByUserId[person.userId] || 0;
            const isSaving = savingUserId === person.userId;
            const selectedLevel = FACE_LEVELS.find((level) => level.score === selected);

            return (
              <article key={person.userId} className="met-person-card">
                <div className="person-info">
                  <div className="person-avatar" aria-hidden="true">
                    {person.photoURL ? (
                      <img src={person.photoURL} alt={person.displayName} />
                    ) : (
                      <span>{(person.displayName || 'U')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="person-details">
                    <strong>{person.displayName}</strong>
                    <small>{person.sharedEventsCount} shared event{person.sharedEventsCount > 1 ? 's' : ''}</small>
                    <small>{person.lastEventTitle}</small>
                  </div>
                </div>

                <div className="face-rating-row">
                  <div className="face-rating-buttons">
                    {FACE_LEVELS.map((level) => (
                      <button
                        key={level.score}
                        type="button"
                        className={`face-btn face-btn--${level.score} ${selected === level.score ? 'face-selected' : ''}`}
                        onClick={() => saveRating(person, level.score)}
                        disabled={isSaving}
                        title={`Rate ${level.score}/5`}
                        aria-label={`Rate ${level.score}/5`}
                      >
                        {level.emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedLevel ? (
                  <p className="face-confirmation">{selectedLevel.confirmation}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
