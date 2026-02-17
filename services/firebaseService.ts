
import { initializeApp, getApps, getApp, FirebaseApp } from "@firebase/app";
import { getFirestore, collection, setDoc, doc, getDoc, deleteDoc, onSnapshot, Firestore } from "@firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithCredential, onAuthStateChanged, signOut, Auth } from "@firebase/auth";
import { Product, BusinessSettings, UserProfile } from "../types";
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from "../constants";

declare var google: any;

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const initFirebase = (): { app: FirebaseApp | null, db: Firestore | null, auth: Auth | null } => {
  try {
    const apps = getApps();
    if (apps.length > 0) {
      const app = getApp();
      return { app, db: getFirestore(app), auth: getAuth(app) };
    }
    
    if (!firebaseConfig.apiKey) {
      console.warn("Firebase não configurado com chaves individuais. Entrando em modo Mock.");
      return { app: null, db: null, auth: null };
    }
    
    const app = initializeApp(firebaseConfig);
    return { app, db: getFirestore(app), auth: getAuth(app) };
  } catch (e) {
    console.error("Erro Crítico Firebase:", e);
    return { app: null, db: null, auth: null };
  }
};

const { db, auth } = initFirebase();
export { db, auth };

const PRODUCTS_COL = "products";
const SETTINGS_COL = "settings";
const USERS_COL = "users";

const isMockMode = !db || !auth;

const syncUserToDb = async (user: any) => {
  if (isMockMode || !db) return;
  try {
    const userRef = doc(db, USERS_COL, user.email);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName || "Usuário",
        email: user.email,
        isAdmin: false,
        createdAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.error("Erro ao sincronizar usuário:", e);
  }
};

export const loginWithGoogle = async (): Promise<any | null> => {
  if (isMockMode) {
    const mockUser = { 
      uid: "admin-test", 
      displayName: "Vera Admin (Mock)", 
      email: "admin@teste.com",
      photoURL: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    };
    localStorage.setItem("mock_user", JSON.stringify(mockUser));
    window.dispatchEvent(new Event('auth_change'));
    return mockUser;
  }

  return new Promise((resolve, reject) => {
    try {
      google.accounts.id.initialize({
        client_id: process.env.GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          try {
            const credential = GoogleAuthProvider.credential(response.credential);
            const result = await signInWithCredential(auth!, credential);
            await syncUserToDb(result.user);
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
    const check = () => callback(JSON.parse(localStorage.getItem("mock_user") || 'null'));
    window.addEventListener('auth_change', check);
    check();
    return () => window.removeEventListener('auth_change', check);
  }
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL
      });
    } else {
      callback(null);
    }
  });
};

export const checkAdminStatus = async (email: string): Promise<boolean> => {
  if (!email) return false;
  if (isMockMode) return email === "admin@teste.com";
  if (!db) return false;
  try {
    const snap = await getDoc(doc(db, USERS_COL, email));
    return snap.exists() ? snap.data().isAdmin === true : false;
  } catch (e) {
    return false;
  }
};

export const subscribeProducts = (callback: (products: Product[]) => void) => {
  if (isMockMode || !db) {
    const data = JSON.parse(localStorage.getItem(PRODUCTS_COL) || JSON.stringify(INITIAL_PRODUCTS));
    callback(data);
    const h = () => callback(JSON.parse(localStorage.getItem(PRODUCTS_COL) || JSON.stringify(INITIAL_PRODUCTS)));
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }
  return onSnapshot(collection(db, PRODUCTS_COL), (snap) => callback(snap.docs.map(d => d.data() as Product)));
};

export const saveProductToDb = async (p: Product) => {
  if (isMockMode || !db) {
    const list = JSON.parse(localStorage.getItem(PRODUCTS_COL) || JSON.stringify(INITIAL_PRODUCTS));
    const idx = list.findIndex((i: any) => i.id === p.id);
    idx > -1 ? list[idx] = p : list.push(p);
    localStorage.setItem(PRODUCTS_COL, JSON.stringify(list));
    window.dispatchEvent(new Event('storage'));
    return;
  }
  await setDoc(doc(db, PRODUCTS_COL, p.id), p);
};

export const deleteProductFromDb = async (id: string) => {
  if (isMockMode || !db) {
    const list = JSON.parse(localStorage.getItem(PRODUCTS_COL) || '[]').filter((i: any) => i.id !== id);
    localStorage.setItem(PRODUCTS_COL, JSON.stringify(list));
    window.dispatchEvent(new Event('storage'));
    return;
  }
  await deleteDoc(doc(db, PRODUCTS_COL, id));
};

export const subscribeSettings = (callback: (s: BusinessSettings) => void) => {
  if (isMockMode || !db) {
    const data = JSON.parse(localStorage.getItem(SETTINGS_COL) || JSON.stringify(DEFAULT_SETTINGS));
    callback(data);
    const h = () => callback(JSON.parse(localStorage.getItem(SETTINGS_COL) || JSON.stringify(DEFAULT_SETTINGS)));
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }
  return onSnapshot(doc(db, SETTINGS_COL, "general"), (snap) => snap.exists() ? callback(snap.data() as BusinessSettings) : callback(DEFAULT_SETTINGS));
};

export const saveSettings = async (s: BusinessSettings) => {
  if (isMockMode || !db) {
    localStorage.setItem(SETTINGS_COL, JSON.stringify(s));
    window.dispatchEvent(new Event('storage'));
    return;
  }
  await setDoc(doc(db, SETTINGS_COL, "general"), s);
};
