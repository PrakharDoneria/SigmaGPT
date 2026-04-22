import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ✅ Sign in with Google
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

// ✅ Sign in with Email/Password
export const signInWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

// ✅ Register with Email/Password
export const registerWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

// ✅ Sign out
export const logOut = () => signOut(auth);

// ✅ Get current user's ID token (for backend requests)
export const getIdToken = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

// ✅ Listen to auth state
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

export default app;