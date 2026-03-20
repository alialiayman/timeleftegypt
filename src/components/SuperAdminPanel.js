import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useNativeApp } from '../contexts/NativeAppContext';

const EMPTY_FORM = { country: '', city: '', area: '', adminIds: [] };

function UserCheck({ item, selected, onToggle }) {
  return (
    <Pressable style={[styles.userCheck, selected && styles.userCheckActive]} onPress={() => onToggle(item.id)}>
      <Text style={[styles.userCheckName, selected && styles.userCheckNameActive]}>{item.displayName || item.name || item.email || item.id}</Text>
      <Text style={styles.userCheckMeta}>{item.email || '-'}</Text>
    </Pressable>
  );
}

export default function SuperAdminPanelScreen() {
  const { db } = useNativeApp();
  const [localities, setLocalities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db) return undefined;
    const q1 = query(collection(db, 'localities'), orderBy('country'));
    const q2 = query(collection(db, 'users'), orderBy('displayName'));

    const unsub1 = onSnapshot(q1, (snap) => {
      setLocalities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(q2, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [db]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const name = (u.displayName || u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [users, search]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId('');
    setForm(EMPTY_FORM);
    setSearch('');
  };

  const openNew = () => {
    setShowForm(true);
    setEditingId('');
    setForm(EMPTY_FORM);
  };

  const openEdit = (loc) => {
    setShowForm(true);
    setEditingId(loc.id);
    setForm({
      country: loc.country || '',
      city: loc.city || '',
      area: loc.area || '',
      adminIds: loc.adminIds || [],
    });
  };

  const toggleAdminId = (uid) => {
    setForm((prev) => ({
      ...prev,
      adminIds: prev.adminIds.includes(uid) ? prev.adminIds.filter((id) => id !== uid) : [...prev.adminIds, uid],
    }));
  };

  const syncOrganizerLocalities = async (localityId, localityLabel, newAdminIds, oldAdminIds) => {
    const added = newAdminIds.filter((id) => !oldAdminIds.includes(id));
    const removed = oldAdminIds.filter((id) => !newAdminIds.includes(id));

    for (const uid of added) {
      await setDoc(
        doc(db, 'users', uid),
        {
          organizerLocalityId: localityId,
          organizerLocalityLabel: localityLabel,
          role: 'admin',
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    for (const uid of removed) {
      const userDoc = doc(db, 'users', uid);
      const userSnap = await getDoc(userDoc);
      const currentRole = userSnap.exists() ? userSnap.data()?.role || '' : '';
      const nextRole = currentRole === 'admin' || currentRole === 'event_admin' ? '' : currentRole;
      await setDoc(
        userDoc,
        {
          organizerLocalityId: '',
          organizerLocalityLabel: '',
          role: nextRole,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  };

  const saveForm = async () => {
    if (!form.country.trim() || !form.city.trim() || !form.area.trim()) return;
    setSaving(true);
    try {
      const payload = {
        country: form.country.trim(),
        city: form.city.trim(),
        area: form.area.trim(),
        adminIds: form.adminIds,
        lastUpdated: new Date().toISOString(),
      };
      const label = `${payload.country} -> ${payload.city} -> ${payload.area}`;

      if (editingId) {
        const prev = localities.find((l) => l.id === editingId);
        const oldAdminIds = prev?.adminIds || [];
        await updateDoc(doc(db, 'localities', editingId), payload);
        await syncOrganizerLocalities(editingId, label, payload.adminIds, oldAdminIds);
      } else {
        const ref = await addDoc(collection(db, 'localities'), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        await syncOrganizerLocalities(ref.id, label, payload.adminIds, []);
      }

      resetForm();
    } catch (error) {
      console.error('Save locality failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const removeLocality = async (loc) => {
    try {
      const oldAdmins = loc.adminIds || [];
      await syncOrganizerLocalities(loc.id, '', [], oldAdmins);
      await deleteDoc(doc(db, 'localities', loc.id));
    } catch (error) {
      console.error('Delete locality failed:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2EDC9A" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Master Panel</Text>

      <View style={styles.actionsTop}>
        <Pressable style={styles.primaryButton} onPress={openNew}>
          <Text style={styles.primaryButtonText}>Add Locality</Text>
        </Pressable>
      </View>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{editingId ? 'Edit Locality' : 'New Locality'}</Text>

          <Text style={styles.label}>Country</Text>
          <TextInput style={styles.input} value={form.country} onChangeText={(v) => setForm((p) => ({ ...p, country: v }))} />

          <Text style={styles.label}>City</Text>
          <TextInput style={styles.input} value={form.city} onChangeText={(v) => setForm((p) => ({ ...p, city: v }))} />

          <Text style={styles.label}>Area</Text>
          <TextInput style={styles.input} value={form.area} onChangeText={(v) => setForm((p) => ({ ...p, area: v }))} />

          <Text style={styles.label}>Assign Organizers</Text>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Search users"
          />

          <FlatList
            data={filteredUsers.slice(0, 30)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <UserCheck item={item} selected={form.adminIds.includes(item.id)} onToggle={toggleAdminId} />
            )}
            style={styles.userList}
            scrollEnabled={false}
          />

          <View style={styles.formActions}>
            <Pressable style={[styles.primaryButton, styles.formActionButton, saving && styles.disabled]} onPress={saveForm} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, styles.formActionButton]} onPress={resetForm}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Localities</Text>
        {localities.length === 0 ? <Text style={styles.empty}>No localities yet.</Text> : null}
        {localities.map((loc) => {
          const admins = users.filter((u) => (loc.adminIds || []).includes(u.id));
          return (
            <View key={loc.id} style={styles.localityRow}>
              <Text style={styles.localityTitle}>{loc.country}{' -> '}{loc.city}{' -> '}{loc.area}</Text>
              <Text style={styles.localityMeta}>Organizers: {admins.length ? admins.map((a) => a.displayName || a.name || a.email).join(', ') : '-'}</Text>
              <View style={styles.rowButtons}>
                <Pressable style={styles.secondaryButton} onPress={() => openEdit(loc)}>
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.dangerButton} onPress={() => removeLocality(loc)}>
                  <Text style={styles.dangerButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingBottom: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  actionsTop: { marginBottom: 10 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  label: { fontSize: 14, color: '#1F2937', fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1F2937', backgroundColor: '#fff' },
  userList: { marginTop: 8 },
  userCheck: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: '#F3F4F6' },
  userCheckActive: { borderColor: '#2EDC9A', backgroundColor: '#F0FDF4' },
  userCheckName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  userCheckNameActive: { color: '#2EDC9A' },
  userCheckMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  formActions: { marginTop: 8, flexDirection: 'row', gap: 8 },
  formActionButton: { flex: 1, marginTop: 0 },
  primaryButton: { backgroundColor: '#2EDC9A', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  primaryButtonText: { color: '#0B5D40', textAlign: 'center', fontWeight: '700', fontSize: 13 },
  secondaryButton: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  secondaryButtonText: { color: '#1F2937', textAlign: 'center', fontWeight: '600', fontSize: 13 },
  dangerButton: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  dangerButtonText: { color: '#7F1D1D', textAlign: 'center', fontWeight: '700', fontSize: 13 },
  localityRow: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: '#F3F4F6' },
  localityTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  localityMeta: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  rowButtons: { flexDirection: 'row', gap: 8 },
  empty: { fontSize: 14, color: '#1F2937' },
  disabled: { opacity: 0.6 },
});
