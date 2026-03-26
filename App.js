import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
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
import FriendsScreen from './src/components/FriendsScreen';
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

// Animated blob for the auth screen background
function AnimatedBlob({ color, size, top, left, right, bottom, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 4500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 4500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, [anim, delay]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });

  return (
    <Animated.View
      style={[
        authStyles.blob,
        { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
        top !== undefined && { top },
        left !== undefined && { left },
        right !== undefined && { right },
        bottom !== undefined && { bottom },
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'AR' },
];

function AuthScreen({ request, isSigningIn, onSignIn }) {
  const [langIndex, setLangIndex] = useState(0);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [fadeIn]);

  const toggleLanguage = () => setLangIndex((i) => (i + 1) % LANGUAGES.length);
  const currentLang = LANGUAGES[langIndex];

  const openPrivacy = () => Linking.openURL('https://timeleftegypt.firebaseapp.com/privacy-policy');
  const openTerms = () => Linking.openURL('https://timeleftegypt.firebaseapp.com/terms-of-service');

  return (
    <View style={authStyles.container}>
      {/* Animated background blobs */}
      <AnimatedBlob color="#F97316" size={280} top={-60} left={-80} delay={0} />
      <AnimatedBlob color="#FBBF24" size={220} top={100} right={-70} delay={800} />
      <AnimatedBlob color="#EC4899" size={180} top={250} left={30} delay={1600} />
      <AnimatedBlob color="#8B5CF6" size={150} bottom={220} right={-40} delay={400} />
      <AnimatedBlob color="#2EDC9A" size={200} bottom={80} left={-60} delay={1200} />

      {/* Dark overlay */}
      <View style={authStyles.overlay} />

      {/* Language switcher */}
      <Pressable style={authStyles.langButton} onPress={toggleLanguage}>
        <MaterialCommunityIcons name="web" size={20} color="#FFFFFF" />
        <Text style={authStyles.langText}>{currentLang.label}</Text>
      </Pressable>

      {/* Content */}
      <Animated.View style={[authStyles.content, { opacity: fadeIn }]}>
        {/* People meeting emojis */}
        <View style={authStyles.emojiRow}>
          <Text style={authStyles.heroEmoji}>🤝</Text>
          <Text style={authStyles.heroEmoji}>☕</Text>
          <Text style={authStyles.heroEmoji}>🥂</Text>
          <Text style={authStyles.heroEmoji}>🎉</Text>
        </View>

        <Text style={authStyles.headline}>Make new friends{'\n'}face-to-face</Text>
        <Text style={authStyles.subheadline}>
          Discover curated local events, meet amazing people, and turn plans into real memories.
        </Text>

        <Pressable
          style={[authStyles.googleButton, (!request || isSigningIn) && authStyles.buttonDisabled]}
          onPress={onSignIn}
          disabled={!request || isSigningIn}
        >
          <MaterialCommunityIcons name="google" size={20} color="#1F2937" style={authStyles.googleIcon} />
          <Text style={authStyles.googleButtonText}>
            {isSigningIn ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </Pressable>

        <View style={authStyles.legalRow}>
          <Pressable onPress={openPrivacy}>
            <Text style={authStyles.legalLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={authStyles.legalSep}> · </Text>
          <Pressable onPress={openTerms}>
            <Text style={authStyles.legalLink}>Terms of Service</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

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

function MoreMenuScreen({ navigation, items }) {
  return (
    <View style={styles.moreScreen}>
      <Text style={styles.moreTitle}>More</Text>
      <Text style={styles.moreSubtitle}>Extra sections</Text>
      <View style={styles.moreCard}>
        {items.map((item) => (
          <Pressable key={item.name} style={styles.moreButton} onPress={() => navigation.navigate(item.name)}>
            <View style={styles.moreButtonIconWrap}>
              <TabIcon name={item.icon} color="#0B5D40" size={18} />
            </View>
            <Text style={styles.moreButtonText}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
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
    const baseTabs = [
      { name: 'Dashboard', icon: 'view-dashboard-outline', component: DashboardScreen, props: {} },
      { name: 'Events', icon: 'calendar-star', component: EventsScreen, props: {} },
      { name: 'Friends', icon: 'account-group-outline', component: FriendsScreen, props: {} },
      { name: 'Profile', icon: 'account-circle-outline', component: UserProfileScreen, props: { onSignOut: signOutNative } },
    ];

    const overflowTabs = [];

    if (isAdminRole) {
      overflowTabs.push({ name: 'Organizer', icon: 'shield-account-outline', component: AdminPanelScreen, props: {} });
    }

    if (isSuperAdminRole) {
      overflowTabs.push({ name: 'Master', icon: 'crown-outline', component: SuperAdminPanelScreen, props: {} });
    }

    if (overflowTabs.length > 0) {
      baseTabs.push({
        name: 'More',
        icon: 'dots-horizontal-circle-outline',
        component: MoreMenuScreen,
        props: { items: overflowTabs },
      });
    }

    const hiddenOverflowTabs = overflowTabs.map((tab) => ({ ...tab, hidden: true }));
    return [...baseTabs, ...hiddenOverflowTabs];
  }, [isAdminRole, isSuperAdminRole, signOutNative]);

  const flow = !currentUser ? 'guest' : userProfile ? 'main' : 'setup';

  if (flow === 'guest') {
    return (
      <SafeAreaView style={authStyles.safeArea}>
        <StatusBar barStyle="light-content" />
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
              tabBarButton: current?.hidden ? () => null : undefined,
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
                justifyContent: 'space-between',
              },
              tabBarItemStyle: current?.hidden
                ? { display: 'none' }
                : { flex: 1, maxWidth: 'none' },
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
    color: '#0B5D40',
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
  moreScreen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FAFAF7',
  },
  moreTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  moreSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  moreCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  moreButtonIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonText: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
  },
});

// Auth screen styles (dark/lively onboarding design)
const authStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1C0A05',
  },
  container: {
    flex: 1,
    backgroundColor: '#1C0A05',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 4, 0, 0.55)',
  },
  langButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  langText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  heroEmoji: {
    fontSize: 36,
  },
  headline: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 50,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 24,
    marginBottom: 32,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  googleIcon: {
    marginRight: 2,
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  legalSep: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
});
