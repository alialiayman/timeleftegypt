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
  orderBy,
  getDocs
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
  const [locations, setLocations] = useState([]);
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
    console.log('🚪 Starting logout process...');
    
    // Try to remove user from table, but don't let this block logout
    if (currentUser) {
      try {
        console.log('👤 Attempting to remove user from table before logout...');
        await removeUserFromTable(currentUser.uid);
        console.log('✅ User removed from table successfully');
      } catch (tableError) {
        console.warn('⚠️ Error removing user from table (continuing with logout):', tableError);
        // Continue with logout even if table removal fails
      }
    }
    
    // Always attempt to sign out, regardless of table removal success
    try {
      console.log('🔓 Signing out from Firebase...');
      await signOut(auth);
      console.log('✅ Logout completed successfully');
    } catch (signOutError) {
      console.error('❌ Failed to sign out:', signOutError);
      throw signOutError;
    }
  };

  // Helper function to remove user from table
  const removeUserFromTable = async (userId) => {
    try {
      // Fetch tables directly from Firestore to avoid state dependency issues
      const tablesQuery = collection(db, 'tables');
      const tablesSnapshot = await getDocs(tablesQuery);
      
      console.log('Fetching tables for user removal, found:', tablesSnapshot.docs.length, 'tables');
      
      // Find the table that contains this user
      let userTable = null;
      for (const tableDoc of tablesSnapshot.docs) {
        const tableData = { id: tableDoc.id, ...tableDoc.data() };
        if (tableData.members && tableData.members.some(member => member.id === userId)) {
          userTable = tableData;
          break;
        }
      }

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
          // Update table with remaining members - use merge to avoid overwriting
          const tableRef = doc(db, 'tables', userTable.id);
          await setDoc(tableRef, {
            members: updatedMembers,
            lastUpdated: new Date().toISOString()
          }, { merge: true });
          console.log('Updated table with remaining members:', updatedMembers.length);
        }
      } else {
        console.log('User not found in any table');
      }
    } catch (error) {
      console.error('Error removing user from table:', error);
      // Don't throw error here as we still want logout to proceed
    }
  };

  // Update user profile in Firestore
  const updateUserProfile = async (profileData) => {
    console.log('🔄 updateUserProfile called with:', profileData);
    console.log('👤 currentUser:', !!currentUser, currentUser?.uid);
    console.log('👤 current userProfile state:', userProfile);
    
    if (!currentUser) {
      console.error('❌ No currentUser in updateUserProfile');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      
      // Get current profile for proper merging
      const currentProfile = userProfile || {};
      console.log('📋 Using currentProfile for merge:', currentProfile);
      
      const updatedProfile = {
        id: currentUser.uid,
        email: currentUser.email || currentProfile.email || '',
        displayName: profileData.displayName || currentProfile.displayName || currentUser.displayName || '',
        name: profileData.name || profileData.displayName || currentProfile.name || currentUser.displayName || '',
        fullName: profileData.fullName !== undefined ? profileData.fullName : currentProfile.fullName || '',
        city: profileData.city !== undefined ? profileData.city : currentProfile.city || '',
        phoneNumber: profileData.phoneNumber !== undefined ? profileData.phoneNumber : currentProfile.phoneNumber || '',
        localityId: profileData.localityId !== undefined ? profileData.localityId : currentProfile.localityId || '',
        localityLabel: profileData.localityLabel !== undefined ? profileData.localityLabel : currentProfile.localityLabel || '',
        // Organizer-assigned locality (set by Master; never overwritten by profile edits)
        organizerLocalityId: currentProfile.organizerLocalityId || '',
        organizerLocalityLabel: currentProfile.organizerLocalityLabel || '',
        photoURL: profileData.photoURL || currentProfile.photoURL || currentUser.photoURL || '',
        gender: profileData.gender !== undefined ? profileData.gender : currentProfile.gender || '',
        preferences: {
          ...currentProfile.preferences,
          ...profileData.preferences
        },
        location: profileData.location !== undefined ? profileData.location : currentProfile.location || null,
        currentLocationId: profileData.currentLocationId !== undefined ? profileData.currentLocationId : currentProfile.currentLocationId || null,
        checkedInAt: profileData.checkedInAt !== undefined ? profileData.checkedInAt : currentProfile.checkedInAt || null,
        isBlocked: profileData.isBlocked !== undefined ? profileData.isBlocked : currentProfile.isBlocked || false,
        role: profileData.role !== undefined ? profileData.role : currentProfile.role || '', // Preserve role field
        isAnonymous: profileData.isAnonymous !== undefined ? profileData.isAnonymous : currentProfile.isAnonymous || currentUser.isAnonymous,
        lastUpdated: new Date().toISOString(),
        createdAt: currentProfile.createdAt || new Date().toISOString()
      };

      console.log('💾 About to save profile to Firestore:', updatedProfile);
      
      await setDoc(userDocRef, updatedProfile, { merge: true });
      console.log('✅ Profile saved to Firestore successfully');
      
      setUserProfile(updatedProfile);
      console.log('✅ Local userProfile state updated');
      
      return updatedProfile;
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      console.error('❌ Error details:', error.message, error.code);
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

  // Location management functions (admin only)
  const addLocation = async (locationData) => {
    if (!isAdmin()) {
      throw new Error('Only admins can add locations');
    }

    try {
      const locationId = `location_${Date.now()}`;
      const locationRef = doc(db, 'locations', locationId);
      const newLocation = {
        id: locationId,
        name: locationData.name,
        googleMapsLink: locationData.googleMapsLink,
        description: locationData.description || '',
        expectedTime: locationData.expectedTime || '',
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid
      };

      await setDoc(locationRef, newLocation);
      console.log('✅ Location added successfully:', newLocation);
      return newLocation;
    } catch (error) {
      console.error('Error adding location:', error);
      throw error;
    }
  };

  const updateLocation = async (locationId, locationData) => {
    if (!isAdmin()) {
      throw new Error('Only admins can update locations');
    }

    try {
      const locationRef = doc(db, 'locations', locationId);
      const updateData = {
        ...locationData,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser.uid
      };

      await setDoc(locationRef, updateData, { merge: true });
      console.log('✅ Location updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  };

  const deleteLocation = async (locationId) => {
    if (!isAdmin()) {
      throw new Error('Only admins can delete locations');
    }

    try {
      const locationRef = doc(db, 'locations', locationId);
      await deleteDoc(locationRef);
      console.log('✅ Location deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  };

  // User check-in to location
  const checkInToLocation = async (locationId) => {
    console.log('🏢 checkInToLocation called with:', locationId);
    console.log('👤 currentUser:', !!currentUser, currentUser?.uid);
    console.log('👤 userProfile before check-in:', userProfile);
    
    if (!currentUser) {
      console.error('❌ No current user found');
      return false;
    }

    try {
      console.log('🔄 Starting location change process...');
      
      // If user is changing locations, remove them from current table first
      if (userProfile?.currentLocationId && userProfile.currentLocationId !== locationId) {
        console.log('🚚 User changing locations, removing from current table...');
        await removeUserFromTable(currentUser.uid);
      }
      
      const updatedProfile = await updateUserProfile({ 
        currentLocationId: locationId,
        checkedInAt: new Date().toISOString()
      });
      
      console.log('✅ Profile update completed successfully');
      console.log('👤 Updated user profile:', updatedProfile);
      console.log('📍 currentLocationId set to:', updatedProfile.currentLocationId);
      
      return true;
    } catch (error) {
      console.error('❌ Error checking in to location:', error);
      console.error('❌ Error details:', error.message, error.code);
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
          city: '',
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

  // Listen to current user's profile changes in real-time
  useEffect(() => {
    if (!currentUser) return;

    console.log('👤 Setting up real-time listener for user profile:', currentUser.uid);
    const userDocRef = doc(db, 'users', currentUser.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const profileData = doc.data();
        console.log('👤 User profile updated from Firestore:', profileData);
        setUserProfile(profileData);
      }
    }, (error) => {
      console.error('Error listening to user profile:', error);
    });

    return unsubscribe;
  }, [currentUser]);

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

  // Listen to locations
  useEffect(() => {
    console.log('Setting up locations listener...');
    const locationsQuery = collection(db, 'locations');
    
    const unsubscribe = onSnapshot(locationsQuery, (snapshot) => {
      console.log('📍 Locations snapshot received, docs count:', snapshot.docs.length);
      const locationsList = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        console.log('🏢 Location:', data.name, 'active:', data.isActive);
        return data;
      });
      console.log('📋 Setting locations state:', locationsList);
      setLocations(locationsList);
    }, (error) => {
      console.error('Error listening to locations:', error);
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
    locations,
    settings,
    signInWithGoogle,
    signInWithName,
    logout,
    updateUserProfile,
    updateSettings,
    addLocation,
    updateLocation,
    deleteLocation,
    checkInToLocation,
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