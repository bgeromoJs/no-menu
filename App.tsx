
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Utensils, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  ChevronRight,
  RefreshCw,
  Edit2,
  Power,
  Image as ImageIcon,
  Upload,
  Tags,
  LogOut,
  MessageSquare,
  ShieldAlert,
  LogIn,
  Clock,
  Store,
  Camera,
  Database,
  ArrowRight,
  Phone,
  AlertTriangle,
  CheckCircle2
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
  syncUser,
  seedDatabase,
  isMockMode
} from './services/firebaseService';

declare var google: any;

const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

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
  const [user, setUser] = useState<{ email: string, name: string, picture: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [googleBtnLoaded, setGoogleBtnLoaded] = useState(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CUSTOMER);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [checkoutStep, setCheckoutStep] = useState(0);
  
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const gsiInitialized = useRef(false);

  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    address: '',
    paymentMethod: 'Pix' as 'Pix' | 'Cartão' | 'Dinheiro'
  });

  const handleLoginResponse = async (response: any) => {
    const payload = parseJwt(response.credential);
    if (payload) {
      const userData = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      };
      setUser(userData);
      localStorage.setItem('user_session', JSON.stringify(userData));
      const admin = await checkAdminStatus(userData.email);
      setIsAdmin(admin);
      await syncUser(userData);
    }
  };

  const forceGoogleLogin = () => {
    if (typeof google !== 'undefined') {
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          console.warn("Prompt suprimido:", notification.getNotDisplayedReason());
          if (googleBtnContainerRef.current) {
            googleBtnContainerRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user_session');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      checkAdminStatus(u.email).then(setIsAdmin);
    }

    const initGsi = () => {
      if (gsiInitialized.current) return;
      
      if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
          client_id: process.env.GOOGLE_CLIENT_ID,
          callback: handleLoginResponse,
          auto_select: false,
          itp_support: true
        });

        gsiInitialized.current = true;
        
        if (!localStorage.getItem('user_session')) {
          google.accounts.id.prompt();
        }

        renderGoogleButton();
      } else {
        setTimeout(initGsi, 500);
      }
    };

    const renderGoogleButton = () => {
      if (googleBtnContainerRef.current && typeof google !== 'undefined' && !user) {
        google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: 'outline',
          size: 'medium',
          shape: 'pill',
          text: 'signin_with',
          locale: 'pt-BR',
          width: 180
        });
        setGoogleBtnLoaded(true);
      } else if (!user) {
        setTimeout(renderGoogleButton, 300);
      }
    };

    initGsi();
  }, []);

  useEffect(() => {
    if (!user && gsiInitialized.current) {
      const timer = setTimeout(() => {
        if (googleBtnContainerRef.current && typeof google !== 'undefined') {
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: 'medium',
            shape: 'pill',
            text: 'signin_with',
            locale: 'pt-BR',
            width: 180
          });
          setGoogleBtnLoaded(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    const unsubProducts = subscribeProducts((p) => {
      setProducts(p);
      setIsInitializing(false);
    });
    const unsubSettings = subscribeSettings((s) => {
      setSettings(s);
      if (s.categories?.length > 0 && !selectedCategory) setSelectedCategory(s.categories[0]);
      setLoadingMenu(false);
    });
    return () => { unsubProducts(); unsubSettings(); };
  }, []);

  const shopStatus = useMemo(() => {
    if (settings.manualClosed) return { open: false, reason: "Fechado Manualmente" };
    const now = new Date();
    const day = now.getDay();
    const config = settings.hours[day];
    if (!config || !config.enabled) return { open: false, reason: "Fechado hoje" };
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = config.open.split(':').map(Number);
    const [closeH, closeM] = config.close.split(':').map(Number);
    if (currentTime >= (openH * 60 + openM) && currentTime < (closeH * 60 + closeM)) return { open: true, reason: "Loja Aberta" };
    return { open: false, reason: `Abriremos às ${config.open}` };
  }, [settings]);

  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((a, b) => a + b.quantity, 0), [cart]);

  const handleLogout = () => {
    setUser(null);
    setIsAdmin(false);
    setViewMode(ViewMode.CUSTOMER);
    localStorage.removeItem('user_session');
    setGoogleBtnLoaded(false);
  };

  const addToCart = (product: Product) => {
    if (!shopStatus.open) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { product, quantity: 1, observations: '' }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(item => item.product.id !== productId);
      return prev.map(item => item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
    });
  };

  const handleCheckout = () => {
    const itemsList = cart.map(item => `${item.quantity}x ${item.product.name}${item.observations ? ` (Obs: ${item.observations})` : ''}`).join('\n');
    const destinationPhone = settings.whatsappPhone || ADMIN_PHONE;
    const message = encodeURIComponent(`*NOVO PEDIDO - ${settings.name}*\n\n👤 Cliente: ${customerInfo.name}\n📍 Endereço: ${customerInfo.address}\n💳 Pagamento: ${customerInfo.paymentMethod}\n\n🍱 Itens:\n${itemsList}\n\n💰 Total: R$ ${cartTotal.toFixed(2)}`);
    window.open(`https://wa.me/${destinationPhone}?text=${message}`, '_blank');
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
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 px-3 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
             {settings.photoUrl ? (
               <img src={settings.photoUrl} className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover border border-gray-100" alt="Logo" />
             ) : (
               <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">V</div>
             )}
             <div>
               <h1 className="text-[11px] sm:text-base font-bold text-gray-900 leading-tight truncate max-w-[100px] sm:max-w-none">{settings.name}</h1>
               <div className="flex items-center gap-1">
                 <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${shopStatus.open ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                 <p className={`text-[8px] sm:text-[10px] font-bold ${shopStatus.open ? 'text-emerald-600' : 'text-red-500'}`}>{shopStatus.reason}</p>
               </div>
             </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3">
            {isAdmin && (
              <button 
                onClick={() => setViewMode(prev => prev === ViewMode.CUSTOMER ? ViewMode.ADMIN : ViewMode.CUSTOMER)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all border shadow-sm ${viewMode === ViewMode.ADMIN ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-orange-200'}`}
              >
                {viewMode === ViewMode.CUSTOMER ? <><LayoutDashboard size={14} /> <span>Painel</span></> : <><Utensils size={14} /> <span>Cardápio</span></>}
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <img src={user.picture} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-gray-100 shadow-sm" alt="Foto" />
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors p-1"><LogOut size={16}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                 {!googleBtnLoaded && (
                   <button 
                     onClick={forceGoogleLogin}
                     className="flex items-center gap-1.5 bg-white text-gray-600 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                   >
                     <LogIn size={14} className="text-orange-500" />
                     <span>Acessar</span>
                   </button>
                 )}
                 <div ref={googleBtnContainerRef} className={`h-8 sm:h-9 overflow-hidden rounded-full ${!googleBtnLoaded ? 'w-0 opacity-0' : 'opacity-100 transition-opacity duration-300'}`}></div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-2 sm:p-4">
        {loadingMenu ? (
          <div className="py-20 text-center"><RefreshCw className="animate-spin mx-auto text-gray-300" /></div>
        ) : viewMode === ViewMode.CUSTOMER ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
              {settings.categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all border ${selectedCategory === cat ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-200' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-24">
              {products.filter(p => p.category === selectedCategory).map(product => {
                const inCart = cart.find(i => i.product.id === product.id);
                return (
                  <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col group shadow-sm hover:shadow-md transition-all">
                    <div className="h-32 sm:h-40 overflow-hidden relative">
                      <img src={product.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={product.name} />
                      {!shopStatus.open && <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold text-[10px] backdrop-blur-[2px]">FECHADO</div>}
                      {!product.available && <div className="absolute top-2 right-2 bg-red-500 text-white px-1.5 py-0.5 rounded text-[8px] font-bold">ESGOTADO</div>}
                      {inCart && (
                        <div className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded text-[9px] font-black shadow-lg">
                          {inCart.quantity}x
                        </div>
                      )}
                    </div>
                    <div className="p-3 sm:p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-gray-900 text-[11px] sm:text-sm truncate pr-2">{product.name}</h3>
                        <span className="text-orange-600 font-black text-[11px] sm:text-sm whitespace-nowrap">R$ {product.price.toFixed(2)}</span>
                      </div>
                      <p className="text-[9px] sm:text-xs text-gray-500 line-clamp-2 mb-3 flex-1 leading-relaxed">{product.description}</p>
                      
                      {inCart ? (
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => removeFromCart(product.id)}
                            className="flex-1 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-orange-50 text-orange-600 font-bold text-[9px] sm:text-xs flex items-center justify-center gap-1 border border-orange-100"
                          >
                            <Minus size={12} /> Menos
                          </button>
                          <button 
                            onClick={() => addToCart(product)}
                            className="flex-1 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-orange-500 text-white font-bold text-[9px] sm:text-xs flex items-center justify-center gap-1 hover:bg-orange-600 shadow-md shadow-orange-50"
                          >
                            <Plus size={12} /> Mais
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(product)}
                          disabled={!shopStatus.open || !product.available}
                          className="w-full py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-orange-500 text-white font-bold text-[9px] sm:text-xs hover:bg-orange-600 transition-colors disabled:bg-gray-100 disabled:text-gray-400 flex items-center justify-center gap-1.5"
                        >
                          <Plus size={12} /> Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <AdminDashboard products={products} settings={settings} />
        )}
      </main>

      {cartItemCount > 0 && shopStatus.open && viewMode === ViewMode.CUSTOMER && (
        <div className="fixed bottom-0 inset-x-0 p-3 sm:p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-50">
          <div className="max-w-4xl mx-auto">
            <button onClick={() => setIsCartOpen(true)} className="w-full bg-orange-500 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl flex items-center justify-between px-4 sm:px-6 font-bold shadow-xl shadow-orange-100 hover:bg-orange-600 transition-colors">
               <div className="flex items-center gap-1.5 sm:gap-2"><ShoppingCart size={16} /><span className="text-[10px] sm:text-sm">Pedido ({cartItemCount})</span></div>
               <span className="text-[10px] sm:text-sm">R$ {cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
             <div className="p-4 sm:p-6 border-b flex justify-between items-center">
               <h2 className="font-bold text-sm sm:text-lg">Meu Pedido</h2>
               <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={18}/></button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {cart.map(item => (
                  <div key={item.product.id} className="flex flex-col gap-2 border-b border-gray-50 pb-3 sm:pb-4">
                    <div className="flex justify-between font-bold text-[10px] sm:text-sm">
                      <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 sm:p-1 flex-shrink-0">
                           <button onClick={() => removeFromCart(item.product.id)}><Minus size={10}/></button>
                           <span className="w-3 sm:w-6 text-center text-[9px] sm:text-xs">{item.quantity}</span>
                           <button onClick={() => addToCart(item.product)}><Plus size={10}/></button>
                        </div>
                        <span className="truncate">{item.product.name}</span>
                      </div>
                      <span className="flex-shrink-0">R$ {(item.quantity * item.product.price).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        placeholder="Ex: Sem cebola..." 
                        className="flex-1 text-[9px] sm:text-[11px] p-2 bg-gray-50 rounded-lg border-none outline-none focus:ring-1 focus:ring-orange-200 italic"
                        value={item.observations}
                        onChange={(e) => {
                          const obs = e.target.value;
                          setCart(c => c.map(i => i.product.id === item.product.id ? {...i, observations: obs} : i));
                        }}
                      />
                      <button onClick={() => setCart(c => c.filter(i => i.product.id !== item.product.id))} className="text-red-400 p-1"><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
                {checkoutStep === 1 && (
                  <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-gray-100 animate-in fade-in duration-300">
                    <h3 className="font-bold text-[10px] sm:text-sm text-gray-700 uppercase tracking-wider">Entrega</h3>
                    <input className="w-full p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl text-[10px] sm:text-sm border-transparent focus:border-orange-200 border transition-colors outline-none" placeholder="Qual seu nome?" value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} />
                    <textarea className="w-full p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl text-[10px] sm:text-sm h-16 sm:h-24 border-transparent focus:border-orange-200 border transition-colors outline-none" placeholder="Seu endereço completo" value={customerInfo.address} onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})} />
                    <h3 className="font-bold text-[10px] sm:text-sm text-gray-700 uppercase tracking-wider">Pagamento</h3>
                    <div className="flex gap-1.5">
                       {['Pix', 'Cartão', 'Dinheiro'].map(m => (
                         <button key={m} onClick={() => setCustomerInfo({...customerInfo, paymentMethod: m as any})} className={`flex-1 py-2 sm:py-3 text-[8px] sm:text-[10px] font-bold rounded-lg border transition-all ${customerInfo.paymentMethod === m ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-400 hover:border-gray-300'}`}>{m}</button>
                       ))}
                    </div>
                  </div>
                )}
             </div>
             <div className="p-4 sm:p-6 bg-gray-50 border-t">
                <div className="flex justify-between items-center mb-3 sm:mb-4">
                   <span className="text-[10px] sm:text-sm text-gray-500 font-medium">Total</span>
                   <span className="text-base sm:text-xl font-black text-gray-900">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={checkoutStep === 0 ? () => setCheckoutStep(1) : handleCheckout}
                  disabled={checkoutStep === 1 && (!customerInfo.name || !customerInfo.address)}
                  className="w-full py-2.5 sm:py-4 bg-orange-500 text-white rounded-lg sm:rounded-xl font-bold shadow-lg shadow-orange-50 disabled:opacity-50 hover:bg-orange-600 transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm"
                >
                  {checkoutStep === 0 ? <>Continuar <ChevronRight size={14}/></> : <><MessageSquare size={14}/> Enviar Pedido</>}
                </button>
                {checkoutStep === 1 && <button onClick={() => setCheckoutStep(0)} className="w-full mt-1.5 text-gray-400 font-bold text-[9px] sm:text-xs p-1.5">Voltar</button>}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ products, settings }: { products: Product[], settings: BusinessSettings }) {
  const [activeTab, setActiveTab] = useState<'menu' | 'settings' | 'hours' | 'categories'>('menu');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [tempSettings, setTempSettings] = useState<BusinessSettings>(settings);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  const fileInputLogoRef = useRef<HTMLInputElement>(null);
  const fileInputProdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    try {
      setSaving(true);
      await saveProductToDb({
        id: editingProduct.id || `p-${Date.now()}`,
        name: editingProduct.name || 'Sem nome',
        description: editingProduct.description || '',
        price: editingProduct.price || 0,
        category: editingProduct.category || tempSettings.categories[0],
        image: editingProduct.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400',
        available: editingProduct.available !== undefined ? editingProduct.available : true
      });
      showToast("Prato salvo com sucesso!");
      setEditingProduct(null);
    } catch (e) {
      showToast("Erro ao salvar prato.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (specificSettings?: BusinessSettings) => {
    try {
      setSaving(true);
      await saveSettings(specificSettings || tempSettings);
      showToast("Configurações atualizadas!");
    } catch (e) {
      showToast("Erro ao atualizar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await fileToBase64(file);
      const newSettings = {...tempSettings, photoUrl: b64};
      setTempSettings(newSettings);
      await handleSaveSettings(newSettings);
    }
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    if (tempSettings.categories.includes(newCategoryName)) return;
    setTempSettings({
      ...tempSettings,
      categories: [...tempSettings.categories, newCategoryName.trim()]
    });
    setNewCategoryName('');
  };

  const removeCategory = (cat: string) => {
    setTempSettings({
      ...tempSettings,
      categories: tempSettings.categories.filter(c => c !== cat)
    });
  };

  const updateHour = (day: number, field: 'open' | 'close' | 'enabled', value: string | boolean) => {
    setTempSettings({
      ...tempSettings,
      hours: {
        ...tempSettings.hours,
        [day]: { ...tempSettings.hours[day], [field]: value }
      }
    });
  };

  const toggleManualStatus = async () => {
    const updated = { ...tempSettings, manualClosed: !tempSettings.manualClosed };
    setTempSettings(updated);
    await handleSaveSettings(updated);
  };

  const handleSeed = async () => {
    try {
      setSaving(true);
      await seedDatabase();
      showToast("Dados iniciais carregados!");
    } catch (e) {
      showToast("Erro ao carregar iniciais.", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      try {
        setSaving(true);
        await deleteProductFromDb(deleteTargetId);
        showToast("Item removido!");
        setDeleteTargetId(null);
      } catch (e) {
        showToast("Erro ao remover.", "error");
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 relative pb-10">
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed top-20 right-4 z-[500] animate-in slide-in-from-right fade-in duration-300">
           <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
              <span className="text-xs sm:text-sm font-bold">{toast.msg}</span>
           </div>
        </div>
      )}

      <div className="animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
           <div className="flex items-center gap-4 text-center sm:text-left">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${tempSettings.manualClosed ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                {tempSettings.manualClosed ? <ShieldAlert size={24} /> : <Store size={24} />}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">Status do Recebimento</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium">
                  {tempSettings.manualClosed ? 'Pedidos desativados manualmente' : 'Sistema operando normalmente'}
                </p>
              </div>
           </div>
           
           <button 
              onClick={toggleManualStatus} 
              disabled={saving}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-[10px] sm:text-xs transition-all flex items-center justify-center gap-2 group disabled:opacity-50 ${tempSettings.manualClosed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-600' : 'bg-red-500 text-white shadow-lg shadow-red-100 hover:bg-red-600'}`}
           >
             {saving ? <RefreshCw className="animate-spin" size={14}/> : <Power size={14} className="group-hover:rotate-12 transition-transform" />}
             {tempSettings.manualClosed ? 'REATIVAR LOJA AGORA' : 'DESATIVAR LOJA MANUAL'}
           </button>
        </div>
      </div>

      <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar scroll-smooth">
        {[
          { id: 'menu', icon: Utensils, label: 'Cardápio' },
          { id: 'categories', icon: Tags, label: 'Categorias' },
          { id: 'hours', icon: Clock, label: 'Horários' },
          { id: 'settings', icon: Store, label: 'Dados' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 px-2 sm:px-4 rounded-lg text-[9px] sm:text-[11px] font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-orange-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <tab.icon size={12} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-full overflow-hidden px-0.5">
        {activeTab === 'menu' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-1">
              <h2 className="font-black text-gray-900 flex items-center gap-1.5 text-xs sm:text-lg">Gerenciar Cardápio</h2>
              <div className="flex gap-2">
                 <button onClick={handleSeed} disabled={saving} className="text-gray-400 hover:text-blue-500 p-2 disabled:opacity-50"><Database size={16} /></button>
                 <button onClick={() => setEditingProduct({ available: true, category: tempSettings.categories[0] })} className="bg-orange-500 text-white px-2.5 sm:px-4 py-1.5 rounded-lg text-[9px] sm:text-xs font-bold shadow-md shadow-orange-50 hover:bg-orange-600">+ Novo Item</button>
              </div>
            </div>
            <div className="grid gap-2">
              {products.length === 0 && <div className="p-8 text-center bg-white rounded-xl border border-dashed border-gray-200 text-gray-400 text-[9px] sm:text-xs">O cardápio está vazio.</div>}
              {products.map(p => (
                <div key={p.id} className="bg-white p-2.5 sm:p-4 rounded-xl flex items-center justify-between border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-4 overflow-hidden">
                    <img src={p.image} className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0" alt={p.name} />
                    <div className="overflow-hidden">
                      <p className="font-bold text-[10px] sm:text-sm text-gray-900 truncate">{p.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[8px] sm:text-[10px] text-orange-600 font-black">R$ {p.price.toFixed(2)}</p>
                        <span className="text-[7px] sm:text-[9px] text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded uppercase font-bold">{p.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                    <button onClick={() => saveProductToDb({...p, available: !p.available})} className={`p-1.5 rounded-lg ${p.available ? 'text-emerald-500 hover:bg-emerald-50' : 'text-red-500 hover:bg-red-50'}`} title={p.available ? 'Disponível' : 'Indisponível'}><Power size={14}/></button>
                    <button onClick={() => setEditingProduct(p)} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg"><Edit2 size={14}/></button>
                    <button onClick={() => setDeleteTargetId(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm space-y-4 animate-in fade-in duration-300">
             <div className="flex items-center justify-between">
                <h2 className="font-black text-gray-900 text-xs sm:text-lg uppercase tracking-wider">Categorias</h2>
                <Tags size={18} className="text-gray-300" />
             </div>
             <div className="flex gap-1.5">
               <input 
                 className="flex-1 p-2.5 bg-gray-50 rounded-lg text-[10px] sm:text-sm border-transparent focus:border-orange-200 border outline-none" 
                 placeholder="Nova categoria..." 
                 value={newCategoryName}
                 onChange={e => setNewCategoryName(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && addCategory()}
               />
               <button onClick={addCategory} className="bg-gray-900 text-white px-3 sm:px-6 rounded-lg text-[9px] sm:text-xs font-bold">Adicionar</button>
             </div>
             <div className="grid grid-cols-1 gap-2">
               {tempSettings.categories.map((cat, idx) => (
                 <div key={cat} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-[10px] sm:text-xs font-bold text-gray-700">{cat}</span>
                    <button onClick={() => removeCategory(cat)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                 </div>
               ))}
             </div>
             <button onClick={() => handleSaveSettings()} disabled={saving} className="w-full py-3 bg-orange-500 text-white rounded-lg font-bold text-[10px] sm:text-xs disabled:opacity-50">
                {saving ? <RefreshCw className="animate-spin mx-auto" size={16}/> : 'SALVAR CATEGORIAS'}
             </button>
          </div>
        )}

        {activeTab === 'hours' && (
          <div className="bg-white p-3 sm:p-6 rounded-xl border border-gray-100 shadow-sm space-y-4 animate-in fade-in duration-300">
             <h2 className="font-black text-gray-900 text-xs sm:text-lg uppercase tracking-wider">Horários</h2>
             <div className="space-y-2.5">
                {WEEK_DAYS.map((dayName, idx) => {
                  const hour = tempSettings.hours[idx];
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-4 bg-gray-50 rounded-lg gap-3">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={hour.enabled} onChange={e => updateHour(idx, 'enabled', e.target.checked)} className="w-4 h-4 rounded text-orange-500" />
                        <span className="text-[10px] sm:text-xs font-bold w-28 whitespace-nowrap">{dayName}</span>
                      </div>
                      {hour.enabled ? (
                        <div className="flex items-center gap-2 justify-end flex-1">
                          <input type="time" value={hour.open} onChange={e => updateHour(idx, 'open', e.target.value)} className="text-[10px] sm:text-xs p-1.5 sm:p-2 rounded-lg bg-white border border-gray-200 outline-none w-24 sm:w-28 text-center font-bold" />
                          <span className="text-gray-400 text-[10px]">às</span>
                          <input type="time" value={hour.close} onChange={e => updateHour(idx, 'close', e.target.value)} className="text-[10px] sm:text-xs p-1.5 sm:p-2 rounded-lg bg-white border border-gray-200 outline-none w-24 sm:w-28 text-center font-bold" />
                        </div>
                      ) : (
                        <span className="text-[9px] sm:text-xs font-bold text-gray-300 uppercase italic">Fechado</span>
                      )}
                    </div>
                  )
                })}
             </div>
             <button onClick={() => handleSaveSettings()} disabled={saving} className="w-full py-3 sm:py-4 bg-orange-500 text-white rounded-xl font-bold text-[10px] sm:text-sm disabled:opacity-50 shadow-lg shadow-orange-50">
               {saving ? <RefreshCw className="animate-spin mx-auto" size={18}/> : 'SALVAR ESCALA DE HORÁRIOS'}
             </button>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white p-3 sm:p-6 rounded-xl border border-gray-100 shadow-sm space-y-5 animate-in fade-in duration-300">
            <h2 className="font-black text-gray-900 text-xs sm:text-lg uppercase tracking-wider">Dados do Estabelecimento</h2>
            
            <div className="space-y-4">
               <div className="flex flex-col items-center gap-2">
                  <div className="relative group cursor-pointer" onClick={() => fileInputLogoRef.current?.click()}>
                     <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-gray-50 overflow-hidden border-2 border-dashed border-gray-200 flex items-center justify-center">
                       {tempSettings.photoUrl ? <img src={tempSettings.photoUrl} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300" size={32}/>}
                     </div>
                     <button className="absolute -bottom-1 -right-1 bg-orange-500 text-white p-2 rounded-lg shadow-md"><Camera size={14}/></button>
                     <input type="file" ref={fileInputLogoRef} hidden accept="image/*" onChange={handleLogoUpload} />
                  </div>
                  <p className="text-[8px] font-bold text-gray-400 uppercase">Logo da Loja</p>
               </div>

               <label className="block space-y-1.5">
                 <span className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest">Nome da Loja</span>
                 <input className="w-full p-3 sm:p-4 bg-gray-50 rounded-xl text-[11px] sm:text-sm font-bold border-transparent focus:border-orange-200 border outline-none" value={tempSettings.name} onChange={e => setTempSettings({...tempSettings, name: e.target.value})} />
               </label>

               <label className="block space-y-1.5">
                 <span className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest">WhatsApp para Pedidos</span>
                 <div className="relative">
                   <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                   <input className="w-full p-3 sm:p-4 pl-10 bg-gray-50 rounded-xl text-[11px] sm:text-sm font-bold border-transparent focus:border-orange-200 border outline-none" placeholder="Ex: 5511999999999" value={tempSettings.whatsappPhone} onChange={e => setTempSettings({...tempSettings, whatsappPhone: e.target.value})} />
                 </div>
               </label>

               <button onClick={() => handleSaveSettings()} disabled={saving} className="w-full py-3 sm:py-4 bg-gray-900 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase shadow-lg disabled:opacity-50">
                 {saving ? <RefreshCw className="animate-spin mx-auto" size={18}/> : 'GRAVAR TODAS AS ALTERAÇÕES'}
               </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center space-y-6 shadow-2xl scale-in duration-200">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                 <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Excluir Item?</h3>
                <p className="text-sm text-gray-500 leading-relaxed mt-2">O prato será removido permanentemente do cardápio online.</p>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setDeleteTargetId(null)} className="flex-1 py-3.5 bg-gray-50 text-gray-500 font-bold rounded-xl hover:bg-gray-100 transition-colors">Cancelar</button>
                 <button onClick={confirmDelete} disabled={saving} className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-100 transition-all flex items-center justify-center">
                   {saving ? <RefreshCw className="animate-spin" size={18}/> : 'Excluir Agora'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg p-4 sm:p-8 rounded-2xl sm:rounded-3xl space-y-4 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
             <button onClick={() => setEditingProduct(null)} className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-full"><X size={18}/></button>
             <h3 className="font-black text-sm sm:text-xl text-gray-900 uppercase pr-8">{editingProduct.id ? 'Editar' : 'Novo'} Item</h3>
             
             <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-2 pr-1">
                <div className="flex justify-center">
                   <div className="relative cursor-pointer" onClick={() => fileInputProdRef.current?.click()}>
                     <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl bg-gray-50 overflow-hidden border-2 border-dashed border-gray-200 flex items-center justify-center">
                        {editingProduct.image ? <img src={editingProduct.image} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300" size={28}/>}
                     </div>
                     <input type="file" ref={fileInputProdRef} hidden accept="image/*" onChange={async e => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const b64 = await fileToBase64(file);
                         setEditingProduct({...editingProduct, image: b64});
                       }
                     }} />
                   </div>
                </div>

                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase">Nome do Prato</span>
                    <input className="w-full p-2.5 sm:p-4 bg-gray-50 rounded-lg text-[10px] sm:text-sm border-transparent focus:border-orange-200 border outline-none" placeholder="Ex: Marmita de Carne Assada" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <label className="block space-y-1">
                      <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase">Preço (R$)</span>
                      <input className="w-full p-2.5 sm:p-4 bg-gray-50 rounded-lg text-[10px] sm:text-sm border-transparent focus:border-orange-200 border outline-none font-bold text-orange-600" placeholder="0.00" type="number" step="0.10" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase">Categoria</span>
                      <select className="w-full p-2.5 sm:p-4 bg-gray-50 rounded-lg text-[10px] sm:text-sm border-transparent focus:border-orange-200 border outline-none appearance-none font-medium" value={editingProduct.category || tempSettings.categories[0]} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}>
                        {tempSettings.categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase">Descrição</span>
                    <textarea className="w-full p-2.5 sm:p-4 bg-gray-50 rounded-lg text-[10px] sm:text-sm h-14 sm:h-20 border-transparent focus:border-orange-200 border outline-none resize-none leading-relaxed" placeholder="Fale sobre os ingredientes..." value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
                  </label>

                  <div className="flex items-center gap-2.5 bg-gray-50 p-2.5 sm:p-4 rounded-lg">
                    <input type="checkbox" id="avail-adm" checked={editingProduct.available !== false} onChange={e => setEditingProduct({...editingProduct, available: e.target.checked})} className="w-4 h-4 rounded text-orange-500" />
                    <label htmlFor="avail-adm" className="text-[9px] sm:text-xs font-bold text-gray-700 cursor-pointer">Disponível no cardápio online?</label>
                  </div>
                </div>
             </div>
             <div className="flex gap-2 sm:gap-3 pt-3 border-t mt-auto">
                <button onClick={() => setEditingProduct(null)} className="flex-1 py-2.5 sm:py-4 font-black text-gray-400 text-[9px] sm:text-xs uppercase hover:bg-gray-50 rounded-lg">Cancelar</button>
                <button onClick={handleSaveProduct} disabled={saving} className="flex-[2] py-2.5 sm:py-4 bg-orange-500 text-white rounded-lg sm:rounded-xl font-black text-[9px] sm:text-xs uppercase shadow-md shadow-orange-50 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <RefreshCw className="animate-spin" size={14}/> : <><Database size={14}/> Gravar Item</>}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
