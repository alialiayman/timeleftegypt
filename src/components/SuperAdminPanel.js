import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
const EMPTY_PRICING = { price1Month: '', price3Month: '', price6Month: '', currency: 'EGP', promoCode: '', promoDiscount: '' };

function UserCheck({ item, selected, onToggle }) {
  return (
    <Pressable style={[styles.userCheck, selected && styles.userCheckActive]} onPress={() => onToggle(item.id)}>
      <Text style={[styles.userCheckName, selected && styles.userCheckNameActive]}>{item.displayName || item.name || item.email || item.id}</Text>
      <Text style={styles.userCheckMeta}>{item.email || '-'}</Text>
    </Pressable>
  );
}

export default function SuperAdminPanelScreen() {
  const { db, currentUser } = useNativeApp();
  const [localities, setLocalities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  // Subscription pricing state
  const [pricing, setPricing] = useState(EMPTY_PRICING);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingMessage, setPricingMessage] = useState('');
  // Promo codes management (multiple codes)
  const [promoCodes, setPromoCodes] = useState([]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');

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

    // Load subscription pricing
    const loadPricing = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'subscriptionPricing'));
        if (snap.exists()) {
          const data = snap.data();
          setPricing({
            price1Month: String(data.price1Month || ''),
            price3Month: String(data.price3Month || ''),
            price6Month: String(data.price6Month || ''),
            currency: data.currency || 'EGP',
          });
          setPromoCodes(Array.isArray(data.promoCodes) ? data.promoCodes : []);
        }
      } catch (err) {
        console.error('Load pricing failed:', err);
      } finally {
        setPricingLoading(false);
      }
    };
    loadPricing();

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

  const savePricing = async () => {
    const p1 = Number(pricing.price1Month);
    const p3 = Number(pricing.price3Month);
    const p6 = Number(pricing.price6Month);
    if (isNaN(p1) || p1 < 0 || isNaN(p3) || p3 < 0 || isNaN(p6) || p6 < 0) {
      Alert.alert('Invalid', 'Prices must be valid numbers >= 0.');
      return;
    }
    setPricingSaving(true);
    try {
      await setDoc(
        doc(db, 'settings', 'subscriptionPricing'),
        {
          price1Month: p1,
          price3Month: p3,
          price6Month: p6,
          currency: pricing.currency || 'EGP',
          promoCodes,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.uid || '',
        },
        { merge: true }
      );
      setPricingMessage('Pricing saved.');
    } catch (err) {
      console.error('Save pricing failed:', err);
      setPricingMessage('Could not save pricing.');
    } finally {
      setPricingSaving(false);
      setTimeout(() => setPricingMessage(''), 2500);
    }
  };

  const addPromoCode = () => {
    const code = newPromoCode.trim();
    const discount = Number(newPromoDiscount);
    if (!code) { Alert.alert('Invalid', 'Enter a promo code.'); return; }
    if (isNaN(discount) || discount < 0 || discount > 100) {
      Alert.alert('Invalid', 'Discount must be between 0 and 100.');
      return;
    }
    if (promoCodes.some((pc) => pc.code.toLowerCase() === code.toLowerCase())) {
      Alert.alert('Duplicate', 'This promo code already exists.');
      return;
    }
    setPromoCodes((prev) => [...prev, { code, discount }]);
    setNewPromoCode('');
    setNewPromoDiscount('');
  };

  const removePromoCode = (code) => {
    setPromoCodes((prev) => prev.filter((pc) => pc.code !== code));
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

      {/* Subscription Pricing Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💳 Subscription Pricing</Text>
        {pricingMessage ? <Text style={styles.pricingMessage}>{pricingMessage}</Text> : null}
        {pricingLoading ? (
          <ActivityIndicator size="small" color="#2EDC9A" />
        ) : (
          <>
            <Text style={styles.label}>1 Month Price</Text>
            <View style={styles.priceInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={pricing.price1Month}
                onChangeText={(v) => setPricing((p) => ({ ...p, price1Month: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <TextInput
                style={[styles.input, styles.currencyInput]}
                value={pricing.currency}
                onChangeText={(v) => setPricing((p) => ({ ...p, currency: v }))}
                placeholder="EGP"
                autoCapitalize="characters"
              />
            </View>

            <Text style={styles.label}>3 Month Price</Text>
            <TextInput
              style={styles.input}
              value={pricing.price3Month}
              onChangeText={(v) => setPricing((p) => ({ ...p, price3Month: v }))}
              keyboardType="decimal-pad"
              placeholder="0"
            />

            <Text style={styles.label}>6 Month Price</Text>
            <TextInput
              style={styles.input}
              value={pricing.price6Month}
              onChangeText={(v) => setPricing((p) => ({ ...p, price6Month: v }))}
              keyboardType="decimal-pad"
              placeholder="0"
            />

            <Pressable
              style={[styles.primaryButton, pricingSaving && styles.disabled]}
              onPress={savePricing}
              disabled={pricingSaving}
            >
              <Text style={styles.primaryButtonText}>{pricingSaving ? 'Saving...' : 'Save Pricing'}</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Promo Codes Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎟️ Promo Codes</Text>

        {/* Existing promo codes */}
        {promoCodes.length === 0 ? (
          <Text style={styles.empty}>No promo codes yet.</Text>
        ) : (
          promoCodes.map((pc) => (
            <View key={pc.code} style={styles.promoRow}>
              <Text style={styles.promoCode}>{pc.code}</Text>
              <Text style={styles.promoDiscount}>{pc.discount}% off</Text>
              <Pressable style={styles.promoRemove} onPress={() => removePromoCode(pc.code)}>
                <Text style={styles.promoRemoveText}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}

        {/* Add new promo code */}
        <Text style={styles.label}>Add Promo Code</Text>
        <TextInput
          style={styles.input}
          value={newPromoCode}
          onChangeText={setNewPromoCode}
          placeholder="SUMMER2025"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Text style={styles.label}>Discount % (0–100)</Text>
        <TextInput
          style={styles.input}
          value={newPromoDiscount}
          onChangeText={setNewPromoDiscount}
          keyboardType="number-pad"
          placeholder="e.g. 20"
        />
        <Pressable style={styles.primaryButton} onPress={addPromoCode}>
          <Text style={styles.primaryButtonText}>Add Code</Text>
        </Pressable>

        {promoCodes.length > 0 && (
          <Pressable style={styles.secondaryButton} onPress={savePricing} disabled={pricingSaving}>
            <Text style={styles.secondaryButtonText}>
              {pricingSaving ? 'Saving...' : 'Save All Promo Codes'}
            </Text>
          </Pressable>
        )}
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
  priceInputRow: { flexDirection: 'row', gap: 8 },
  currencyInput: { width: 70 },
  pricingMessage: { fontSize: 13, color: '#065F46', fontWeight: '700', backgroundColor: '#D1FAE5', borderRadius: 8, padding: 8, marginBottom: 8 },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: '#F9FAFB' },
  promoCode: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1F2937' },
  promoDiscount: { fontSize: 13, color: '#6B7280' },
  promoRemove: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  promoRemoveText: { color: '#DC2626', fontWeight: '700', fontSize: 12 },
});
