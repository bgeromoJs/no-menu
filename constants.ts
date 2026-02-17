
import { Product, BusinessSettings } from './types';

export const ADMIN_PHONE = process.env.ADMIN_PHONE || '5511999999999'; 

export const DEFAULT_SETTINGS: BusinessSettings = {
  name: "Vera Marmitex",
  photoUrl: "",
  whatsappPhone: ADMIN_PHONE,
  manualClosed: false,
  categories: [
    'Marmitas do Dia',
    'Batatas Recheadas',
    'Bebidas',
    'Sobremesas'
  ],
  hours: {
    0: { enabled: false, open: "10:00", close: "15:00" }, // Domingo
    1: { enabled: true, open: "10:00", close: "22:00" },  // Segunda
    2: { enabled: true, open: "10:00", close: "22:00" },
    3: { enabled: true, open: "10:00", close: "22:00" },
    4: { enabled: true, open: "10:00", close: "22:00" },
    5: { enabled: true, open: "10:00", close: "22:00" },
    6: { enabled: true, open: "10:00", close: "22:00" },  // Sábado
  }
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'm-1',
    name: 'Strogonoff de Frango',
    description: 'Marmitex com strogonoff de frango cremoso, arroz branco soltinho e batata palha crocante.',
    price: 24.90,
    category: 'Marmitas do Dia',
    image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?q=80&w=800&auto=format&fit=crop',
    available: true
  },
  {
    id: '1',
    name: 'Batata Strogonoff de Carne',
    description: 'Batata grande assada com recheio cremoso de strogonoff de carne, batata palha e queijo mussarela derretido.',
    price: 32.90,
    category: 'Batatas Recheadas',
    image: 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?q=80&w=800&auto=format&fit=crop',
    available: true
  }
];

export const WEEK_DAYS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"
];
