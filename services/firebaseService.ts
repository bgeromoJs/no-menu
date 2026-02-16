
import { initializeApp } from "@firebase/app";
import { getFirestore, collection, setDoc, doc, getDoc, deleteDoc, onSnapshot } from "@firebase/firestore";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithCredential } from "@firebase/auth";
import { Product, BusinessSettings, UserProfile } from "../types";
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from "../constants";

// Declaração para o TypeScript reconhecer o objeto global do Google (GIS)
declare var google: any;

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

/**
 * Realiza o login utilizando o Google Identity Services (GIS) com o Client ID fornecido.
 * Isso garante que a autenticação use a "chave certa" (OAuth2 Client ID).
 */
export const loginWithGoogle = async (): Promise<any | null> => {
  if (isMockMode) {
    const mockUser = { 
      uid: "admin-test", 
      displayName: "Vera Admin", 
      email: "admin@teste.com",
      photoURL: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    } as any;
    localStorage.setItem("mock_user", JSON.stringify(mockUser));
    window.dispatchEvent(new Event('auth_change'));
    return mockUser;
  }
  
  if (!auth) throw new Error("Firebase Auth não inicializado");

  return new Promise((resolve, reject) => {
    try {
      // Configura o cliente Google Identity Services
      google.accounts.id.initialize({
        client_id: process.env.GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          try {
            // Cria a credencial do Firebase a partir do ID Token do Google
            const credential = GoogleAuthProvider.credential(response.credential);
            const result = await signInWithCredential(auth, credential);
            resolve(result.user);
          } catch (error) {
            console.error("Erro ao validar credencial no Firebase:", error);
            reject(error);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Exibe o seletor de contas do Google
      google.accounts.id.prompt();
      
      // Também podemos forçar a exibição do popup caso o prompt falhe ou para melhor UX no clique
      // (Nota: google.accounts.id.prompt() é silencioso em alguns casos, 
      // mas para um botão de login manual, renderizar um botão invisível e clicar nele é um truque comum 
      // ou apenas usar o seletor nativo).
    } catch (error) {
      console.error("Erro ao inicializar Google OAuth2:", error);
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
  if (!auth) return;
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

// --- CRUD OPERAÇÕES (Permanecem iguais) ---

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
  try {
    const snap = await getDoc(doc(db, USERS_COL, uid));
    if (snap.exists()) {
      return (snap.data() as UserProfile).isAdmin;
    }
  } catch (e) {
    console.error("Erro ao verificar admin status:", e);
  }
  return false;
};
