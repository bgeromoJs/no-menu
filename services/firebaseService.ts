// Fixed: Removed leading blank lines and ensured clean modular imports from Firebase v9+.
import { initializeApp } from "firebase/app";
import { getFirestore, collection, setDoc, doc, getDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import { Product, BusinessSettings, UserProfile } from "../types.ts";
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from "../constants.ts";

let firebaseConfig = {};
try {
  const configStr = process.env.FIREBASE_CONFIG || '{}';
  firebaseConfig = JSON.parse(configStr);
} catch (e) {
  console.warn("FIREBASE_CONFIG não é um JSON válido. Entrando em modo mock.");
}

let db: any = null;
let auth: any = null;
const isMockMode = !firebaseConfig || !('apiKey' in firebaseConfig) || !(firebaseConfig as any).apiKey;

if (!isMockMode) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (e) {
    console.error("Erro ao inicializar Firebase real:", e);
  }
}

const PRODUCTS_COL = "products";
const SETTINGS_COL = "settings";
const USERS_COL = "users";

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
    const mockUser = { uid: "admin-test", displayName: "Vera Admin", email: "admin@teste.com" } as any;
    localStorage.setItem("mock_user", JSON.stringify(mockUser));
    window.dispatchEvent(new Event('auth_change'));
    return mockUser;
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const logout = async () => {
  if (isMockMode) {
    localStorage.removeItem("mock_user");
    window.dispatchEvent(new Event('auth_change'));
    return;
  }
  await signOut(auth);
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

export const subscribeProducts = (callback: (products: Product[]) => void) => {
  if (isMockMode || !db) {
    callback(getLocalData(PRODUCTS_COL, INITIAL_PRODUCTS));
    const handler = () => callback(getLocalData(PRODUCTS_COL, INITIAL_PRODUCTS));
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
  return onSnapshot(collection(db, PRODUCTS_COL), (snap) => {
    callback(snap.docs.map(d => d.data() as Product));
  });
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
    const handler = () => callback(getLocalData(SETTINGS_COL, DEFAULT_SETTINGS));
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
  return onSnapshot(doc(db, SETTINGS_COL, "general"), (snap) => {
    if (snap.exists()) callback(snap.data() as BusinessSettings);
    else callback(DEFAULT_SETTINGS);
  });
};

export const saveSettings = async (s: BusinessSettings) => {
  if (isMockMode || !db) {
    setLocalData(SETTINGS_COL, s);
    return;
  }
  await setDoc(doc(db, SETTINGS_COL, "general"), s);
};

export const checkAdminStatus = async (uid: string): Promise<boolean> => {
  if (!uid) return false;
  if (isMockMode || !db) {
    return uid === "admin-test";
  }
  const snap = await getDoc(doc(db, USERS_COL, uid));
  if (snap.exists()) {
    return (snap.data() as UserProfile).isAdmin;
  }
  return false;
};