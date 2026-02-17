
import { initializeApp, getApps, getApp, FirebaseApp } from "@firebase/app";
import { getFirestore, collection, setDoc, doc, getDoc, deleteDoc, onSnapshot, Firestore, query, orderBy, getDocs, writeBatch } from "@firebase/firestore";
import { Product, BusinessSettings } from "../types";
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from "../constants";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const initFirebase = (): { app: FirebaseApp | null, db: Firestore | null } => {
  try {
    const apps = getApps();
    if (apps.length > 0) {
      const app = getApp();
      return { app, db: getFirestore(app) };
    }
    
    if (!firebaseConfig.apiKey) {
      console.warn("Firebase não configurado. Usando Mock (LocalStorage).");
      return { app: null, db: null };
    }
    
    const app = initializeApp(firebaseConfig);
    return { app, db: getFirestore(app) };
  } catch (e) {
    console.error("Erro Crítico Firebase:", e);
    return { app: null, db: null };
  }
};

const { db } = initFirebase();
export { db };

const PRODUCTS_COL = "products";
const SETTINGS_COL = "settings";
const USERS_COL = "users";

const isMockMode = !db;

// Função para popular o banco de dados pela primeira vez se estiver vazio
export const seedDatabase = async () => {
  if (isMockMode || !db) return;
  
  const settingsRef = doc(db, SETTINGS_COL, "general");
  const settingsSnap = await getDoc(settingsRef);
  
  if (!settingsSnap.exists()) {
    await setDoc(settingsRef, DEFAULT_SETTINGS);
    
    const batch = writeBatch(db);
    INITIAL_PRODUCTS.forEach((p) => {
      const pRef = doc(collection(db, PRODUCTS_COL), p.id);
      batch.set(pRef, p);
    });
    await batch.commit();
    console.log("Database seeded with default menu.");
  }
};

export const checkAdminStatus = async (email: string): Promise<boolean> => {
  if (!email) return false;
  if (isMockMode) return email === "admin@teste.com";
  try {
    const snap = await getDoc(doc(db!, USERS_COL, email));
    return snap.exists() ? snap.data().isAdmin === true : false;
  } catch (e) {
    console.error("Erro ao verificar admin:", e);
    return false;
  }
};

export const syncUser = async (user: { email: string, name: string, picture: string }) => {
  if (isMockMode) return;
  try {
    const userRef = doc(db!, USERS_COL, user.email);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        name: user.name,
        picture: user.picture,
        isAdmin: false,
        createdAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.error("Erro ao sincronizar usuário:", e);
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
  
  return onSnapshot(collection(db, PRODUCTS_COL), (snap) => {
    if (snap.empty) {
      callback(INITIAL_PRODUCTS);
    } else {
      callback(snap.docs.map(d => d.data() as Product));
    }
  });
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
  return onSnapshot(doc(db, SETTINGS_COL, "general"), (snap) => {
    snap.exists() ? callback(snap.data() as BusinessSettings) : callback(DEFAULT_SETTINGS);
  });
};

export const saveSettings = async (s: BusinessSettings) => {
  if (isMockMode || !db) {
    localStorage.setItem(SETTINGS_COL, JSON.stringify(s));
    window.dispatchEvent(new Event('storage'));
    return;
  }
  await setDoc(doc(db, SETTINGS_COL, "general"), s);
};
