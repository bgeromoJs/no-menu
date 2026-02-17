
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

export const INITIAL_PRODUCTS: Product[] = [];

export const WEEK_DAYS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"
];
