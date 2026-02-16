
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
}

export interface OperatingHour {
  enabled: boolean;
  open: string;
  close: string;
}

export interface BusinessSettings {
  name: string;
  photoUrl: string;
  manualClosed: boolean;
  categories: string[];
  hours: {
    [key: number]: OperatingHour; // 0 = Domingo, 1 = Segunda, etc.
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  isAdmin: boolean;
  name: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  observations?: string;
}

export enum ViewMode {
  CUSTOMER = 'customer',
  ADMIN = 'admin'
}
