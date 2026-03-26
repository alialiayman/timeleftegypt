import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { useNativeApp } from '../contexts/NativeAppContext';
import SubscriptionScreen from './SubscriptionScreen';

const DIETARY_OPTIONS = [
  { key: '', label: 'No preference' },
  { key: 'halal', label: 'Halal' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'pescatarian', label: 'Pescatarian' },
  { key: 'kosher', label: 'Kosher' },
  { key: 'gluten_free', label: 'Gluten-free' },
  { key: 'dairy_free', label: 'Dairy-free' },
  { key: 'nut_allergy', label: 'Nut allergy' },
  { key: 'other', label: 'Other' },
];

const RELATIONSHIP_OPTIONS = [
  { key: '', label: 'Prefer not to say' },
  { key: 'single', label: 'Single' },
  { key: 'in_a_relationship', label: 'In a relationship' },
  { key: 'married', label: 'Married' },
  { key: 'divorced', label: 'Divorced' },
  { key: 'widowed', label: 'Widowed' },
];

const CHILDREN_OPTIONS = [
  { key: '', label: 'Prefer not to say' },
  { key: 'none', label: 'No children' },
  { key: '1', label: '1 child' },
  { key: '2', label: '2 children' },
  { key: '3+', label: '3+ children' },
];

const INTEREST_OPTIONS = [
  { value: 'Coffee', icon: 'coffee' },
  { value: 'Movies', icon: 'movie-open' },
  { value: 'Paddle', icon: 'table-tennis' },
  { value: 'Dining', icon: 'silverware-fork-knife' },
  { value: 'Books', icon: 'book-open-variant' },
  { value: 'Networking', icon: 'account-group' },
  { value: 'Fitness', icon: 'dumbbell' },
  { value: 'Hiking', icon: 'hiking' },
  { value: 'Travel', icon: 'airplane' },
  { value: 'Art', icon: 'palette' },
  { value: 'Music', icon: 'music-note' },
  { value: 'Gaming', icon: 'gamepad-variant' },
  { value: 'Tech', icon: 'laptop' },
  { value: 'Photography', icon: 'camera' },
  { value: 'Volunteering', icon: 'hand-heart' },
  { value: 'Startups', icon: 'rocket-launch' },
  { value: 'Language Exchange', icon: 'forum' },
  { value: 'Board Games', icon: 'chess-rook' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _MAX_YEAR = new Date().getFullYear();
const ALL_YEARS = Array.from({ length: _MAX_YEAR - 1919 }, (_, i) => _MAX_YEAR - i);
const COL_ITEM_H = 50;

function DateColumnPicker({ visible, value, onConfirm, onCancel }) {
  const init = (value instanceof Date && !isNaN(value.getTime())) ? value : new Date(1995, 0, 1);
  const [selYear, setSelYear] = useState(init.getFullYear());
  const [selMonth, setSelMonth] = useState(init.getMonth());
  const [selDay, setSelDay] = useState(init.getDate());

  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const DAYS = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const safeDay = Math.min(selDay, daysInMonth);

  const dayRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      dayRef.current?.scrollToOffset({ offset: (safeDay - 1) * COL_ITEM_H, animated: false });
      monthRef.current?.scrollToOffset({ offset: selMonth * COL_ITEM_H, animated: false });
      const yIdx = ALL_YEARS.indexOf(selYear);
      if (yIdx >= 0) yearRef.current?.scrollToOffset({ offset: yIdx * COL_ITEM_H, animated: false });
    }, 200);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (selDay !== safeDay) setSelDay(safeDay);
    dayRef.current?.scrollToOffset({ offset: (safeDay - 1) * COL_ITEM_H, animated: true });
  }, [daysInMonth]);

  const makeHandler = (items, callback) => (e) => {
    const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / COL_ITEM_H), items.length - 1));
    callback(items[idx]);
  };

  const renderCol = (ref, data, selectedVal, onScroll, labelFn) => (
    <View style={{ flex: 1 }}>
      <View pointerEvents="none" style={{
        position: 'absolute', top: COL_ITEM_H * 2, left: 4, right: 4,
        height: COL_ITEM_H, backgroundColor: '#F0FDF4',
        borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: '#2EDC9A',
        borderRadius: 10,
      }} />
      <FlatList
        ref={ref}
        data={data}
        keyExtractor={(_, i) => String(i)}
        snapToInterval={COL_ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        style={{ height: COL_ITEM_H * 5 }}
        contentContainerStyle={{ paddingVertical: COL_ITEM_H * 2 }}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => {
          const isSelected = item === selectedVal;
          return (
            <View style={{ height: COL_ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{
                fontSize: isSelected ? 20 : 15,
                fontWeight: isSelected ? '700' : '400',
                color: isSelected ? '#065F46' : '#9CA3AF',
              }}>
                {labelFn(item)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 30 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#E5E7EB' }}>
            <Pressable onPress={onCancel}><Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>Cancel</Text></Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1F2937' }}>Date of Birth</Text>
            <Pressable onPress={() => onConfirm(new Date(selYear, selMonth, safeDay))}>
              <Text style={{ color: '#2EDC9A', fontSize: 16, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 }}>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 }}>DAY</Text>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 }}>MONTH</Text>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 }}>YEAR</Text>
          </View>
          <View style={{ flexDirection: 'row', paddingHorizontal: 4 }}>
            {renderCol(dayRef, DAYS, safeDay, makeHandler(DAYS, setSelDay), (d) => String(d).padStart(2, '0'))}
            {renderCol(monthRef, MONTH_LABELS, MONTH_LABELS[selMonth], makeHandler(MONTH_LABELS, (m) => setSelMonth(MONTH_LABELS.indexOf(m))), (m) => m)}
            {renderCol(yearRef, ALL_YEARS, selYear, makeHandler(ALL_YEARS, setSelYear), (y) => String(y))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function UserProfileScreen({ onSignOut }) {
  const { db, currentUser, userProfile, profileLoading, updateUserProfile } = useNativeApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [localities, setLocalities] = useState([]);
  const [showLocalityModal, setShowLocalityModal] = useState(false);
  const [localitySearch, setLocalitySearch] = useState('');
  const [showDietaryModal, setShowDietaryModal] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  const [form, setForm] = useState({
    displayName: '',
    fullName: '',
    dateOfBirth: '',
    phoneNumber: '',
    city: '',
    gender: '',
    localityId: '',
    localityLabel: '',
    dietary: '',
    experience: '',
    interests: [],
    relationshipStatus: '',
    children: '',
    workIndustry: '',
  });

  useEffect(() => {
    if (!db || !currentUser?.uid) return;
    let active = true;

    const loadData = async () => {
      try {
        const localitySnap = await getDocs(collection(db, 'localities'));

        const localityList = localitySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (active) setLocalities(localityList);

        if (userProfile && active) {
          const data = userProfile;
          const interestsRaw = data.preferences?.interests;
          const interests = Array.isArray(interestsRaw)
            ? interestsRaw
            : typeof interestsRaw === 'string'
              ? interestsRaw.split(',').map((v) => v.trim()).filter(Boolean)
              : [];

          setForm({
            displayName: data.displayName || currentUser.displayName || '',
            fullName: data.fullName || '',
            dateOfBirth: data.dateOfBirth || '',
            phoneNumber: data.phoneNumber || '',
            city: data.city || '',
            gender: data.gender || '',
            localityId: data.localityId || '',
            localityLabel: data.localityLabel || '',
            dietary: data.preferences?.dietary || '',
            experience: data.preferences?.experience || '',
            interests,
            relationshipStatus: data.relationshipStatus || '',
            children: data.children || '',
            workIndustry: data.workIndustry || '',
          });
        } else if (active) {
          setForm((prev) => ({
            ...prev,
            displayName: currentUser.displayName || '',
            city: prev.city || '',
          }));
        }
      } catch (error) {
        console.error('Load native profile failed:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [db, currentUser?.uid, currentUser?.displayName, userProfile]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 2800);
    return () => clearTimeout(t);
  }, [message]);

  const selectedLocality = useMemo(
    () => localities.find((l) => l.id === form.localityId),
    [localities, form.localityId]
  );

  const filteredLocalities = useMemo(() => {
    const q = localitySearch.trim().toLowerCase();
    if (!q) return localities.slice(0, 100);
    return localities
      .filter((loc) => {
        const label = `${loc.country || ''} ${loc.city || ''} ${loc.area || ''}`.toLowerCase();
        return label.includes(q);
      })
      .slice(0, 120);
  }, [localities, localitySearch]);

  const selectedDietaryLabel = useMemo(() => {
    const found = DIETARY_OPTIONS.find((o) => o.key === form.dietary);
    return found ? found.label : 'No preference';
  }, [form.dietary]);

  const formatDateValue = (date) => {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const parseDateValue = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getGeneration = (dob) => {
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
    const year = parseInt(dob.substring(0, 4), 10);
    if (year >= 2013) return { label: 'Gen Alpha', range: '2013 – present', icon: 'star-shooting', color: '#7C3AED' };
    if (year >= 1997) return { label: 'Gen Z',      range: '1997 – 2012',   icon: 'cellphone',     color: '#2563EB' };
    if (year >= 1981) return { label: 'Millennial', range: '1981 – 1996',   icon: 'laptop',        color: '#0891B2' };
    if (year >= 1965) return { label: 'Gen X',      range: '1965 – 1980',   icon: 'guitar-electric', color: '#D97706' };
    if (year >= 1946) return { label: 'Baby Boomer',range: '1946 – 1964',   icon: 'peace',         color: '#059669' };
    if (year >= 1928) return { label: 'Silent Gen', range: '1928 – 1945',   icon: 'radio',         color: '#6B7280' };
    return { label: 'Greatest Gen', range: 'before 1928', icon: 'medal', color: '#B45309' };
  };

  const openDobPicker = () => setShowDobPicker(true);

  const onDobConfirm = (date) => {
    setForm((p) => ({ ...p, dateOfBirth: formatDateValue(date) }));
    setShowDobPicker(false);
  };

  const selectLocality = (loc) => {
    const label = `${loc.country || ''} -> ${loc.city || ''} -> ${loc.area || ''}`;
    setForm((prev) => ({
      ...prev,
      localityId: loc.id,
      localityLabel: label,
    }));
    setShowLocalityModal(false);
  };

  const toggleInterest = (interest) => {
    setForm((prev) => {
      const has = prev.interests.includes(interest);
      return {
        ...prev,
        interests: has
          ? prev.interests.filter((x) => x !== interest)
          : [...prev.interests, interest],
      };
    });
  };

  const selectDietary = (value) => {
    setForm((prev) => ({ ...prev, dietary: value }));
    setShowDietaryModal(false);
  };

  const saveProfile = async () => {
    if (!db || !currentUser?.uid) return;
    if (!form.displayName.trim()) {
      setMessage('Display name is required.');
      return;
    }
    if (form.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth.trim())) {
      setMessage('Date of birth must be in YYYY-MM-DD format (including year).');
      return;
    }

    setSaving(true);
    try {
      const interestsArr = form.interests;

      await updateUserProfile({
        displayName: form.displayName.trim(),
        name: form.displayName.trim(),
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        phoneNumber: form.phoneNumber.trim(),
        city: form.city.trim(),
        gender: form.gender,
        localityId: form.localityId || '',
        localityLabel: form.localityLabel || '',
        relationshipStatus: form.relationshipStatus || '',
        children: form.children || '',
        workIndustry: form.workIndustry.trim(),
        preferences: {
          dietary: form.dietary,
          experience: form.experience,
          interests: interestsArr,
        },
      });
      setMessage('Profile saved.');
    } catch (error) {
      console.error('Save native profile failed:', error);
      setMessage('Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2EDC9A" />
      </View>
    );
  }

  const photoUrl = userProfile?.customPhotoUrl || currentUser?.photoURL || userProfile?.photoURL || '';
  const memberSince = userProfile?.createdAt
    ? new Date(userProfile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'Unknown';
  const status = userProfile?.isBlocked ? 'Blocked' : 'Active';
  const eventsAttended = userProfile?.eventsAttendedCount || 0;
  const friendsMet = userProfile?.friendsMetCount || 0;

  if (showSubscription) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <SubscriptionScreen onBack={() => setShowSubscription(false)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Profile</Text>
      {message ? <Text style={styles.banner}>{message}</Text> : null}

      {/* Profile header: photo + stats */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {(form.displayName || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.statsWrap}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{eventsAttended}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{friendsMet}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statusBadge, status === 'Active' ? styles.statusActive : styles.statusBlocked]}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>
      </View>
      <Text style={styles.memberSince}>Member since {memberSince}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={form.displayName}
          onChangeText={(v) => setForm((p) => ({ ...p, displayName: v }))}
          placeholder="Your display name"
        />

        <Text style={styles.label}>Email</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{currentUser?.email || userProfile?.email || '-'}</Text>
        </View>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(v) => setForm((p) => ({ ...p, fullName: v }))}
          placeholder="Your full name"
        />

        <Text style={styles.label}>Date of Birth</Text>
        {Platform.OS === 'web' ? (
          <TextInput
            style={styles.input}
            value={form.dateOfBirth}
            onChangeText={(v) => setForm((p) => ({ ...p, dateOfBirth: v }))}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        ) : (
          <Pressable style={styles.selectorField} onPress={openDobPicker}>
            <Text style={styles.selectorText}>{form.dateOfBirth || 'Tap to select date of birth'}</Text>
          </Pressable>
        )}
        {(() => { const gen = getGeneration(form.dateOfBirth); return gen ? (
          <View style={styles.genBadge}>
            <MaterialCommunityIcons name={gen.icon} size={18} color={gen.color} />
            <Text style={[styles.genBadgeText, { color: gen.color }]}>{gen.label}</Text>
            <Text style={styles.genBadgeRange}>{gen.range}</Text>
          </View>
        ) : (
          <Text style={styles.fieldHint}>Once entered, we will show you your generation. Also helps match you with people of a similar age.</Text>
        ); })()}

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={form.phoneNumber}
          onChangeText={(v) => setForm((p) => ({ ...p, phoneNumber: v }))}
          placeholder="+20 ..."
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={form.city}
          onChangeText={(v) => setForm((p) => ({ ...p, city: v }))}
          placeholder="Cairo"
        />
        <Text style={styles.fieldHint}>Helps us match you with people nearby.</Text>

        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          <Pressable
            style={[styles.choiceButton, form.gender === 'male' && styles.choiceButtonActive]}
            onPress={() => setForm((p) => ({ ...p, gender: 'male' }))}
          >
            <Text style={[styles.choiceText, form.gender === 'male' && styles.choiceTextActive]}>Male</Text>
          </Pressable>
          <Pressable
            style={[styles.choiceButton, form.gender === 'female' && styles.choiceButtonActive]}
            onPress={() => setForm((p) => ({ ...p, gender: 'female' }))}
          >
            <Text style={[styles.choiceText, form.gender === 'female' && styles.choiceTextActive]}>Female</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Relationship Status</Text>
        <View style={styles.chipRow}>
          {RELATIONSHIP_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.choiceChip, form.relationshipStatus === opt.key && styles.choiceChipActive]}
              onPress={() => setForm((p) => ({ ...p, relationshipStatus: opt.key }))}
            >
              <Text style={[styles.choiceChipText, form.relationshipStatus === opt.key && styles.choiceChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Children</Text>
        <View style={styles.chipRow}>
          {CHILDREN_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.choiceChip, form.children === opt.key && styles.choiceChipActive]}
              onPress={() => setForm((p) => ({ ...p, children: opt.key }))}
            >
              <Text style={[styles.choiceChipText, form.children === opt.key && styles.choiceChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Work Industry</Text>
        <TextInput
          style={styles.input}
          value={form.workIndustry}
          onChangeText={(v) => setForm((p) => ({ ...p, workIndustry: v }))}
          placeholder="e.g. Technology, Healthcare, Finance"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Locality</Text>
        <Text style={styles.helperText}>Search and select your locality.</Text>
        <Pressable style={styles.selectorField} onPress={() => setShowLocalityModal(true)}>
          <Text style={styles.selectorText}>
            {selectedLocality ? `${selectedLocality.country} -> ${selectedLocality.city} -> ${selectedLocality.area}` : 'Choose locality'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferences</Text>

        <Text style={styles.label}>Dietary</Text>
        <Pressable style={styles.selectorField} onPress={() => setShowDietaryModal(true)}>
          <Text style={styles.selectorText}>{selectedDietaryLabel}</Text>
        </Pressable>

        <Text style={styles.label}>Interests</Text>
        <Text style={styles.helperText}>Pick as many as you like. Your interests can span multiple lines.</Text>
        <View style={styles.chipsWrap}>
          {INTEREST_OPTIONS.map((interest) => {
            const active = form.interests.includes(interest.value);
            return (
              <Pressable
                key={interest.value}
                style={[styles.interestCard, active && styles.interestCardActive]}
                onPress={() => toggleInterest(interest.value)}
              >
                <MaterialCommunityIcons
                  name={interest.icon}
                  size={22}
                  color={active ? '#2EDC9A' : '#6B7280'}
                  style={styles.interestIcon}
                />
                <Text style={[styles.interestText, active && styles.interestTextActive]}>{interest.value}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Experience</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={form.experience}
          onChangeText={(v) => setForm((p) => ({ ...p, experience: v }))}
          placeholder="Tell us about your background — used to match you with like-minded people"
          multiline
        />
      </View>

      <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={saveProfile} disabled={saving}>
        <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
      </Pressable>

      {/* Subscription section */}
      <Pressable style={styles.subscriptionBanner} onPress={() => setShowSubscription(true)}>
        <MaterialCommunityIcons name="crown-outline" size={22} color="#7C3AED" />
        <View style={styles.subscriptionBannerText}>
          <Text style={styles.subscriptionBannerTitle}>Subscription Plans</Text>
          <Text style={styles.subscriptionBannerSub}>View plans, weekly pricing, and promo codes</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
      </Pressable>

      {/* Logout + links */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>

        <Pressable style={styles.dangerButton} onPress={onSignOut}>
          <MaterialCommunityIcons name="logout" size={18} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={styles.dangerButtonText}>Sign Out</Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL('https://timeleftegypt.firebaseapp.com/privacy-policy')}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.legalSep}> · </Text>
          <Pressable onPress={() => Linking.openURL('https://timeleftegypt.firebaseapp.com/terms-of-service')}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={showLocalityModal} animationType="slide" onRequestClose={() => setShowLocalityModal(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Locality</Text>
            <Pressable onPress={() => setShowLocalityModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            value={localitySearch}
            onChangeText={setLocalitySearch}
            placeholder="Search country, city, or area"
          />
          <FlatList
            data={filteredLocalities}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const label = `${item.country || ''} -> ${item.city || ''} -> ${item.area || ''}`;
              const active = form.localityId === item.id;
              return (
                <Pressable style={[styles.listRow, active && styles.listRowActive]} onPress={() => selectLocality(item)}>
                  <Text style={[styles.listRowText, active && styles.listRowTextActive]}>{label}</Text>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.modalListContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No locality matches your search.</Text>}
          />
        </View>
      </Modal>

      <Modal visible={showDietaryModal} animationType="slide" onRequestClose={() => setShowDietaryModal(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Dietary Preference</Text>
            <Pressable onPress={() => setShowDietaryModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={DIETARY_OPTIONS}
            keyExtractor={(item) => item.key || 'none'}
            renderItem={({ item }) => {
              const active = form.dietary === item.key;
              return (
                <Pressable style={[styles.listRow, active && styles.listRowActive]} onPress={() => selectDietary(item.key)}>
                  <Text style={[styles.listRowText, active && styles.listRowTextActive]}>{item.label}</Text>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.modalListContent}
          />
        </View>
      </Modal>

      <DateColumnPicker
        visible={showDobPicker && Platform.OS !== 'web'}
        value={parseDateValue(form.dateOfBirth)}
        onConfirm={onDobConfirm}
        onCancel={() => setShowDobPicker(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  banner: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    color: '#0369A1',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
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
  label: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#1F2937',
    marginBottom: 8,
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
  readOnlyField: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#F3F4F6',
  },
  readOnlyText: {
    color: '#1F2937',
    fontSize: 14,
  },
  selectorField: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  selectorText: {
    color: '#1F2937',
    fontSize: 14,
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  interestCard: {
    width: '48%',
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAF7',
    justifyContent: 'center',
    alignItems: 'flex-start',
    boxShadow: '0px 6px 16px rgba(46, 220, 154, 0.08)',
  },
  interestCardActive: {
    borderColor: '#2EDC9A',
    backgroundColor: '#F0FDF4',
  },
  interestIcon: {
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 2,
    lineHeight: 17,
  },
  genBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  genBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  genBadgeRange: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  interestText: {
    color: '#1F2937',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
  },
  interestTextActive: {
    color: '#2EDC9A',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  choiceButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  choiceButtonActive: {
    borderColor: '#2EDC9A',
    backgroundColor: '#F0FDF4',
  },
  choiceText: {
    textAlign: 'center',
    color: '#1F2937',
    fontWeight: '600',
  },
  choiceTextActive: {
    color: '#2EDC9A',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#FAFAF7',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalClose: {
    color: '#2EDC9A',
    fontWeight: '700',
  },
  modalListContent: {
    paddingTop: 12,
    paddingBottom: 30,
  },
  listRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  listRowActive: {
    borderColor: '#2EDC9A',
    backgroundColor: '#F0FDF4',
  },
  listRowText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  listRowTextActive: {
    color: '#2EDC9A',
  },

  emptyText: {
    color: '#1F2937',
    fontSize: 14,
    paddingTop: 12,
  },
  primaryButton: {
    backgroundColor: '#2EDC9A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#0B5D40',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: '#1F2937',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  ghostButton: {
    paddingVertical: 8,
  },
  ghostButtonText: {
    textAlign: 'center',
    color: '#0EA5E9',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#5B21B6',
  },
  statsWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  statusBadge: {
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
  },
  statusBlocked: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  memberSince: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
    marginLeft: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  choiceChipActive: {
    borderColor: '#2EDC9A',
    backgroundColor: '#ECFDF5',
  },
  choiceChipText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  choiceChipTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    backgroundColor: '#F5F3FF',
    padding: 14,
    marginBottom: 12,
  },
  subscriptionBannerText: {
    flex: 1,
  },
  subscriptionBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4C1D95',
    marginBottom: 2,
  },
  subscriptionBannerSub: {
    fontSize: 12,
    color: '#7C3AED',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dangerButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalLink: {
    fontSize: 13,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  legalSep: {
    fontSize: 13,
    color: '#D1D5DB',
  },
});
