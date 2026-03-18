import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, doc,
  getDocs, orderBy, documentId
} from 'firebase/firestore';
import InterestsEditor from './InterestsEditor';

function UserProfile({ onBack }) {
  const { t } = useTranslation();
  const { currentUser, userProfile, updateUserProfile, isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    displayName: '',
    fullName: '',
    phoneNumber: '',
    gender: '',
    localityId: '',
    preferences: {
      dietary: '',
      interests: [],
      experience: '',
    },
  });

  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const fileInputRef = useRef(null);

  // Localities from Firestore
  const [localities, setLocalities] = useState([]);

  // Met people / ratings
  const [metPeople, setMetPeople] = useState([]);
  const [ratingsGiven, setRatingsGiven] = useState({});
  const [ratingLoading, setRatingLoading] = useState(null);
  const [ratingMessages, setRatingMessages] = useState({});

  // Contact permissions (outgoing requests sent by current user)
  const [contactRequests, setContactRequests] = useState({});
  const [contactLoading, setContactLoading] = useState(null);

  // Incoming connection requests (where current user is the target)
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [incomingRequestors, setIncomingRequestors] = useState({});
  const [incomingActionLoading, setIncomingActionLoading] = useState(null);

  // Account status / appeals
  const [appealText, setAppealText] = useState('');
  const [appealStatus, setAppealStatus] = useState(null);
  const [appealLoading, setAppealLoading] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);

  // Load localities
  useEffect(() => {
    const q = query(collection(db, 'localities'), orderBy('country'));
    const unsub = onSnapshot(q, (snap) => {
      setLocalities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  // Initialize form from profile
  useEffect(() => {
    if (userProfile) {
      const rawInterests = userProfile.preferences?.interests;
      const interestsArr = Array.isArray(rawInterests)
        ? rawInterests
        : typeof rawInterests === 'string' && rawInterests.trim()
          ? rawInterests.split(',').map(s => s.trim()).filter(Boolean)
          : [];

      setFormData({
        displayName: userProfile.displayName || '',
        fullName: userProfile.fullName || '',
        phoneNumber: userProfile.phoneNumber || '',
        gender: userProfile.gender || '',
        localityId: userProfile.localityId || '',
        preferences: {
          dietary: userProfile.preferences?.dietary || '',
          interests: interestsArr,
          experience: userProfile.preferences?.experience || '',
        },
      });
    }
  }, [userProfile]);

  // Load met people: users who attended the same events as current user
  useEffect(() => {
    if (!currentUser) return;

    const loadMetPeople = async () => {
      try {
        // Get all confirmed bookings for current user
        const myBookingsSnap = await getDocs(
          query(
            collection(db, 'bookings'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'confirmed')
          )
        );
        const myEventIds = myBookingsSnap.docs.map(d => d.data().eventId);
        if (myEventIds.length === 0) return;

        // Get all bookings for those events (batched in groups of 10 for Firestore 'in' limit)
        const metUserIds = new Set();
        for (let i = 0; i < myEventIds.length; i += 10) {
          const batch = myEventIds.slice(i, i + 10);
          const othersSnap = await getDocs(
            query(
              collection(db, 'bookings'),
              where('eventId', 'in', batch),
              where('status', '==', 'confirmed')
            )
          );
          othersSnap.docs.forEach(d => {
            const uid = d.data().userId;
            if (uid !== currentUser.uid) metUserIds.add(uid);
          });
        }

        if (metUserIds.size === 0) return;

        // Load user profiles for met people
        const metIds = Array.from(metUserIds);
        const profilePromises = [];
        for (let i = 0; i < metIds.length; i += 10) {
          const batch = metIds.slice(i, i + 10);
          profilePromises.push(
            getDocs(query(collection(db, 'users'), where(documentId(), 'in', batch)))
          );
        }
        const profileSnaps = await Promise.all(profilePromises);
        const people = [];
        profileSnaps.forEach(snap => {
          snap.docs.forEach(d => people.push({ id: d.id, ...d.data() }));
        });
        setMetPeople(people);
      } catch (err) {
        console.error('Error loading met people:', err);
      }
    };

    loadMetPeople();
  }, [currentUser]);

  // Load ratings given by current user
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'ratings'),
      where('fromUserId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[data.toUserId] = { id: d.id, ...data };
      });
      setRatingsGiven(map);
    }, () => {});
    return unsub;
  }, [currentUser]);

  // Load contact permission requests sent by current user
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'contactPermissions'),
      where('requesterId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[data.targetUserId] = { id: d.id, ...data };
      });
      setContactRequests(map);
    }, () => {});
    return unsub;
  }, [currentUser]);

  // Load incoming connection requests where current user is the target
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'contactPermissions'),
      where('targetUserId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, async (snap) => {
      const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIncomingRequests(requests);
      // Load requester profiles
      const requesterIds = [...new Set(requests.map(r => r.requesterId))];
      if (requesterIds.length === 0) { setIncomingRequestors({}); return; }
      try {
        const profiles = {};
        for (let i = 0; i < requesterIds.length; i += 10) {
          const batch = requesterIds.slice(i, i + 10);
          const snap2 = await getDocs(
            query(collection(db, 'users'), where(documentId(), 'in', batch))
          );
          snap2.docs.forEach(d => { profiles[d.id] = { id: d.id, ...d.data() }; });
        }
        setIncomingRequestors(profiles);
      } catch (err) {
        console.error('Error loading requestor profiles:', err);
      }
    }, () => {});
    return unsub;
  }, [currentUser]);

  // Load appeal status
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'appeals'),
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const latest = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt > a.createdAt ? -1 : 1))[0];
        setAppealStatus(latest);
      }
    }, () => {});
    return unsub;
  }, [currentUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('preferences.')) {
      const prefKey = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        preferences: { ...prev.preferences, [prefKey]: value },
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(t('errorGeneral'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(t('errorGeneral'));
      return;
    }
    try {
      setUploadingPhoto(true);
      const fileRef = ref(storage, `profile-photos/${userProfile.id}/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const photoURL = await getDownloadURL(snapshot.ref);
      await updateUserProfile({ photoURL });
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert(t('errorGeneral'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      // Resolve locality label
      let localityLabel = '';
      if (formData.localityId) {
        const loc = localities.find(l => l.id === formData.localityId);
        if (loc) localityLabel = `${loc.country} → ${loc.city} → ${loc.area}`;
      }

      await updateUserProfile({
        displayName: formData.displayName.trim(),
        fullName: formData.fullName.trim(),
        phoneNumber: formData.phoneNumber,
        gender: formData.gender,
        localityId: formData.localityId,
        localityLabel,
        preferences: {
          dietary: formData.preferences.dietary,
          interests: formData.preferences.interests,
          experience: formData.preferences.experience.trim(),
        },
      });
      setSaveMessage(t('profileSaved'));
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(t('errorGeneral'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async (toUserId, starValue) => {
    if (!currentUser) return;
    setRatingLoading(toUserId);
    try {
      const existing = ratingsGiven[toUserId];
      const ratingData = {
        fromUserId: currentUser.uid,
        toUserId,
        numericRating: starValue,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      if (existing) {
        await updateDoc(doc(db, 'ratings', existing.id), {
          numericRating: starValue,
          lastUpdated: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'ratings'), ratingData);
      }
      const person = metPeople.find(p => p.id === toUserId);
      setRatingMessages(prev => ({
        ...prev,
        [toUserId]: t('ratingSubmittedFor', { name: person?.displayName || person?.name || toUserId }),
      }));
      setTimeout(() => {
        setRatingMessages(prev => { const n = { ...prev }; delete n[toUserId]; return n; });
      }, 3000);
    } catch (err) {
      console.error('Rating error:', err);
    } finally {
      setRatingLoading(null);
    }
  };

  const handleConnectRequest = async (targetUserId) => {
    if (!currentUser) return;
    setContactLoading(targetUserId);
    try {
      await addDoc(collection(db, 'contactPermissions'), {
        requesterId: currentUser.uid,
        targetUserId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        reviewedAt: null,
      });
    } catch (err) {
      console.error('Connect request error:', err);
    } finally {
      setContactLoading(null);
    }
  };

  const handleIncomingRequest = async (requestId, newStatus) => {
    setIncomingActionLoading(requestId);
    try {
      await updateDoc(doc(db, 'contactPermissions', requestId), {
        status: newStatus,
        reviewedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error updating connection request:', err);
    } finally {
      setIncomingActionLoading(null);
    }
  };

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();
    if (!appealText.trim() || !currentUser) return;
    try {
      setAppealLoading(true);
      await addDoc(collection(db, 'appeals'), {
        userId: currentUser.uid,
        message: appealText.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
      });
      setAppealText('');
      setShowAppealForm(false);
    } catch (err) {
      console.error('Appeal error:', err);
    } finally {
      setAppealLoading(false);
    }
  };

  // Face-based rating options: index 0 = value 1 (very happy) ... index 4 = value 5 (very unhappy)
  const faceRatings = [
    { value: 1, emoji: '😍', desc: t('face1Desc') },
    { value: 2, emoji: '😊', desc: t('face2Desc') },
    { value: 3, emoji: '😐', desc: t('face3Desc') },
    { value: 4, emoji: '😞', desc: t('face4Desc') },
    { value: 5, emoji: '😢', desc: t('face5Desc') },
  ];

  return (
    <div className="user-profile">
      <div className="profile-header">
        <button className="back-btn" onClick={onBack}>
          ← {t('dashboard')}
        </button>
        <h2>{t('editProfile')}</h2>
      </div>

      <div className="profile-content">
        {/* Photo Section */}
        <div className="profile-photo-section">
          <div className="current-photo">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="Profile" className="profile-photo" />
            ) : (
              <div className="photo-placeholder">
                {(userProfile?.displayName || userProfile?.name || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="photo-upload">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? '...' : '📷 ' + t('editProfile')}
            </button>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="profile-form">
          {/* Basic Information */}
          <div className="form-section">
            <h3>📋 {t('displayName')}</h3>

            <div className="form-group">
              <label htmlFor="displayName">{t('displayName')} *</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleInputChange}
                required
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label htmlFor="fullName">{t('fullName')}</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber">{t('phone')}</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                maxLength={20}
                placeholder="+20 123 456 7890"
              />
            </div>

            <div className="form-group">
              <label htmlFor="gender">{t('gender')}</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
              >
                <option value="">—</option>
                <option value="male">Male / ذكر</option>
                <option value="female">Female / أنثى</option>
              </select>
            </div>
          </div>

          {/* Locality */}
          <div className="form-section">
            <h3>📍 {t('locality')}</h3>
            {/* Show organizer-assigned locality as read-only for admins/organizers */}
            {isAdmin() && userProfile?.organizerLocalityId && (
              <div className="form-group">
                <label>{t('roleAdmin')} {t('locality')}</label>
                <p className="organizer-locality-readonly">
                  🏢 {userProfile.organizerLocalityLabel || userProfile.organizerLocalityId}
                </p>
                <small className="field-note">
                  {t('organizerLocalityNote')}
                </small>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="localityId">{t('localitySelect')}</label>
              <select
                id="localityId"
                name="localityId"
                value={formData.localityId}
                onChange={handleInputChange}
              >
                <option value="">— {t('localitySelect')} —</option>
                {localities.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.country} → {loc.city} → {loc.area}
                  </option>
                ))}
              </select>
              {isAdmin() && (
                <small className="field-note">
                  {t('attendanceLocalityNote')}
                </small>
              )}
            </div>
          </div>

          {/* Preferences & Interests */}
          <div className="form-section">
            <h3>❤️ {t('interests')}</h3>

            <div className="form-group">
              <label>{t('dietary')}</label>
              <select
                id="preferences.dietary"
                name="preferences.dietary"
                value={formData.preferences.dietary}
                onChange={handleInputChange}
              >
                <option value="">No specific preference</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="pescatarian">Pescatarian</option>
                <option value="halal">Halal</option>
                <option value="kosher">Kosher</option>
                <option value="gluten-free">Gluten-free</option>
                <option value="dairy-free">Dairy-free</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>{t('interests')}</label>
              <InterestsEditor
                interests={formData.preferences.interests}
                onChange={(updated) => setFormData(prev => ({
                  ...prev,
                  preferences: { ...prev.preferences, interests: updated },
                }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="preferences.experience">{t('experience')}</label>
              <small className="field-note">{t('experienceNote')}</small>
              <textarea
                id="preferences.experience"
                name="preferences.experience"
                value={formData.preferences.experience}
                onChange={handleInputChange}
                rows={3}
                maxLength={500}
                placeholder="e.g. Software engineer, doctor, educator..."
              />
            </div>
          </div>

          {saveMessage && <p className="save-success-msg">{saveMessage}</p>}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              {t('cancelForm')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '...' : t('saveProfile')}
            </button>
          </div>
        </form>

        {/* Incoming Connection Requests — visible to the destination user */}
        {incomingRequests.length > 0 && (
          <div className="incoming-requests-section">
            <h3>🔔 {t('pendingConnectionRequests')}</h3>
            <div className="incoming-requests-list">
              {incomingRequests.map(req => {
                const requester = incomingRequestors[req.requesterId];
                const name = requester?.displayName || requester?.name || req.requesterId;
                return (
                  <div key={req.id} className="incoming-request-item">
                    <div className="person-info">
                      <div className="person-avatar">
                        {requester?.photoURL
                          ? <img src={requester.photoURL} alt="" />
                          : name[0].toUpperCase()
                        }
                      </div>
                      <div className="person-details">
                        <strong>{name}</strong>
                        {requester?.localityLabel && <small>📍 {requester.localityLabel}</small>}
                        <p className="request-msg">{t('connectionRequestFrom', { name })}</p>
                      </div>
                    </div>
                    <div className="request-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleIncomingRequest(req.id, 'approved')}
                        disabled={incomingActionLoading === req.id}
                      >
                        ✅ {t('acceptRequest')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleIncomingRequest(req.id, 'rejected')}
                        disabled={incomingActionLoading === req.id}
                      >
                        ✕ {t('rejectRequest')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Met People & Ratings */}
        <div className="met-people-section">
          <h3>🤝 {t('metPeople')}</h3>
          {metPeople.length === 0 ? (
            <p className="empty-state-text">{t('metPeopleEmpty')}</p>
          ) : (
            <div className="met-people-list">
              {metPeople.map(person => {
                const existingRating = ratingsGiven[person.id];
                const contactReq = contactRequests[person.id];
                const isApproved = contactReq?.status === 'approved';

                return (
                  <div key={person.id} className="met-person-card">
                    <div className="person-info">
                      <div className="person-avatar">
                        {person.photoURL
                          ? <img src={person.photoURL} alt="" />
                          : (person.displayName || person.name || '?')[0].toUpperCase()
                        }
                      </div>
                      <div className="person-details">
                        <strong>{person.displayName || person.name}</strong>
                        {person.localityLabel && (
                          <small>📍 {person.localityLabel}</small>
                        )}
                      </div>
                    </div>

                    {/* Face-based Rating */}
                    <div className="face-rating-row">
                      <span className="rating-label">{t('ratePerson')}:</span>
                      <div className="face-rating-buttons">
                        {faceRatings.map(({ value, emoji, desc }) => (
                          <button
                            key={value}
                            type="button"
                            className={`face-btn ${existingRating?.numericRating === value ? 'face-selected' : ''}`}
                            onClick={() => handleSubmitRating(person.id, value)}
                            disabled={ratingLoading === person.id}
                            title={desc}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      {ratingMessages[person.id] && (
                        <span className="rating-saved-msg">{ratingMessages[person.id]}</span>
                      )}
                    </div>

                    {/* Connect Request */}
                    <div className="connect-row">
                      {contactReq ? (
                        <div className="connect-status-block">
                          <span className={`connect-status connect-${contactReq.status}`}>
                            {isApproved
                              ? '✅ ' + t('connectRequestApproved')
                              : contactReq.status === 'rejected'
                                ? '✗ ' + t('connectRequestRejected')
                                : '⏳ ' + t('connectRequestPending')}
                          </span>
                          {/* Show phone number when connection is approved */}
                          {isApproved && person.phoneNumber && (
                            <div className="phone-reveal">
                              <span className="phone-number">
                                📞 {t('phoneNumber')}: <strong>{person.phoneNumber}</strong>
                              </span>
                              <a
                                href={`https://wa.me/${person.phoneNumber.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-sm whatsapp-btn"
                              >
                                💬 {t('callOrWhatsApp')}
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleConnectRequest(person.id)}
                          disabled={contactLoading === person.id}
                        >
                          🤝 {t('connectRequest')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Account Information */}
        <div className="account-info">
          <h3>🔐 {t('accountInfo')}</h3>
          <div className="info-grid">
            <div className="info-item">
              <strong>{t('displayName')}:</strong>{' '}
              {userProfile?.displayName || '—'}
            </div>
            <div className="info-item">
              <strong>Email:</strong> {userProfile?.email || '—'}
            </div>
            <div className="info-item">
              <strong>{t('accountStatus')}:</strong>{' '}
              {userProfile?.isBlocked ? (
                <span className="status-blocked">{t('accountBlocked')}</span>
              ) : (
                <span className="status-active">{t('accountActive')}</span>
              )}
            </div>
            <div className="info-item">
              <strong>Member Since:</strong>{' '}
              {userProfile?.createdAt
                ? new Date(userProfile.createdAt).toLocaleDateString()
                : '—'}
            </div>
          </div>

          {/* Blocked: show appeal option */}
          {userProfile?.isBlocked && (
            <div className="blocked-notice">
              <p>{t('accountBlockedNote')}</p>
              {appealStatus?.status === 'pending' ? (
                <p className="appeal-pending-msg">⏳ {t('appealPending')}</p>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => setShowAppealForm(v => !v)}
                  >
                    📝 {t('appealButton')}
                  </button>
                  {showAppealForm && (
                    <form onSubmit={handleSubmitAppeal} className="appeal-form">
                      <textarea
                        value={appealText}
                        onChange={e => setAppealText(e.target.value)}
                        rows={3}
                        placeholder={t('appealPlaceholder')}
                        maxLength={1000}
                        required
                      />
                      <button type="submit" className="btn-primary" disabled={appealLoading}>
                        {appealLoading ? '...' : t('appealSubmit')}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfile;
