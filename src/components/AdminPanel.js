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
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useNativeApp } from '../contexts/NativeAppContext';

function UserRow({ user, busyId, onToggleBlock, onToggleAdmin }) {
  const isBusy = busyId === user.id;
  const role = user.role === 'super-admin' ? 'Master' : user.role === 'admin' || user.role === 'event_admin' ? 'Organizer' : 'Friend';

  return (
    <View style={styles.rowCard}>
      <Text style={styles.rowName}>{user.displayName || user.name || user.email || user.id}</Text>
      {user.email ? <Text style={styles.rowMeta}>{user.email}</Text> : null}
      {user.localityLabel ? <Text style={styles.rowMeta}>Area: {user.localityLabel}</Text> : null}
      <Text style={styles.rowMeta}>Role: {role} | Status: {user.isBlocked ? 'Blocked' : 'Active'}</Text>

      <View style={styles.rowActions}>
        <Pressable style={styles.secondaryButton} disabled={isBusy} onPress={() => onToggleAdmin(user)}>
          <Text style={styles.secondaryButtonText}>
            {isBusy ? '...' : user.role === 'admin' || user.role === 'event_admin' ? 'Remove Organizer' : 'Make Organizer'}
          </Text>
        </Pressable>
        <Pressable style={styles.dangerButton} disabled={isBusy} onPress={() => onToggleBlock(user)}>
          <Text style={styles.dangerButtonText}>{isBusy ? '...' : user.isBlocked ? 'Unblock' : 'Block'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminPanelScreen() {
  const { db, currentUser, userProfile } = useNativeApp();
  const [members, setMembers] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [activeTab, setActiveTab] = useState('members');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);

  const localityId = userProfile?.organizerLocalityId || userProfile?.localityId || '';

  useEffect(() => {
    if (!db) return undefined;
    const q = query(collection(db, 'users'), orderBy('displayName'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (localityId) list = list.filter((u) => u.localityId === localityId || u.organizerLocalityId === localityId);
        list = list.filter((u) => u.id !== currentUser?.uid && u.role !== 'super-admin');
        setMembers(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [db, localityId, currentUser?.uid]);

  useEffect(() => {
    if (!db) return undefined;
    const q = query(collection(db, 'appeals'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAppeals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [db]);

  const pendingMembers = useMemo(() => members.filter((u) => !u.role && !u.isBlocked), [members]);
  const blockedMembers = useMemo(() => members.filter((u) => u.isBlocked), [members]);

  const toggleBlock = async (user) => {
    setBusyId(user.id);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        isBlocked: !user.isBlocked,
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      setBusyId('');
    }
  };

  const toggleAdmin = async (user) => {
    setBusyId(user.id);
    try {
      const nextRole = user.role === 'admin' || user.role === 'event_admin' ? '' : 'admin';
      await updateDoc(doc(db, 'users', user.id), {
        role: nextRole,
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      setBusyId('');
    }
  };

  const resolveAppeal = async (appeal, action) => {
    setBusyId(appeal.id);
    try {
      await updateDoc(doc(db, 'appeals', appeal.id), {
        status: action,
        reviewedAt: new Date().toISOString(),
      });
      if (action === 'approved') {
        await updateDoc(doc(db, 'users', appeal.userId), {
          isBlocked: false,
          lastUpdated: new Date().toISOString(),
        });
      }
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Organizer Panel</Text>
      <Text style={styles.sub}>Locality scope: {userProfile?.organizerLocalityLabel || userProfile?.localityLabel || '-'}</Text>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, activeTab === 'members' && styles.tabActive]} onPress={() => setActiveTab('members')}>
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>Members ({members.length})</Text>
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'pending' && styles.tabActive]} onPress={() => setActiveTab('pending')}>
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pending ({pendingMembers.length})</Text>
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'blocked' && styles.tabActive]} onPress={() => setActiveTab('blocked')}>
          <Text style={[styles.tabText, activeTab === 'blocked' && styles.tabTextActive]}>Blocked ({blockedMembers.length})</Text>
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'appeals' && styles.tabActive]} onPress={() => setActiveTab('appeals')}>
          <Text style={[styles.tabText, activeTab === 'appeals' && styles.tabTextActive]}>Appeals ({appeals.length})</Text>
        </Pressable>
      </View>

      {activeTab === 'appeals' ? (
        <FlatList
          data={appeals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.rowCard}>
              <Text style={styles.rowName}>User ID: {item.userId}</Text>
              <Text style={styles.rowMeta}>{item.message || 'No message'}</Text>
              <View style={styles.rowActions}>
                <Pressable style={styles.primaryButton} disabled={busyId === item.id} onPress={() => resolveAppeal(item, 'approved')}>
                  <Text style={styles.primaryButtonText}>{busyId === item.id ? '...' : 'Approve'}</Text>
                </Pressable>
                <Pressable style={styles.dangerButton} disabled={busyId === item.id} onPress={() => resolveAppeal(item, 'rejected')}>
                  <Text style={styles.dangerButtonText}>{busyId === item.id ? '...' : 'Reject'}</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No pending appeals.</Text>}
        />
      ) : (
        <FlatList
          data={activeTab === 'pending' ? pendingMembers : activeTab === 'blocked' ? blockedMembers : members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <UserRow user={item} busyId={busyId} onToggleBlock={toggleBlock} onToggleAdmin={toggleAdmin} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No members to show.</Text>}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingBottom: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#9a3412', marginBottom: 4 },
  sub: { fontSize: 13, color: '#5b6e8a', marginBottom: 10 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tab: { borderWidth: 1, borderColor: '#fdba74', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff' },
  tabActive: { borderColor: '#f97316', backgroundColor: '#ffedd5' },
  tabText: { color: '#7c2d12', fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: '#f97316' },
  list: { paddingBottom: 8, gap: 10 },
  rowCard: { borderWidth: 1, borderColor: '#fdba74', borderRadius: 12, backgroundColor: '#fff', padding: 12 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#9a3412', marginBottom: 4 },
  rowMeta: { fontSize: 13, color: '#3f5471', marginBottom: 3 },
  rowActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryButton: { flex: 1, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  primaryButtonText: { color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 13 },
  secondaryButton: { flex: 1, backgroundColor: '#fff1e6', borderWidth: 1, borderColor: '#fdba74', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  secondaryButtonText: { color: '#9a3412', textAlign: 'center', fontWeight: '600', fontSize: 13 },
  dangerButton: { flex: 1, backgroundColor: '#fbe9e8', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  dangerButtonText: { color: '#8f1f1a', textAlign: 'center', fontWeight: '700', fontSize: 13 },
  empty: { color: '#9a3412', fontSize: 14, marginTop: 8 },
});
