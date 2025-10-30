import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  collection, 
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [tables, setTables] = useState([]);
  const [settings, setSettings] = useState({
    maxPeoplePerTable: 5,
    considerLocation: false
    // Note: Admin access is now controlled by user.role field ('admin' or 'super-admin')
  });

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  // Sign in with just a name (anonymous auth + custom profile)
  const signInWithName = async (name) => {
    try {
      const result = await signInAnonymously(auth);
      const user = result.user;
      
      // Create user profile with the provided name
      await updateUserProfile({
        displayName: name,
        name: name,
        fullName: name,
        isAnonymous: true
      });
      
      return user;
    } catch (error) {
      console.error('Error signing in with name:', error);
      throw error;
    }
  };

  // Sign out and remove from table
  const logout = async () => {
    try {
      if (currentUser) {
        // Find and remove user from their current table
        await removeUserFromTable(currentUser.uid);
      }
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Helper function to remove user from table
  const removeUserFromTable = async (userId) => {
    try {
      // Find the table that contains this user
      const userTable = tables.find(table => 
        table.members && table.members.some(member => member.id === userId)
      );

      if (userTable) {
        console.log('Removing user from table:', userTable.name);
        
        // Create updated table without this user
        const updatedMembers = userTable.members.filter(member => member.id !== userId);
        
        if (updatedMembers.length === 0) {
          // If table is empty, delete it
          const tableRef = doc(db, 'tables', userTable.id);
          await deleteDoc(tableRef);
          console.log('Deleted empty table:', userTable.name);
        } else {
          // Update table with remaining members
          const tableRef = doc(db, 'tables', userTable.id);
          await setDoc(tableRef, {
            ...userTable,
            members: updatedMembers
          });
          console.log('Updated table with remaining members:', updatedMembers.length);
        }
      }
    } catch (error) {
      console.error('Error removing user from table:', error);
      // Don't throw error here as we still want logout to proceed
    }
  };

  // Update user profile in Firestore
  const updateUserProfile = async (profileData) => {
    if (!currentUser) return;

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      
      // Get current profile for proper merging
      const currentProfile = userProfile || {};
      
      const updatedProfile = {
        id: currentUser.uid,
        email: currentUser.email || currentProfile.email || '',
        displayName: profileData.displayName || currentProfile.displayName || currentUser.displayName || '',
        name: profileData.name || profileData.displayName || currentProfile.name || currentUser.displayName || '',
        fullName: profileData.fullName || currentProfile.fullName || '',
        photoURL: profileData.photoURL || currentProfile.photoURL || currentUser.photoURL || '',
        gender: profileData.gender !== undefined ? profileData.gender : currentProfile.gender || '',
        preferences: {
          ...currentProfile.preferences,
          ...profileData.preferences
        },
        location: profileData.location !== undefined ? profileData.location : currentProfile.location || null,
        role: profileData.role !== undefined ? profileData.role : currentProfile.role || '', // Preserve role field
        isAnonymous: profileData.isAnonymous !== undefined ? profileData.isAnonymous : currentProfile.isAnonymous || currentUser.isAnonymous,
        lastUpdated: new Date().toISOString(),
        createdAt: currentProfile.createdAt || new Date().toISOString()
      };

      console.log('Updating profile with data:', updatedProfile);
      
      await setDoc(userDocRef, updatedProfile, { merge: true });
      setUserProfile(updatedProfile);
      return updatedProfile;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.warn('Error getting location:', error);
          resolve(null); // Don't reject, just return null
        }
      );
    });
  };

  // Update settings (admin only)
  const updateSettings = async (newSettings) => {
    try {
      const settingsDocRef = doc(db, 'settings', 'main');
      await setDoc(settingsDocRef, newSettings, { merge: true });
      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  // Check if current user is admin
  const isAdmin = () => {
    console.log('🔍 Admin check:', {
      currentUser: !!currentUser,
      userProfile: !!userProfile,
      userRole: userProfile?.role,
      email: currentUser?.email,
      userProfileData: userProfile
    });
    
    if (!currentUser || !userProfile) return false;
    const isAdminUser = userProfile.role === 'admin' || userProfile.role === 'super-admin';
    console.log('🔑 Is admin:', isAdminUser);
    return isAdminUser;
  };

  // Check if current user is super admin
  const isSuperAdmin = () => {
    if (!currentUser || !userProfile) return false;
    return userProfile.role === 'super-admin';
  };

  // Temporary function to set admin role (for debugging)
  const setAdminRole = async (role = 'admin') => {
    if (!currentUser) return false;
    try {
      await updateUserProfile({ role });
      console.log('✅ Admin role set to:', role);
      return true;
    } catch (error) {
      console.error('❌ Failed to set admin role:', error);
      return false;
    }
  };

  // Load user profile from Firestore
  const loadUserProfile = async (user) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const profile = userDoc.data();
        console.log('📋 Loaded user profile:', profile);
        setUserProfile(profile);
        return profile;
      } else {
        // Create initial profile
        const initialProfile = {
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          name: user.displayName || '',
          fullName: '',
          photoURL: user.photoURL || '',
          gender: '',
          preferences: {},
          location: null,
          role: '', // Default role is empty (regular user)
          isAnonymous: user.isAnonymous,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        
        await setDoc(userDocRef, initialProfile);
        setUserProfile(initialProfile);
        return initialProfile;
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  };

  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        await loadUserProfile(user);
        
        // Try to get location
        try {
          const location = await getCurrentLocation();
          if (location) {
            // Update profile with location directly in Firestore
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { location }, { merge: true });
          }
        } catch (error) {
          console.warn('Could not get location:', error);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Listen to all users
  useEffect(() => {
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('lastUpdated', 'desc')
    );
    
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      console.log('👥 Users snapshot received, docs count:', snapshot.docs.length);
      const usersList = snapshot.docs.map(doc => {
        const userData = { id: doc.id, ...doc.data() };
        console.log('👤 User data:', userData.displayName || userData.name, 'role:', userData.role);
        return userData;
      });
      console.log('📋 Setting users state with updated data');
      setUsers(usersList);
    });

    return unsubscribe;
  }, []);

  // Listen to tables
  useEffect(() => {
    console.log('Setting up tables listener...');
    const tablesQuery = collection(db, 'tables');
    
    const unsubscribe = onSnapshot(tablesQuery, (snapshot) => {
      console.log('Tables snapshot received, docs count:', snapshot.docs.length);
      const tablesList = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        console.log('Table doc:', data);
        return data;
      });
      console.log('Setting tables state:', tablesList);
      setTables(tablesList);
    }, (error) => {
      console.error('Error listening to tables:', error);
    });

    return unsubscribe;
  }, []);

  // Listen to settings
  useEffect(() => {
    const settingsDocRef = doc(db, 'settings', 'main');
    
    const unsubscribe = onSnapshot(settingsDocRef, async (doc) => {
      if (doc.exists()) {
        setSettings(prev => ({ ...prev, ...doc.data() }));
      } else {
        // Create default settings if they don't exist
        const defaultSettings = {
          maxPeoplePerTable: 5,
          considerLocation: false
        };
        try {
          await setDoc(settingsDocRef, defaultSettings);
          setSettings(prev => ({ ...prev, ...defaultSettings }));
        } catch (error) {
          console.error('Error creating default settings:', error);
        }
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    users,
    tables,
    settings,
    signInWithGoogle,
    signInWithName,
    logout,
    updateUserProfile,
    updateSettings,
    getCurrentLocation,
    removeUserFromTable,
    isAdmin,
    isSuperAdmin,
    setAdminRole,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}