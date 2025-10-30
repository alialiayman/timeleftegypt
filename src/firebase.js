// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDReIBExRVcJYtrLxbOGTQoT80qavxACtk",
  authDomain: "timeleftegypt.firebaseapp.com",
  projectId: "timeleftegypt",
  storageBucket: "timeleftegypt.firebasestorage.app",
  messagingSenderId: "52980912855",
  appId: "1:52980912855:web:6992568d51b4d3cfb91692",
  measurementId: "G-GRVVEH19JL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { app, analytics, db, auth, storage, googleProvider };
export default app;