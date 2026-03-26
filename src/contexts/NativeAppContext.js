import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AuthContext } from './AuthContext';

const NativeAppContext = createContext(null);

export function NativeAppProvider({ auth, db, children }) {
  const [currentUser, setCurrentUser] = useState(auth?.currentUser || null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const refreshUserProfile = useCallback(
    async (uidArg) => {
      const uid = uidArg || auth?.currentUser?.uid || currentUser?.uid;
      if (!db || !uid) {
        setUserProfile(null);
        return null;
      }

      setProfileLoading(true);
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (!snap.exists()) {
          setUserProfile(null);
          return null;
        }
        const data = snap.data();
        setUserProfile(data);
        return data;
      } finally {
        setProfileLoading(false);
      }
    },
    [db, auth, currentUser?.uid]
  );

  const updateUserProfile = useCallback(
    async (profilePatch) => {
      if (!db || !currentUser?.uid) return null;

      const userRef = doc(db, 'users', currentUser.uid);
      const existingSnap = await getDoc(userRef);
      const existing = existingSnap.exists() ? existingSnap.data() : {};

      const merged = {
        id: currentUser.uid,
        email: currentUser.email || existing.email || '',
        displayName:
          profilePatch.displayName ||
          profilePatch.name ||
          existing.displayName ||
          currentUser.displayName ||
          '',
        name:
          profilePatch.name ||
          profilePatch.displayName ||
          existing.name ||
          currentUser.displayName ||
          '',
        fullName:
          profilePatch.fullName !== undefined
            ? profilePatch.fullName
            : existing.fullName || '',
        dateOfBirth:
          profilePatch.dateOfBirth !== undefined
            ? profilePatch.dateOfBirth
            : existing.dateOfBirth || '',
        phoneNumber:
          profilePatch.phoneNumber !== undefined
            ? profilePatch.phoneNumber
            : existing.phoneNumber || '',
        city: profilePatch.city !== undefined ? profilePatch.city : existing.city || '',
        gender: profilePatch.gender !== undefined ? profilePatch.gender : existing.gender || '',
        localityId:
          profilePatch.localityId !== undefined
            ? profilePatch.localityId
            : existing.localityId || '',
        localityLabel:
          profilePatch.localityLabel !== undefined
            ? profilePatch.localityLabel
            : existing.localityLabel || '',
        organizerLocalityId: existing.organizerLocalityId || '',
        organizerLocalityLabel: existing.organizerLocalityLabel || '',
        photoURL: currentUser.photoURL || existing.photoURL || '',
        preferences: {
          ...(existing.preferences || {}),
          ...(profilePatch.preferences || {}),
        },
        role:
          profilePatch.role !== undefined
            ? profilePatch.role
            : existing.role || userProfile?.role || '',
        isBlocked:
          profilePatch.isBlocked !== undefined
            ? profilePatch.isBlocked
            : existing.isBlocked || false,
        isAnonymous: false,
        // Extended profile fields — fall back to existing if not provided
        status: existing.status || 'active',
        eventsAttendedCount: existing.eventsAttendedCount || 0,
        friendsMetCount: existing.friendsMetCount || 0,
        relationshipStatus:
          profilePatch.relationshipStatus !== undefined
            ? profilePatch.relationshipStatus
            : existing.relationshipStatus || '',
        children:
          profilePatch.children !== undefined
            ? profilePatch.children
            : existing.children || '',
        workIndustry:
          profilePatch.workIndustry !== undefined
            ? profilePatch.workIndustry
            : existing.workIndustry || '',
        customPhotoUrl: existing.customPhotoUrl || '',
        lastUpdated: new Date().toISOString(),
        createdAt: existing.createdAt || new Date().toISOString(),
      };

      await setDoc(userRef, merged, { merge: true });
      setUserProfile((prev) => ({ ...(prev || {}), ...merged }));
      return merged;
    },
    [db, currentUser, userProfile?.role]
  );

  const clearNativeSession = useCallback(() => {
    setCurrentUser(null);
    setUserProfile(null);
  }, []);

  useEffect(() => {
    if (!auth) return undefined;

    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user || null);
      if (user?.uid) {
        await refreshUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
    });

    return unsub;
  }, [auth, refreshUserProfile]);

  const role = userProfile?.role || '';
  if (role) console.log('[NativeApp] user role:', role);
  // Accept all known variants: 'super-admin', 'super_admin', 'superAdmin', 'master'
  const isSuperAdminRole =
    role === 'super-admin' ||
    role === 'super_admin' ||
    role === 'superAdmin' ||
    role === 'master';
  // Super-admins also have organizer access (matches web isAdmin() behavior)
  const isAdminRole = role === 'admin' || role === 'event_admin' || isSuperAdminRole;

  const value = useMemo(
    () => ({
      auth,
      db,
      currentUser,
      userProfile,
      profileLoading,
      isAdminRole,
      isSuperAdminRole,
      refreshUserProfile,
      updateUserProfile,
      clearNativeSession,
    }),
    [
      auth,
      db,
      currentUser,
      userProfile,
      profileLoading,
      isAdminRole,
      isSuperAdminRole,
      refreshUserProfile,
      updateUserProfile,
      clearNativeSession,
    ]
  );

  return <NativeAppContext.Provider value={value}>{children}</NativeAppContext.Provider>;
}

export function useNativeApp() {
  const nativeContext = useContext(NativeAppContext);
  const authContext = useContext(AuthContext);

  if (nativeContext) {
    return nativeContext;
  }

  if (authContext) {
    return {
      auth: undefined,
      db: authContext.db,
      currentUser: authContext.currentUser,
      userProfile: authContext.userProfile,
      profileLoading: authContext.loading,
      isAdminRole: authContext.isAdmin(),
      isSuperAdminRole: authContext.isSuperAdmin(),
      refreshUserProfile: async () => authContext.userProfile,
      updateUserProfile: authContext.updateUserProfile,
      clearNativeSession: async () => authContext.logout(),
    };
  }

  throw new Error('useNativeApp must be used within NativeAppProvider or AuthProvider');
}
