import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { RATING_VALUES, createRating } from '../models';

/**
 * RatingFlow - shown after attending an event.
 * Allows a user to rate co-attendees.
 */
export default function RatingFlow({ event, attendees, onClose }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [ratings, setRatings] = useState({});
  const [existingRatings, setExistingRatings] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load existing ratings this user has already given for this event
  useEffect(() => {
    if (!currentUser || !event) return;
    const fetchExisting = async () => {
      const q = query(
        collection(db, 'ratings'),
        where('fromUserId', '==', currentUser.uid),
        where('eventId', '==', event.id)
      );
      const snap = await getDocs(q);
      const existing = {};
      snap.docs.forEach(d => {
        existing[d.data().toUserId] = d.data().value;
      });
      setExistingRatings(existing);
    };
    fetchExisting();
  }, [currentUser, event]);

  const setRating = (userId, value) => {
    setRatings(prev => ({ ...prev, [userId]: value }));
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      for (const [toUserId, value] of Object.entries(ratings)) {
        if (existingRatings[toUserId]) continue; // Don't re-rate
        const rating = createRating({
          fromUserId: currentUser.uid,
          toUserId,
          eventId: event.id,
          value,
          createdAt: new Date().toISOString(),
        });
        delete rating.id;
        await addDoc(collection(db, 'ratings'), rating);
      }
      setSubmitted(true);
    } catch (err) {
      console.error('Rating error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Attendees to rate (exclude self)
  const rateableAttendees = (attendees || []).filter(a => a.id !== currentUser?.uid);

  if (submitted) {
    return (
      <div className="rating-flow card">
        <div className="rating-success">
          <span className="rating-success-icon">🎉</span>
          <p>{t('ratingSubmitted')}</p>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rating-flow card">
      <h3>{t('rateAttendees')}</h3>
      <p className="rating-event-name">{event?.title}</p>

      {rateableAttendees.length === 0 ? (
        <p>No co-attendees to rate.</p>
      ) : (
        <div className="rating-list">
          {rateableAttendees.map(attendee => {
            const existingVal = existingRatings[attendee.id];
            const currentVal = ratings[attendee.id] || existingVal;

            return (
              <div key={attendee.id} className="rating-item">
                <div className="rating-user-info">
                  {attendee.photoURL ? (
                    <img src={attendee.photoURL} alt={attendee.displayName} className="rating-avatar" />
                  ) : (
                    <div className="rating-avatar-placeholder">
                      {(attendee.displayName || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="rating-user-name">{attendee.displayName || attendee.name}</span>
                </div>

                <div className="rating-buttons">
                  {Object.values(RATING_VALUES).map(val => (
                    <button
                      key={val}
                      className={`rating-btn ${currentVal === val ? 'selected' : ''}`}
                      onClick={() => !existingVal && setRating(attendee.id, val)}
                      disabled={!!existingVal}
                    >
                      {val === RATING_VALUES.LIKE_A_LOT && t('rateLikeALot')}
                      {val === RATING_VALUES.LIKE_A_LITTLE && t('rateLikeALittle')}
                      {val === RATING_VALUES.NOT_AT_ALL && t('rateNotAtAll')}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rating-actions">
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting || Object.keys(ratings).length === 0}
        >
          {submitting ? '...' : t('submitRatings')}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Skip</button>
      </div>
    </div>
  );
}
