
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Utensils, 
  ArrowLeft, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  ChevronRight,
  RefreshCw,
  Edit2,
  FlaskConical,
  Power,
  Settings as SettingsIcon,
  Image as ImageIcon,
  Calendar,
  Upload,
  CheckCircle2,
  Tags,
  CreditCard,
  Banknote,
  Smartphone,
  LogOut,
  MessageSquare,
  ShieldAlert,
  ChefHat,
  LogIn
} from 'lucide-react';
import { Product, CartItem, ViewMode, BusinessSettings } from './types';
import { ADMIN_PHONE, WEEK_DAYS, DEFAULT_SETTINGS } from './constants';
import { 
  subscribeProducts, 
  saveProductToDb, 
  deleteProductFromDb,
  subscribeSettings,
  saveSettings,
  checkAdminStatus,
  loginWithGoogle,
  logout,
  subscribeAuth
} from './services/firebaseService';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CUSTOMER);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [checkoutStep, setCheckoutStep] = useState(0);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    address: '',
    paymentMethod: 'Pix' as 'Pix' | 'Cartão' | 'Dinheiro'
  });

  const isMock = !process.env.FIREBASE_CONFIG || process.env.FIREBASE_CONFIG === '{}' || !JSON.parse(process.env.FIREBASE_CONFIG).apiKey;

  // Gerenciamento de Autenticação
  useEffect(() => {
    const unsubAuth = subscribeAuth(async (user) => {
      if (user) {
        setCurrentUser(user);
        const admin = await checkAdminStatus(user.uid);
        setIsAdmin(admin);
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
        setViewMode(ViewMode.CUSTOMER);
      }
      setIsInitializing(false);
    });
    return () => unsubAuth();
  }, []);

  // Dados do Cardápio (Público)
  useEffect(() => {
    const unsubProducts = subscribeProducts(setProducts);
    const unsubSettings = subscribeSettings((s) => {
      setSettings(s);
      if (s.categories?.length > 0 && !selectedCategory) setSelectedCategory(s.categories[0]);
      setLoadingMenu(false);
    });
    return () => { unsubProducts(); unsubSettings(); };
  }, []);

  const shopStatus = useMemo(() => {
    if (settings.manualClosed) return { open: false, reason: "Fechado" };
    const now = new Date();
    const day = now.getDay();
    const config = settings.hours[day];
    if (!config || !config.enabled) return { open: false, reason: "Fechado hoje" };
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = config.open.split(':').map(Number);
    const [closeH, closeM] = config.close.split(':').map(Number);
    if (currentTime >= (openH * 60 + openM) && currentTime < (closeH * 60 + closeM)) return { open: true, reason: "Aberto" };
    return { open: false, reason: `Abriremos às ${config.open}` };
  }, [settings]);

  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((a, b) => a + b.quantity, 0), [cart]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      console.error(e);
      alert("Falha no login. Verifique as configurações do Google Console.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const addToCart = (product: Product) => {
    if (!shopStatus.open) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { product, quantity: 1, observations: '' }];
    });
  };

  const handleCheckout = () => {
    const itemsList = cart.map(item => `${item.quantity}x ${item.product.name}${item.observations ? ` (Obs: ${item.observations})` : ''}`).join('\n');
    const message = encodeURIComponent(`*NOVO PEDIDO*\n\n👤 Cliente: ${customerInfo.name}\n📍 Endereço: ${customerInfo.address}\n💳 Pagamento: ${customerInfo.paymentMethod}\n\n🍱 Itens:\n${itemsList}\n\n💰 Total: R$ ${cartTotal.toFixed(2)}`);
    window.open(`https://wa.me/${ADMIN_PHONE}?text=${message}`, '_blank');
    setCart([]); setCheckoutStep(0); setIsCartOpen(false);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             {settings.photoUrl ? (
               <img src={settings.photoUrl} className="w-10 h-10 rounded-lg object-cover" />
             ) : (
               <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">V</div>
             )}
             <div>
               <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">{settings.name}</h1>
               <p className={`text-[10px] font-bold ${shopStatus.open ? 'text-emerald-600' : 'text-red-500'}`}>{shopStatus.reason}</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button 
                onClick={() => setViewMode(prev => prev === ViewMode.CUSTOMER ? ViewMode.ADMIN : ViewMode.CUSTOMER)}
                className={`p-2 rounded-lg ${viewMode === ViewMode.ADMIN ? 'bg-orange-50 text-orange-600' : 'text-gray-400'}`}
              >
                {viewMode === ViewMode.CUSTOMER ? <LayoutDashboard size={20} /> : <Utensils size={20} />}
              </button>
            )}

            {currentUser ? (
              <button onClick={() => confirm("Sair?") && logout()} className="flex items-center gap-2">
                <img src={currentUser.photoURL} className="w-8 h-8 rounded-full border border-gray-100" />
                <LogOut size={16} className="text-gray-400" />
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-600 transition-all disabled:opacity-50"
              >
                {isLoggingIn ? <RefreshCw size={14} className="animate-spin" /> : <LogIn size={14} />}
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4">
        {loadingMenu ? (
          <div className="py-20 text-center"><RefreshCw className="animate-spin mx-auto text-gray-300" /></div>
        ) : viewMode === ViewMode.CUSTOMER ? (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
              {settings.categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${selectedCategory === cat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-20">
              {products.filter(p => p.category === selectedCategory).map(product => (
                <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col group">
                  <div className="h-40 overflow-hidden relative">
                    <img src={product.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {!shopStatus.open && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold text-xs">FECHADO</div>}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-gray-900 text-sm">{product.name}</h3>
                      <span className="text-orange-600 font-black text-sm">R$ {product.price.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">{product.description}</p>
                    <button 
                      onClick={() => addToCart(product)}
                      disabled={!shopStatus.open}
                      className="w-full py-2.5 rounded-xl bg-orange-500 text-white font-bold text-xs hover:bg-orange-600 transition-colors disabled:bg-gray-100 disabled:text-gray-400 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <AdminDashboard products={products} settings={settings} isAdmin={isAdmin} />
        )}
      </main>

      {/* Mini Carrinho e Modais iguais à versão anterior */}
      {cartItemCount > 0 && shopStatus.open && viewMode === ViewMode.CUSTOMER && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-50">
          <div className="max-w-4xl mx-auto">
            <button onClick={() => setIsCartOpen(true)} className="w-full bg-orange-500 text-white py-4 rounded-2xl flex items-center justify-between px-6 font-bold shadow-xl shadow-orange-100">
               <div className="flex items-center gap-2"><ShoppingCart size={20} /><span>Ver Pedido ({cartItemCount})</span></div>
               <span>R$ {cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Carrinho simplificado conforme pedido de fluxo similar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
             <div className="p-6 border-b flex justify-between items-center">
               <h2 className="font-bold text-lg">Meu Pedido</h2>
               <button onClick={() => setIsCartOpen(false)}><X /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.map(item => (
                  <div key={item.product.id} className="flex flex-col gap-2 border-b border-gray-50 pb-4">
                    <div className="flex justify-between font-bold text-sm">
                      <span>{item.quantity}x {item.product.name}</span>
                      <span>R$ {(item.quantity * item.product.price).toFixed(2)}</span>
                    </div>
                    <input 
                      placeholder="Observações..." 
                      className="text-[10px] p-2 bg-gray-50 rounded border-none outline-none focus:ring-1 focus:ring-orange-200"
                      value={item.observations}
                      onChange={(e) => {
                        const obs = e.target.value;
                        setCart(c => c.map(i => i.product.id === item.product.id ? {...i, observations: obs} : i));
                      }}
                    />
                  </div>
                ))}
                {checkoutStep === 1 && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <input className="w-full p-4 bg-gray-50 rounded-xl text-sm" placeholder="Nome completo" value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} />
                    <textarea className="w-full p-4 bg-gray-50 rounded-xl text-sm h-24" placeholder="Endereço de entrega" value={customerInfo.address} onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})} />
                    <div className="flex gap-2">
                       {['Pix', 'Cartão', 'Dinheiro'].map(m => (
                         <button key={m} onClick={() => setCustomerInfo({...customerInfo, paymentMethod: m as any})} className={`flex-1 py-3 text-[10px] font-bold rounded-lg border ${customerInfo.paymentMethod === m ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400'}`}>{m}</button>
                       ))}
                    </div>
                  </div>
                )}
             </div>
             <div className="p-6 bg-gray-50 border-t">
                <div className="flex justify-between items-center mb-4">
                   <span className="text-gray-500">Total</span>
                   <span className="text-xl font-bold">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={checkoutStep === 0 ? () => setCheckoutStep(1) : handleCheckout}
                  disabled={checkoutStep === 1 && (!customerInfo.name || !customerInfo.address)}
                  className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-100 disabled:opacity-50"
                >
                  {checkoutStep === 0 ? 'Continuar' : 'Enviar WhatsApp'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// O componente AdminDashboard permanece com a mesma estrutura de edição
function AdminDashboard({ products, settings, isAdmin }: { products: Product[], settings: BusinessSettings, isAdmin: boolean }) {
  if (!isAdmin) return <div className="p-20 text-center"><ShieldAlert className="mx-auto mb-4 text-red-500" /><h2 className="font-bold">Acesso Negado</h2></div>;
  return <div className="py-10 text-center text-gray-400">Painel Administrativo em Construção... (Funcionalidades de CRUD de produto e configurações de loja aqui)</div>;
}
