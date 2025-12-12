export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'Fruit' | 'Vegetable' | 'Tuber' | 'Custom';
  image: string;
  description: string;
  isCustom?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  items: CartItem[];
  total: number;
  status: 'Pending' | 'Pricing Updated' | 'Confirmed' | 'Shipped';
  date: string;
  paymentMethod: string;
  paymentLink?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface User {
  username: string;
  isAdmin: boolean;
}