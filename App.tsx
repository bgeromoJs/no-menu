
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
  LogIn,
  LogOut,
  User as UserIcon,
  MessageSquare,
  ShieldAlert
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
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CUSTOMER);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    address: '',
    paymentMethod: 'Pix' as 'Pix' | 'Cartão' | 'Dinheiro'
  });

  const isMock = !process.env.FIREBASE_CONFIG || process.env.FIREBASE_CONFIG === '{}' || JSON.parse(process.env.FIREBASE_CONFIG).apiKey === "";

  useEffect(() => {
    const unsubProducts = subscribeProducts(setProducts);
    const unsubSettings = subscribeSettings((s) => {
      setSettings(s);
      if (s.categories && s.categories.length > 0 && !selectedCategory) {
        setSelectedCategory(s.categories[0]);
      }
      setLoading(false);
    });

    const unsubAuth = subscribeAuth(async (user) => {
      setCurrentUser(user);
      if (user) {
        const admin = await checkAdminStatus(user.uid);
        setIsAdmin(admin);
      } else {
        setIsAdmin(false);
        setViewMode(ViewMode.CUSTOMER);
      }
    });

    return () => {
      unsubProducts();
      unsubSettings();
      unsubAuth();
    };
  }, []);

  const shopStatus = useMemo(() => {
    if (settings.manualClosed) return { open: false, reason: "Fechado manualmente" };
    const now = new Date();
    const day = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const config = settings.hours[day];
    if (!config || !config.enabled) return { open: false, reason: "Fechado hoje" };
    const [openH, openM] = config.open.split(':').map(Number);
    const [closeH, closeM] = config.close.split(':').map(Number);
    const openTime = openH * 60 + openM;
    const closeTime = closeH * 60 + closeM;
    if (currentTime >= openTime && currentTime < closeTime) return { open: true, reason: "Aberto agora" };
    return { open: false, reason: `Abriremos às ${config.open}` };
  }, [settings]);

  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((a, b) => a + b.quantity, 0), [cart]);

  const addToCart = (product: Product) => {
    if (!shopStatus.open) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { product, quantity: 1, observations: '' }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateItemObservation = (productId: string, observation: string) => {
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, observations: observation } : item));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleCheckout = () => {
    const itemsList = cart.map(item => 
      `${item.quantity}x ${item.product.name}${item.observations ? `\n   Obs: ${item.observations}` : ''} (R$ ${(item.quantity * item.product.price).toFixed(2)})`
    ).join('\n');
    
    const message = encodeURIComponent(
      `*NOVO PEDIDO - ${settings.name}*\n\n` +
      `👤 *Cliente:* ${customerInfo.name}\n` +
      `📍 *Endereço:* ${customerInfo.address}\n` +
      `💳 *Pagamento:* ${customerInfo.paymentMethod}\n\n` +
      `🍱 *Itens:*\n${itemsList}\n\n` +
      `💰 *Total:* R$ ${cartTotal.toFixed(2)}`
    );
    window.open(`https://wa.me/${ADMIN_PHONE}?text=${message}`, '_blank');
    setCart([]);
    setCheckoutStep(0);
    setIsCartOpen(false);
  };

  const handleLogin = async () => {
    setAuthLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login error:", error);
      alert("Erro ao entrar com Google. Tente novamente.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Deseja sair da conta?")) {
      await logout();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
      {isMock && (
        <div className="bg-orange-50 border-b border-orange-100 py-1.5 px-4 flex items-center justify-center gap-2 text-[10px] font-bold text-orange-700 uppercase tracking-widest text-center">
          <FlaskConical size={12} /> Modo de Teste Ativado
        </div>
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
             {settings.photoUrl ? (
               <img src={settings.photoUrl} className="w-10 h-10 rounded-lg object-cover shadow-sm flex-shrink-0" alt="Logo" />
             ) : (
               <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-xl flex-shrink-0">V</div>
             )}
             <div className="truncate">
               <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">{settings.name}</h1>
               <p className={`text-[10px] sm:text-xs font-bold flex items-center gap-1 ${shopStatus.open ? 'text-emerald-600' : 'text-red-500'}`}>
                 <span className={`w-1.5 h-1.5 rounded-full ${shopStatus.open ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                 {shopStatus.reason}
               </p>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!currentUser ? (
              <button 
                onClick={handleLogin}
                disabled={authLoading}
                className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-full shadow-sm transition-all active:scale-95 text-xs sm:text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                {authLoading ? (
                  <RefreshCw size={16} className="animate-spin text-orange-500" />
                ) : (
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                )}
                <span>{authLoading ? 'Entrando...' : 'Entrar'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button 
                    onClick={() => setViewMode(prev => prev === ViewMode.CUSTOMER ? ViewMode.ADMIN : ViewMode.CUSTOMER)}
                    className={`p-2 transition-colors rounded-lg ${viewMode === ViewMode.ADMIN ? 'bg-orange-50 text-orange-600' : 'text-gray-400 hover:text-orange-500'}`}
                    title="Painel Admin"
                  >
                    {viewMode === ViewMode.CUSTOMER ? <LayoutDashboard size={20} /> : <Utensils size={20} />}
                  </button>
                )}
                <div className="flex items-center gap-2 bg-gray-50 pr-1 pl-3 py-1 rounded-full border border-gray-100 group relative">
                   <div className="flex flex-col items-end mr-1 hidden sm:flex">
                     <span className="text-[10px] font-bold text-gray-900 leading-none">{currentUser.displayName?.split(' ')[0]}</span>
                     {isAdmin && <span className="text-[8px] font-black text-orange-500 uppercase tracking-tighter">Admin</span>}
                   </div>
                   <button onClick={handleLogout} className="relative">
                      <img 
                        src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=random`} 
                        className="w-8 h-8 rounded-full border-2 border-white shadow-sm hover:ring-2 hover:ring-orange-200 transition-all" 
                        alt="Profile"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <LogOut size={10} className="text-gray-400" />
                      </div>
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-300">
            <RefreshCw size={32} className="animate-spin mb-4 text-orange-400" />
            <p className="text-sm font-medium">Carregando cardápio...</p>
          </div>
        ) : viewMode === ViewMode.CUSTOMER ? (
          <div className="space-y-6">
            {!shopStatus.open && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                <p className="text-red-700 font-bold text-xs sm:text-sm">Fechados para pedidos no momento.</p>
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {settings.categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border ${
                    selectedCategory === cat 
                    ? 'bg-gray-900 text-white border-gray-900 shadow-md' 
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pb-24">
              {products.filter(p => p.category === selectedCategory).length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-400 text-sm">Nenhum item nesta categoria.</div>
              ) : (
                products.filter(p => p.category === selectedCategory).map(product => (
                  <div key={product.id} className="card-clean overflow-hidden flex flex-col group h-full">
                    <div className="h-40 sm:h-44 bg-gray-100 overflow-hidden relative">
                      <img src={product.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      {!shopStatus.open && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="bg-white/90 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Fechado</span></div>}
                    </div>
                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="font-bold text-gray-900 leading-snug text-sm sm:text-base">{product.name}</h3>
                        <span className="text-orange-600 font-bold text-xs sm:text-sm bg-orange-50 px-2 py-0.5 rounded whitespace-nowrap">R$ {product.price.toFixed(2)}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 mb-4 flex-1">{product.description}</p>
                      <button 
                        onClick={() => addToCart(product)}
                        disabled={!shopStatus.open}
                        className={`w-full py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 active:scale-95 ${shopStatus.open ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                      >
                        <Plus size={16} /> {shopStatus.open ? 'Adicionar' : 'Indisponível'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <AdminDashboard products={products} settings={settings} isAdmin={isAdmin} />
        )}
      </main>

      {viewMode === ViewMode.CUSTOMER && cartItemCount > 0 && shopStatus.open && (
         <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-2xl z-50">
           <div className="max-w-4xl mx-auto">
             <button onClick={() => setIsCartOpen(true)} className="w-full bg-orange-500 text-white h-12 sm:h-14 rounded-xl flex items-center justify-between px-6 font-bold shadow-lg hover:bg-orange-600 transition-colors">
               <div className="flex items-center gap-3"><ShoppingCart size={20} /><span className="text-sm sm:text-base">Meu Pedido ({cartItemCount})</span></div>
               <span className="text-base sm:text-lg">R$ {cartTotal.toFixed(2)}</span>
             </button>
           </div>
         </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 sm:p-6 border-b flex items-center justify-between">
               <h2 className="text-lg sm:text-xl font-bold text-gray-900">{checkoutStep === 0 ? 'Meu Pedido' : 'Finalizar'}</h2>
               <button onClick={() => setIsCartOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
               {cart.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-gray-300">
                   <ShoppingCart size={48} className="mb-4 opacity-10" />
                   <p className="text-sm font-medium">O carrinho está vazio</p>
                 </div>
               ) : (
                 <>
                   {checkoutStep === 0 ? (
                     <div className="divide-y divide-gray-100">
                        {cart.map(item => (
                          <div key={item.product.id} className="py-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-gray-900 truncate">{item.product.name}</p>
                                <p className="text-xs text-gray-500">R$ {item.product.price.toFixed(2)} cada</p>
                              </div>
                              <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                            </div>
                            
                            {/* Observações */}
                            <div className="relative group">
                              <MessageSquare size={12} className="absolute left-3 top-3 text-gray-300 group-focus-within:text-orange-400" />
                              <input 
                                className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-transparent rounded-lg text-[11px] outline-none focus:bg-white focus:border-orange-200 transition-all placeholder:text-gray-300"
                                placeholder="Alguma observação para este item?"
                                value={item.observations || ''}
                                onChange={(e) => updateItemObservation(item.product.id, e.target.value)}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 bg-gray-100 rounded-lg px-2 py-1">
                                    <button onClick={() => updateCartQuantity(item.product.id, -1)} className="p-1 hover:bg-white rounded transition-colors"><Minus size={14} /></button>
                                    <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                    <button onClick={() => updateCartQuantity(item.product.id, 1)} className="p-1 hover:bg-white rounded transition-colors"><Plus size={14} /></button>
                                </div>
                                <p className="text-sm font-bold text-gray-900">R$ {(item.quantity * item.product.price).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                     </div>
                   ) : (
                     <div className="space-y-6 animate-in slide-in-from-bottom-4">
                        <div className="space-y-4">
                          <label className="block">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Seu Nome</span>
                            <input className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 text-sm" placeholder="Ex: Maria Silva" value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Endereço de Entrega</span>
                            <textarea className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 text-sm h-24 resize-none" placeholder="Rua, número, bairro..." value={customerInfo.address} onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})} />
                          </label>
                          
                          <div className="space-y-2">
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Pagamento</span>
                             <div className="grid grid-cols-3 gap-2">
                                {[
                                  {id: 'Pix', icon: <Smartphone size={16}/>},
                                  {id: 'Cartão', icon: <CreditCard size={16}/>},
                                  {id: 'Dinheiro', icon: <Banknote size={16}/>}
                                ].map(p => (
                                  <button 
                                    key={p.id} 
                                    onClick={() => setCustomerInfo({...customerInfo, paymentMethod: p.id as any})}
                                    className={`flex flex-col items-center justify-center gap-1 py-3 border rounded-xl transition-all ${customerInfo.paymentMethod === p.id ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-gray-500 border-gray-200'}`}
                                  >
                                    {p.icon}
                                    <span className="text-[10px] font-bold">{p.id}</span>
                                  </button>
                                ))}
                             </div>
                          </div>
                        </div>
                     </div>
                   )}
                 </>
               )}
            </div>

            {cart.length > 0 && (
              <div className="p-5 sm:p-6 border-t bg-gray-50">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-gray-500 font-medium text-sm">Valor total</span>
                  <span className="text-xl sm:text-2xl font-black text-gray-900">R$ {cartTotal.toFixed(2)}</span>
                </div>
                {checkoutStep === 1 && (
                    <button onClick={() => setCheckoutStep(0)} className="w-full mb-4 py-2 text-[10px] font-bold text-gray-400 flex items-center justify-center gap-1 uppercase tracking-widest hover:text-orange-500 transition-colors">
                        <ArrowLeft size={12}/> Revisar itens do pedido
                    </button>
                )}
                <button 
                  onClick={checkoutStep === 0 ? () => setCheckoutStep(1) : handleCheckout}
                  disabled={checkoutStep === 1 && (!customerInfo.name || !customerInfo.address)}
                  className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-100 disabled:opacity-50 active:scale-95 transition-all"
                >
                  {checkoutStep === 0 ? 'Revisar e Finalizar' : 'Confirmar no WhatsApp'} <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const AdminDashboard: React.FC<{ products: Product[], settings: BusinessSettings, isAdmin: boolean }> = ({ products, settings, isAdmin }) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'categories' | 'settings'>('menu');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [tempSettings, setTempSettings] = useState<BusinessSettings>(settings);
  const [newCat, setNewCat] = useState('');
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isLogo: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      if (isLogo) setTempSettings({...tempSettings, photoUrl: base64});
      else if (editingProduct) setEditingProduct({...editingProduct, image: base64});
    }
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    setSaving(true);
    const final: Product = {
      id: editingProduct.id || Math.random().toString(36).substr(2, 9),
      name: editingProduct.name || 'Sem nome',
      description: editingProduct.description || '',
      price: editingProduct.price || 0,
      category: editingProduct.category || tempSettings.categories[0],
      image: editingProduct.image || 'https://via.placeholder.com/400',
      available: true
    };
    await saveProductToDb(final);
    setSaving(false);
    setEditingProduct(null);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    await saveSettings(tempSettings);
    setSaving(false);
    alert("Dados salvos com sucesso!");
  };

  const addCategory = () => {
    if (newCat && !tempSettings.categories.includes(newCat)) {
      setTempSettings({...tempSettings, categories: [...tempSettings.categories, newCat]});
      setNewCat('');
    }
  };

  const removeCategory = (cat: string) => {
    if (confirm(`Excluir a categoria "${cat}"? Isso não apagará os produtos, mas você terá que reatribuí-los.`)) {
      setTempSettings({...tempSettings, categories: tempSettings.categories.filter(c => c !== cat)});
    }
  };

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
        <ShieldAlert size={40} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Restrito</h2>
      <p className="text-gray-500 max-w-xs text-sm">Somente administradores autorizados podem acessar o painel de gerenciamento.</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex bg-gray-200/50 p-1 rounded-xl overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('menu')}
          className={`flex-1 min-w-[100px] py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${activeTab === 'menu' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          <Utensils size={18} /> Cardápio
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`flex-1 min-w-[100px] py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${activeTab === 'categories' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          <Tags size={18} /> Categorias
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-[100px] py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${activeTab === 'settings' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
        >
          <SettingsIcon size={18} /> Loja
        </button>
      </div>

      {activeTab === 'menu' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">Itens Ativos</h2>
            <button onClick={() => setEditingProduct({})} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md hover:bg-orange-600 transition-colors">+ Novo Produto</button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {products.map(p => (
              <div key={p.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 truncate">
                  <img src={p.image} className="w-12 h-12 rounded-lg object-cover bg-gray-50 flex-shrink-0" />
                  <div className="truncate">
                    <p className="font-bold text-sm truncate">{p.name}</p>
                    <p className="text-[10px] text-orange-600 font-medium">{p.category} • R$ {p.price.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingProduct(p)} className="p-2 text-gray-400 hover:text-orange-500 transition-colors"><Edit2 size={18} /></button>
                  <button onClick={() => { if(confirm("Remover este item?")) deleteProductFromDb(p.id)}} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold">Categorias Disponíveis</h2>
          <div className="flex gap-2">
            <input 
              className="flex-1 p-3 bg-white border border-gray-200 rounded-xl outline-none text-sm focus:border-orange-500" 
              placeholder="Ex: Novos Pratos" 
              value={newCat} 
              onChange={e => setNewCat(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && addCategory()}
            />
            <button onClick={addCategory} className="bg-gray-900 text-white px-5 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all">Adicionar</button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {tempSettings.categories.map(c => (
              <div key={c} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                <span className="text-sm font-bold text-gray-700">{c}</span>
                <button onClick={() => removeCategory(c)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
          <button onClick={handleSaveSettings} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg mt-4">Salvar Categorias</button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
             <div className="flex items-center gap-3">
               <div className={`p-2.5 rounded-full ${!tempSettings.manualClosed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                 <Power size={20} />
               </div>
               <div>
                 <p className="font-bold text-sm">Funcionamento</p>
                 <p className="text-[10px] text-gray-500">Forçar fechamento para pausar pedidos.</p>
               </div>
             </div>
             <button onClick={() => setTempSettings({...tempSettings, manualClosed: !tempSettings.manualClosed})} className={`w-full py-3 rounded-xl font-bold text-xs border transition-all ${tempSettings.manualClosed ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
               {tempSettings.manualClosed ? "REABRIR LOJA AGORA" : "PAUSAR RECEBIMENTO DE PEDIDOS"}
             </button>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={14}/> Logotipo e Nome</h3>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative group">
                        <img src={tempSettings.photoUrl || 'https://via.placeholder.com/150'} className="w-24 h-24 rounded-2xl object-cover border-4 border-gray-50 shadow-inner" />
                        <button onClick={() => logoInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-orange-500 text-white p-2 rounded-lg shadow-lg hover:scale-110 transition-transform"><Upload size={14} /></button>
                        <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} />
                    </div>
                    <div className="w-full space-y-3">
                      <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500" placeholder="Nome do Restaurante" value={tempSettings.name} onChange={e => setTempSettings({...tempSettings, name: e.target.value})} />
                    </div>
                </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={14}/> Horário Semanal</h3>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y shadow-sm">
              {WEEK_DAYS.map((day, idx) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-5 h-5 rounded accent-orange-500" checked={tempSettings.hours[idx]?.enabled} onChange={e => setTempSettings({...tempSettings, hours: { ...tempSettings.hours, [idx]: { ...tempSettings.hours[idx], enabled: e.target.checked } }})} />
                    <span className={`text-sm font-bold ${tempSettings.hours[idx]?.enabled ? 'text-gray-900' : 'text-gray-300'}`}>{day}</span>
                  </div>
                  {tempSettings.hours[idx]?.enabled && (
                    <div className="flex items-center gap-2 justify-end">
                      <input type="time" className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none" value={tempSettings.hours[idx].open} onChange={e => setTempSettings({...tempSettings, hours: { ...tempSettings.hours, [idx]: { ...tempSettings.hours[idx], open: e.target.value } }})} />
                      <span className="text-gray-300 text-[10px] font-bold">ÀS</span>
                      <input type="time" className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none" value={tempSettings.hours[idx].close} onChange={e => setTempSettings({...tempSettings, hours: { ...tempSettings.hours, [idx]: { ...tempSettings.hours[idx], close: e.target.value } }})} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleSaveSettings} disabled={saving} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            {saving ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
            Finalizar Configurações
          </button>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6 max-h-[95vh] overflow-y-auto animate-in zoom-in-95">
             <div className="flex justify-between items-center">
               <h3 className="font-bold text-xl text-gray-900">{editingProduct.id ? 'Editar Produto' : 'Cadastrar Produto'}</h3>
               <button onClick={() => setEditingProduct(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={24}/></button>
             </div>
             
             <div className="flex flex-col items-center gap-2">
                <div className="relative w-full h-36 bg-gray-50 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 flex items-center justify-center group">
                  {editingProduct.image ? <img src={editingProduct.image} className="w-full h-full object-cover" /> : <ImageIcon size={32} className="text-gray-200"/>}
                  <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center text-transparent group-hover:text-white"><Upload size={24}/></button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e)} />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Toque para alterar a imagem</p>
             </div>

             <div className="space-y-4">
               <label className="block">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Nome do Prato</span>
                 <input className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500" placeholder="Ex: Marmitex Premium G" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
               </label>
               <div className="grid grid-cols-2 gap-4">
                 <label className="block">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Preço (R$)</span>
                   <input className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500" type="number" step="0.01" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} />
                 </label>
                 <label className="block">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Categoria</span>
                   <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500" value={editingProduct.category || tempSettings.categories[0]} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}>
                     {tempSettings.categories.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                 </label>
               </div>
               <label className="block">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Descrição / Acompanhamentos</span>
                 <textarea className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500 h-24 resize-none" placeholder="O que vem nesta marmita?" value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
               </label>
             </div>

             <div className="flex gap-3">
                <button onClick={() => setEditingProduct(null)} className="flex-1 py-4 font-bold text-gray-400 text-sm hover:text-gray-600">Cancelar</button>
                <button onClick={handleSaveProduct} disabled={saving} className="flex-[2] py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-100 flex items-center justify-center gap-2 active:scale-95 transition-all">
                  {saving && <RefreshCw className="animate-spin" size={16} />}
                  Salvar no Cardápio
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
