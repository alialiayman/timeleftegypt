import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { useNativeApp } from '../contexts/NativeAppContext';

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

const INTEREST_OPTIONS = [
  { value: 'Coffee', icon: '☕' },
  { value: 'Movies', icon: '🎬' },
  { value: 'Paddle', icon: '🏓' },
  { value: 'Dining', icon: '🍽️' },
  { value: 'Books', icon: '📚' },
  { value: 'Networking', icon: '🤝' },
  { value: 'Fitness', icon: '💪' },
  { value: 'Hiking', icon: '🥾' },
  { value: 'Travel', icon: '✈️' },
  { value: 'Art', icon: '🎨' },
  { value: 'Music', icon: '🎵' },
  { value: 'Gaming', icon: '🎮' },
  { value: 'Tech', icon: '💻' },
  { value: 'Photography', icon: '📷' },
  { value: 'Volunteering', icon: '❤️' },
  { value: 'Startups', icon: '🚀' },
  { value: 'Language Exchange', icon: '🗣️' },
  { value: 'Board Games', icon: '♟️' },
];

export default function UserProfileScreen() {
  const { db, currentUser, userProfile, profileLoading, updateUserProfile } = useNativeApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [localities, setLocalities] = useState([]);
  const [showLocalityModal, setShowLocalityModal] = useState(false);
  const [localitySearch, setLocalitySearch] = useState('');
  const [showDietaryModal, setShowDietaryModal] = useState(false);

  const [form, setForm] = useState({
    displayName: '',
    fullName: '',
    phoneNumber: '',
    city: '',
    gender: '',
    localityId: '',
    localityLabel: '',
    dietary: '',
    experience: '',
    interests: [],
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
            phoneNumber: data.phoneNumber || '',
            city: data.city || '',
            gender: data.gender || '',
            localityId: data.localityId || '',
            localityLabel: data.localityLabel || '',
            dietary: data.preferences?.dietary || '',
            experience: data.preferences?.experience || '',
            interests,
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

    setSaving(true);
    try {
      const interestsArr = form.interests;

      await updateUserProfile({
        displayName: form.displayName.trim(),
        name: form.displayName.trim(),
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        city: form.city.trim(),
        gender: form.gender,
        localityId: form.localityId || '',
        localityLabel: form.localityLabel || '',
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

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Profile</Text>
      {message ? <Text style={styles.banner}>{message}</Text> : null}

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
                <Text style={styles.interestIcon}>{interest.icon}</Text>
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
          placeholder="Tell us about your background"
          multiline
        />
      </View>

      <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={saveProfile} disabled={saving}>
        <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
      </Pressable>

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
    fontSize: 22,
    marginBottom: 8,
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
    color: '#FFFFFF',
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
});
