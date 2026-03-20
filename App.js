import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import EventsScreen from './src/components/EventsScreen';
import DashboardScreen from './src/components/Dashboard';
import UserProfileScreen from './src/components/UserProfile';
import AdminPanelScreen from './src/components/AdminPanel';
import SuperAdminPanelScreen from './src/components/SuperAdminPanel';
import { NativeAppProvider, useNativeApp } from './src/contexts/NativeAppContext';

const MainTabs = createBottomTabNavigator();

const firebaseConfig = {
  apiKey: 'AIzaSyDReIBExRVcJYtrLxbOGTQoT80qavxACtk',
  authDomain: 'timeleftegypt.firebaseapp.com',
  projectId: 'timeleftegypt',
  storageBucket: 'timeleftegypt.firebasestorage.app',
  messagingSenderId: '52980912855',
  appId: '1:52980912855:web:6992568d51b4d3cfb91692',
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const firestoreDb = getFirestore(firebaseApp);

const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  '52980912855-kdg74kapnfc53foj5lcg9g1iut1j8b3f.apps.googleusercontent.com';
const GOOGLE_IOS_REDIRECT_SCHEME =
  'com.googleusercontent.apps.52980912855-kdg74kapnfc53foj5lcg9g1iut1j8b3f';
const GOOGLE_EXPO_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

WebBrowser.maybeCompleteAuthSession();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FAFAF7',
    card: '#FFFFFF',
    text: '#1F2937',
    border: '#E5E7EB',
    primary: '#2EDC9A',
  },
};

function AuthShell({ children }) {
  return (
    <KeyboardAvoidingView
      style={styles.nativeContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.nativeScrollContent}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AuthScreen({ request, isSigningIn, onSignIn }) {
  return (
    <AuthShell>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>TimeLeft Gatherly</Text>
        <Text style={styles.title}>Meet Better. Live More.</Text>
        <Text style={styles.subtitle}>Join curated local events, discover your people, and turn plans into memories.</Text>
        <View style={styles.valueList}>
          <Text style={styles.cardItem}>Curated social events in your city</Text>
          <Text style={styles.cardItem}>Smart matching based on your profile</Text>
          <Text style={styles.cardItem}>Fast booking with real-time updates</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.hintText}>Use your Google account to securely continue.</Text>
      </View>
      <Pressable
        style={[styles.primaryButton, (!request || isSigningIn) && styles.buttonDisabled]}
        onPress={onSignIn}
        disabled={!request || isSigningIn}
      >
        <Text style={styles.primaryButtonText}>{isSigningIn ? 'Signing in...' : 'Login with Google'}</Text>
      </Pressable>
    </AuthShell>
  );
}

function ProfileSetupScreen({
  name,
  city,
  interests,
  setCity,
  setInterests,
  isSavingProfile,
  onSave,
  onSignOut,
}) {
  return (
    <AuthShell>
      <Text style={styles.title}>Profile Setup</Text>
      <Text style={styles.subtitle}>Complete your profile so we can personalize better events for you.</Text>
      <View style={styles.card}>
        <Text style={styles.cardItem}>Signed in as: {name}</Text>
        <Text style={styles.inputLabel}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Cairo" />
        <Text style={styles.inputLabel}>Interests</Text>
        <TextInput
          style={styles.input}
          value={interests}
          onChangeText={setInterests}
          placeholder="Coffee, Movies"
        />
      </View>
      <Pressable
        style={[styles.primaryButton, isSavingProfile && styles.buttonDisabled]}
        onPress={onSave}
        disabled={isSavingProfile}
      >
        <Text style={styles.primaryButtonText}>{isSavingProfile ? 'Saving profile...' : 'Continue'}</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onSignOut}>
        <Text style={styles.secondaryButtonText}>Sign Out</Text>
      </Pressable>
    </AuthShell>
  );
}

function TabIcon({ name, color, size }) {
  return <MaterialCommunityIcons name={name} color={color} size={size} />;
}

export default function App() {
  return (
    <NativeAppProvider auth={firebaseAuth} db={firestoreDb}>
      <AppContent />
    </NativeAppProvider>
  );
}

function AppContent() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Cairo');
  const [interests, setInterests] = useState('Coffee, Movies');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [loginRequested, setLoginRequested] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const handledAuthResponseRef = useRef(null);

  const {
    currentUser,
    userProfile,
    isAdminRole,
    isSuperAdminRole,
    refreshUserProfile,
    updateUserProfile,
    clearNativeSession,
  } = useNativeApp();

  const redirectUri = makeRedirectUri({
    native: `${GOOGLE_IOS_REDIRECT_SCHEME}:/oauthredirect`,
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: GOOGLE_EXPO_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    redirectUri: Platform.OS === 'ios' ? redirectUri : undefined,
    scopes: ['openid', 'profile', 'email'],
  });

  const hydrateFromProfile = (profileData) => {
    if (!profileData) return;
    if (profileData.city) setCity(profileData.city);
    const profileInterests = profileData.preferences?.interests;
    if (Array.isArray(profileInterests)) {
      setInterests(profileInterests.join(', '));
    } else if (typeof profileInterests === 'string') {
      setInterests(profileInterests);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    if (!name) setName(currentUser.displayName || '');
    if (!email) setEmail(currentUser.email || '');
  }, [currentUser, name, email]);

  useEffect(() => {
    hydrateFromProfile(userProfile);
  }, [userProfile]);

  useEffect(() => {
    const completeGoogleSignIn = async () => {
      if (isSigningOut) return;
      if (!loginRequested) return;
      if (response?.type !== 'success') {
        if (response?.type === 'error') {
          setIsSigningIn(false);
          setLoginRequested(false);
          Alert.alert('Google sign-in failed', 'Please try again.');
        }
        return;
      }

      if (handledAuthResponseRef.current === response) {
        return;
      }
      handledAuthResponseRef.current = response;

      try {
        const idToken = response.authentication?.idToken || response.params?.id_token || null;
        const accessToken = response.authentication?.accessToken || null;

        if (!idToken) {
          throw new Error('Google sign-in did not return an id token.');
        }

        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const userCred = await signInWithCredential(firebaseAuth, credential);
        const user = userCred.user;

        setName(user.displayName || '');
        setEmail(user.email || '');

        const existingProfile = await refreshUserProfile(user.uid);
        hydrateFromProfile(existingProfile);
      } catch (error) {
        console.error('Google native auth failed:', error);
        Alert.alert('Sign-in error', error?.message || 'Unable to sign in with Google.');
      } finally {
        setIsSigningIn(false);
        setLoginRequested(false);
      }
    };

    completeGoogleSignIn();
  }, [response, refreshUserProfile, isSigningOut, loginRequested]);

  const signInWithGoogle = async () => {
    const hasGoogleClientConfig = Boolean(
      Platform.OS === 'ios'
        ? GOOGLE_IOS_CLIENT_ID
        : GOOGLE_ANDROID_CLIENT_ID || GOOGLE_EXPO_CLIENT_ID || GOOGLE_WEB_CLIENT_ID
    );

    if (!hasGoogleClientConfig) {
      Alert.alert(
        'Google client ID missing',
        Platform.OS === 'ios'
          ? 'The iOS Google client ID is missing. Add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID or update the hard-coded fallback to match the iOS OAuth client in Google Cloud.'
          : 'Set the native Google client IDs in your environment before using Google login on this device.'
      );
      return;
    }

    setIsSigningIn(true);
    setLoginRequested(true);
    handledAuthResponseRef.current = null;
    await promptAsync({ useProxy: false });
  };

  const signOutNative = useCallback(async () => {
    try {
      setIsSigningOut(true);
      setLoginRequested(false);
      handledAuthResponseRef.current = null;
      await signOut(firebaseAuth);
      clearNativeSession();
      setName('');
      setEmail('');
    } catch (error) {
      console.error('Native sign-out failed:', error);
      Alert.alert('Sign-out error', 'Unable to sign out.');
    } finally {
      setIsSigningIn(false);
      setIsSigningOut(false);
    }
  }, [clearNativeSession]);

  const saveNativeProfile = async () => {
    const user = currentUser || firebaseAuth.currentUser;
    if (!user) {
      Alert.alert('Session missing', 'Please sign in with Google again.');
      return;
    }

    try {
      setIsSavingProfile(true);
      const parsedInterests = interests
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      await updateUserProfile({
        displayName: user.displayName || name,
        name: user.displayName || name,
        fullName: user.displayName || name,
        city,
        preferences: {
          interests: parsedInterests,
        },
      });
      await refreshUserProfile(user.uid);
    } catch (error) {
      console.error('Save native profile failed:', error);
      Alert.alert('Profile save failed', error?.message || 'Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const tabs = useMemo(() => {
    const tabScreens = [
      { name: 'Dashboard', icon: 'view-dashboard-outline', component: DashboardScreen, props: { onSignOut: signOutNative } },
      { name: 'Events', icon: 'calendar-star', component: EventsScreen, props: {} },
      { name: 'Profile', icon: 'account-circle-outline', component: UserProfileScreen, props: {} },
    ];

    if (isAdminRole) {
      tabScreens.push({ name: 'Organizer', icon: 'shield-account-outline', component: AdminPanelScreen, props: {} });
    }

    if (isSuperAdminRole) {
      tabScreens.push({ name: 'Master', icon: 'crown-outline', component: SuperAdminPanelScreen, props: {} });
    }

    return tabScreens;
  }, [isAdminRole, isSuperAdminRole, signOutNative]);

  const flow = !currentUser ? 'guest' : userProfile ? 'main' : 'setup';

  if (flow === 'guest') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <AuthScreen request={request} isSigningIn={isSigningIn} onSignIn={signInWithGoogle} />
      </SafeAreaView>
    );
  }

  if (flow === 'setup') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ProfileSetupScreen
          name={name}
          city={city}
          interests={interests}
          setCity={setCity}
          setInterests={setInterests}
          isSavingProfile={isSavingProfile}
          onSave={saveNativeProfile}
          onSignOut={signOutNative}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer theme={navTheme}>
        <MainTabs.Navigator
          screenOptions={({ route }) => {
            const current = tabs.find((t) => t.name === route.name);
            return {
              tabBarIcon: ({ color, size }) => (
                <TabIcon name={current?.icon || 'circle-outline'} color={color} size={size} />
              ),
              headerStyle: { backgroundColor: '#FFFFFF' },
              headerTintColor: '#1F2937',
              tabBarActiveTintColor: '#2EDC9A',
              tabBarInactiveTintColor: '#9CA3AF',
              tabBarStyle: {
                height: 64,
                paddingBottom: 10,
                paddingTop: 8,
                backgroundColor: '#FFFFFF',
                borderTopColor: '#E5E7EB',
                borderTopWidth: 1,
              },
              tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
            };
          }}
        >
          {tabs.map((tab) => (
            <MainTabs.Screen key={tab.name} name={tab.name}>
              {(navProps) => <tab.component {...navProps} {...tab.props} />}
            </MainTabs.Screen>
          ))}
        </MainTabs.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAF7',
  },
  nativeContainer: {
    flex: 1,
  },
  nativeScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F0FDF4',
    padding: 18,
    marginBottom: 14,
  },
  heroEyebrow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
    marginBottom: 10,
  },
  valueList: {
    marginTop: 4,
    gap: 6,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 14,
  },
  cardItem: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F2937',
    marginBottom: 6,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#1F2937',
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
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
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
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
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
