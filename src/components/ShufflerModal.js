import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNativeApp } from '../contexts/NativeAppContext';

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

/**
 * VenueGroupCard — editable card for a single group after shuffling.
 */
function VenueGroupCard({ group, index, onChange }) {
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>Group {index + 1} — {group.groupName || `Venue ${index + 1}`}</Text>
        <View style={styles.attendeePill}>
          <Text style={styles.attendeePillText}>{group.attendeeNames.length} people</Text>
        </View>
      </View>

      <View style={styles.attendeeList}>
        {group.attendeeNames.map((name, i) => (
          <View key={i} style={styles.attendeeChip}>
            <Text style={styles.attendeeChipText}>{name}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.inputLabel}>Venue Name</Text>
      <TextInput
        style={styles.input}
        value={group.venueName || ''}
        onChangeText={(v) => onChange(index, 'venueName', v)}
        placeholder="e.g. Café Greco"
      />

      <Text style={styles.inputLabel}>Address</Text>
      <TextInput
        style={styles.input}
        value={group.venueAddress || ''}
        onChangeText={(v) => onChange(index, 'venueAddress', v)}
        placeholder="e.g. 12 Tahrir Square, Cairo"
      />

      <Text style={styles.inputLabel}>Google Maps URL</Text>
      <TextInput
        style={styles.input}
        value={group.mapUrl || ''}
        onChangeText={(v) => onChange(index, 'mapUrl', v)}
        placeholder="https://maps.google.com/..."
        keyboardType="url"
        autoCapitalize="none"
      />
    </View>
  );
}

/**
 * ShufflerModal — opened by organizer from event card.
 * Handles: max attendance input → AI grouping → venue assignment → save & notify.
 */
export default function ShufflerModal({ visible, event, onClose, onSaved }) {
  const { db, currentUser } = useNativeApp();
  const [step, setStep] = useState('config'); // 'config' | 'running' | 'assign'
  const [maxPerGroup, setMaxPerGroup] = useState('8');
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);

  const resetAndClose = () => {
    setStep('config');
    setMaxPerGroup('8');
    setGroups([]);
    setSaving(false);
    onClose();
  };

  /**
   * Calls OpenAI to group attendees intelligently based on shared interests,
   * mutual ratings, and age proximity.
   * Falls back to round-robin if OpenAI key is missing or request fails.
   */
  const runShuffle = async () => {
    if (!event?.id || !db) return;

    const max = parseInt(maxPerGroup, 10);
    if (Number.isNaN(max) || max < 2) {
      Alert.alert('Invalid input', 'Max attendance per group must be at least 2.');
      return;
    }

    setStep('running');

    try {
      // Fetch booked attendees
      const bookingsSnap = await getDocs(
        query(collection(db, 'bookings'), where('eventId', '==', event.id), where('status', '==', 'confirmed'))
      );

      const attendeeIds = bookingsSnap.docs.map((d) => d.data().userId).filter(Boolean);

      if (!attendeeIds.length) {
        Alert.alert('No attendees', 'This event has no confirmed bookings yet.');
        setStep('config');
        return;
      }

      // Fetch attendee profiles
      const profiles = [];
      for (const uid of attendeeIds) {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          profiles.push({ id: uid, ...snap.data() });
        } else {
          profiles.push({ id: uid, displayName: uid, preferences: {} });
        }
      }

      // Fetch ratings between attendees (for likeability scoring)
      const ratingsSnap = await getDocs(
        query(collection(db, 'ratings'), where('fromUserId', 'in', attendeeIds.slice(0, 10)))
      );
      const ratingsData = ratingsSnap.docs.map((d) => d.data());

      let assignedGroups = [];

      if (OPENAI_API_KEY) {
        // Build a concise description of each person for the AI
        const peopleSummary = profiles.map((p) => ({
          id: p.id,
          name: p.displayName || p.name || p.id,
          interests: Array.isArray(p.preferences?.interests)
            ? p.preferences.interests.join(', ')
            : (p.preferences?.interests || ''),
          birthYear: p.dateOfBirth ? p.dateOfBirth.substring(0, 4) : '',
          gender: p.gender || '',
        }));

        // Build ratings summary
        const ratingsSummary = ratingsData.map((r) => ({
          from: r.fromUserId,
          to: r.toUserId,
          score: r.score || r.ratingLevel || (r.value === 'like_a_lot' ? 5 : r.value === 'like_a_little' ? 3 : 1),
        }));

        const prompt = `You are grouping ${profiles.length} people into groups of max ${max} for a social event.
Each group should be as compatible as possible: prefer people who rated each other highly, share similar interests, or are close in age.
Avoid putting people who rated each other 1 in the same group if possible.

People:
${JSON.stringify(peopleSummary, null, 2)}

Ratings (score 1-5, 5=best):
${JSON.stringify(ratingsSummary, null, 2)}

Return ONLY valid JSON: an array of groups, each group is an array of person IDs.
Example: [["id1","id2","id3"],["id4","id5"]]
No commentary, no markdown.`;

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3,
              max_tokens: 1000,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const raw = data.choices?.[0]?.message?.content?.trim() || '';
            // Extract JSON array from response
            const jsonMatch = raw.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed) && parsed.length > 0) {
                assignedGroups = parsed.map((groupIds) =>
                  groupIds.map((id) => profiles.find((p) => p.id === id) || { id, displayName: id })
                );
              }
            }
          }
        } catch (aiErr) {
          console.warn('OpenAI grouping failed, falling back to round-robin:', aiErr);
        }
      }

      // Fallback: round-robin if AI grouping failed or key missing
      if (!assignedGroups.length) {
        const shuffled = [...profiles].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length; i += max) {
          assignedGroups.push(shuffled.slice(i, i + max));
        }
      }

      // Build group objects
      const builtGroups = assignedGroups.map((members, i) => ({
        groupId: `group-${i + 1}-${Date.now()}`,
        groupName: `Group ${String.fromCharCode(65 + i)}`,
        attendeeIds: members.map((m) => m.id),
        attendeeNames: members.map((m) => m.displayName || m.name || m.id),
        venueName: '',
        venueAddress: '',
        mapUrl: '',
        locationRevealed: false,
      }));

      setGroups(builtGroups);
      setStep('assign');
    } catch (err) {
      console.error('Shuffler failed:', err);
      Alert.alert('Error', 'Shuffle failed. Please try again.');
      setStep('config');
    }
  };

  const handleGroupChange = (index, field, value) => {
    setGroups((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const saveVenueAssignments = async () => {
    if (!db || !event?.id) return;

    // Validate all groups have a venue name
    const incomplete = groups.findIndex((g) => !g.venueName.trim());
    if (incomplete !== -1) {
      Alert.alert('Incomplete', `Please fill in the venue name for Group ${incomplete + 1}.`);
      return;
    }

    setSaving(true);
    try {
      // Save groups to event document
      const venueGroups = groups.map(({ attendeeNames: _n, ...g }) => g);
      await updateDoc(doc(db, 'events', event.id), {
        venueGroups,
        schedulingCompleted: true,
        locationRevealed: false,
        lastUpdated: new Date().toISOString(),
      });

      // Send notification to each attendee revealing their venue
      for (const group of groups) {
        for (const userId of group.attendeeIds) {
          await addDoc(collection(db, 'notifications'), {
            userId,
            type: 'venue_revealed',
            fromUserId: currentUser?.uid || '',
            eventId: event.id,
            message: `Your venue for "${event.title}" has been assigned: ${group.venueName}${group.venueAddress ? ` — ${group.venueAddress}` : ''}.`,
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      }

      Alert.alert('Saved!', 'Venue assignments have been saved and attendees notified.');
      onSaved && onSaved();
      resetAndClose();
    } catch (err) {
      console.error('Save venue assignments failed:', err);
      Alert.alert('Error', 'Could not save venue assignments.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={resetAndClose}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {step === 'config' ? 'Shuffler Setup' : step === 'running' ? 'Running Shuffler...' : 'Assign Venues'}
          </Text>
          <Pressable onPress={resetAndClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
          </Pressable>
        </View>

        {step === 'config' && (
          <View style={styles.configContent}>
            <Text style={styles.eventLabel}>Event: {event?.title || 'Untitled'}</Text>
            <Text style={styles.configHint}>
              Set the maximum number of people per venue group. The shuffler will organize attendees using smart matching.
            </Text>

            <Text style={styles.inputLabel}>Max Attendance Per Venue</Text>
            <TextInput
              style={styles.input}
              value={maxPerGroup}
              onChangeText={setMaxPerGroup}
              keyboardType="number-pad"
              placeholder="e.g. 8"
            />

            <Pressable style={styles.shuffleButton} onPress={runShuffle}>
              <Text style={styles.shuffleButtonEmoji}>🔀</Text>
              <Text style={styles.shuffleButtonText}>Run Shuffler</Text>
            </Pressable>
          </View>
        )}

        {step === 'running' && (
          <View style={styles.runningContent}>
            <ActivityIndicator size="large" color="#2EDC9A" />
            <Text style={styles.runningText}>Matching people intelligently...</Text>
            <Text style={styles.runningHint}>Using interests, ratings, and age proximity</Text>
          </View>
        )}

        {step === 'assign' && (
          <>
            <ScrollView contentContainerStyle={styles.assignContent}>
              <Text style={styles.assignHint}>
                {groups.length} groups created. Enter venue details for each group, then save to notify attendees.
              </Text>

              {groups.map((group, i) => (
                <VenueGroupCard
                  key={group.groupId}
                  group={group}
                  index={i}
                  onChange={handleGroupChange}
                />
              ))}
            </ScrollView>

            <View style={styles.saveRow}>
              <Pressable
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={saveVenueAssignments}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save & Notify Attendees'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#FAFAF7',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  configContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  eventLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  configHint: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 16,
  },
  shuffleButtonEmoji: {
    fontSize: 22,
  },
  shuffleButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  runningContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  runningText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  runningHint: {
    fontSize: 13,
    color: '#6B7280',
  },
  assignContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  assignHint: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 22,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 14,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  attendeePill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  attendeePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  attendeeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  attendeeChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  attendeeChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  saveRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#2EDC9A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#0B5D40',
    fontSize: 16,
    fontWeight: '700',
  },
});
