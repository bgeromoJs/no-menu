
import { initializeApp, getApps, getApp, FirebaseApp } from "@firebase/app";
import { getFirestore, collection, setDoc, doc, getDoc, deleteDoc, onSnapshot, Firestore } from "@firebase/firestore";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithCredential, Auth } from "@firebase/auth";
import { Product, BusinessSettings, UserProfile } from "../types";
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from "../constants";

declare var google: any;

const firebaseConfig = {
  apiKey: JSON.parse(process.env.FIREBASE_CONFIG || '{}').apiKey,
  authDomain: JSON.parse(process.env.FIREBASE_CONFIG || '{}').authDomain,
  projectId: JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId,
  storageBucket: JSON.parse(process.env.FIREBASE_CONFIG || '{}').storageBucket,
  messagingSenderId: JSON.parse(process.env.FIREBASE_CONFIG || '{}').messagingSenderId,
  appId: JSON.parse(process.env.FIREBASE_CONFIG || '{}').appId
};

const initFirebase = (): { app: FirebaseApp | null, db: Firestore | null, auth: Auth | null } => {
  try {
    const apps = getApps();
    if (apps.length > 0) {
      const app = getApp();
      return { app, db: getFirestore(app), auth: getAuth(app) };
    }
    
    const isConfigured = firebaseConfig.apiKey && firebaseConfig.projectId;
    if (!isConfigured) return { app: null, db: null, auth: null };
    
    const app = initializeApp(firebaseConfig);
    return { app, db: getFirestore(app), auth: getAuth(app) };
  } catch (e) {
    console.error("Erro Firebase:", e);
    return { app: null, db: null, auth: null };
  }
};

const { db, auth } = initFirebase();

export { db, auth };

const PRODUCTS_COL = "products";
const SETTINGS_COL = "settings";
const USERS_COL = "users";

const isMockMode = !db || !auth;

const getLocalData = (key: string, fallback: any) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : fallback;
};

const setLocalData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new Event('storage'));
};

export const loginWithGoogle = async (): Promise<any | null> => {
  if (isMockMode) {
    const mockUser = { 
      uid: "admin-test", 
      displayName: "Vera Admin", 
      email: "admin@teste.com",
      photoURL: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    };
    localStorage.setItem("mock_user", JSON.stringify(mockUser));
    window.dispatchEvent(new Event('auth_change'));
    return mockUser;
  }
  
  if (!auth) throw new Error("Firebase Auth não inicializado");

  return new Promise((resolve, reject) => {
    try {
      google.accounts.id.initialize({
        client_id: process.env.GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          try {
            const credential = GoogleAuthProvider.credential(response.credential);
            const result = await signInWithCredential(auth, credential);
            resolve(result.user);
          } catch (error) {
            reject(error);
          }
        }
      });
      google.accounts.id.prompt();
    } catch (error) {
      reject(error);
    }
  });
};

export const logout = async () => {
  if (isMockMode) {
    localStorage.removeItem("mock_user");
    window.dispatchEvent(new Event('auth_change'));
    return;
  }
  if (auth) await signOut(auth);
};

export const subscribeAuth = (callback: (user: any | null) => void) => {
  if (isMockMode) {
    const check = () => callback(getLocalData("mock_user", null));
    window.addEventListener('auth_change', check);
    check();
    return () => window.removeEventListener('auth_change', check);
  }
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
};

export const checkAdminStatus = async (uid: string): Promise<boolean> => {
  if (!uid) return false;
  if (isMockMode) return uid === "admin-test";
  if (!db) return false;
  
  try {
    const snap = await getDoc(doc(db, USERS_COL, uid));
    return snap.exists() ? (snap.data() as UserProfile).isAdmin : false;
  } catch (e) {
    return false;
  }
};

// CRUD Subscriptions
export const subscribeProducts = (callback: (products: Product[]) => void) => {
  if (isMockMode || !db) {
    callback(getLocalData(PRODUCTS_COL, INITIAL_PRODUCTS));
    const h = () => callback(getLocalData(PRODUCTS_COL, INITIAL_PRODUCTS));
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }
  return onSnapshot(collection(db, PRODUCTS_COL), (snap) => callback(snap.docs.map(d => d.data() as Product)));
};

export const saveProductToDb = async (p: Product) => {
  if (isMockMode || !db) {
    const list = getLocalData(PRODUCTS_COL, INITIAL_PRODUCTS);
    const idx = list.findIndex((i: any) => i.id === p.id);
    idx > -1 ? list[idx] = p : list.push(p);
    setLocalData(PRODUCTS_COL, list);
    return;
  }
  await setDoc(doc(db, PRODUCTS_COL, p.id), p);
};

export const deleteProductFromDb = async (id: string) => {
  if (isMockMode || !db) {
    const list = getLocalData(PRODUCTS_COL, INITIAL_PRODUCTS).filter((i: any) => i.id !== id);
    setLocalData(PRODUCTS_COL, list);
    return;
  }
  await deleteDoc(doc(db, PRODUCTS_COL, id));
};

export const subscribeSettings = (callback: (s: BusinessSettings) => void) => {
  if (isMockMode || !db) {
    callback(getLocalData(SETTINGS_COL, DEFAULT_SETTINGS));
    const h = () => callback(getLocalData(SETTINGS_COL, DEFAULT_SETTINGS));
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }
  return onSnapshot(doc(db, SETTINGS_COL, "general"), (snap) => snap.exists() ? callback(snap.data() as BusinessSettings) : callback(DEFAULT_SETTINGS));
};

export const saveSettings = async (s: BusinessSettings) => {
  if (isMockMode || !db) {
    setLocalData(SETTINGS_COL, s);
    return;
  }
  await setDoc(doc(db, SETTINGS_COL, "general"), s);
};
