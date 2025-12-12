import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, CartItem, Order, Employee, User } from '../types';
import { INITIAL_PRODUCTS, INITIAL_EMPLOYEES } from '../constants';

interface StoreContextType {
  products: Product[];
  cart: CartItem[];
  orders: Order[];
  employees: Employee[];
  user: User | null;
  login: (u: string, p: string) => boolean;
  logout: () => void;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  placeOrder: (customerName: string, customerEmail: string, paymentMethod: string) => void;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  addEmployee: (employee: Employee) => void;
  removeEmployee: (employeeId: string) => void;
  updateOrder: (order: Order) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load initial state from localStorage or defaults
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  // Persist to localStorage
  useEffect(() => { localStorage.setItem('products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('employees', JSON.stringify(employees)); }, [employees]);
  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  const login = (u: string, p: string) => {
    // Hardcoded for demo
    if (u === 'admin' && p === 'password') {
      setUser({ username: 'admin', isAdmin: true });
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + quantity } : p);
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(p => p.id !== productId));
  };

  const clearCart = () => setCart([]);

  const placeOrder = (customerName: string, customerEmail: string, paymentMethod: string) => {
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      customerName,
      customerEmail,
      items: [...cart],
      total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      status: cart.some(i => i.isCustom && i.price === 0) ? 'Pending' : 'Confirmed',
      date: new Date().toISOString(),
      paymentMethod
    };

    setOrders(prev => [newOrder, ...prev]);
    clearCart();
    
    // Simulate Emails
    setTimeout(() => {
        alert(`📧 EMAIL SENT TO ADMIN:\nNew Order #${newOrder.id} received from ${customerName}.`);
        alert(`📧 EMAIL SENT TO CUSTOMER (${customerEmail}):\nOrder #${newOrder.id} confirmation. Total: $${newOrder.total.toFixed(2)}`);
    }, 500);
  };

  const addProduct = (product: Product) => setProducts(prev => [product, ...prev]);
  const updateProduct = (product: Product) => setProducts(prev => prev.map(p => p.id === product.id ? product : p));
  const deleteProduct = (id: string) => setProducts(prev => prev.filter(p => p.id !== id));

  const addEmployee = (emp: Employee) => setEmployees(prev => [...prev, emp]);
  const removeEmployee = (id: string) => setEmployees(prev => prev.filter(e => e.id !== id));

  const updateOrder = (order: Order) => setOrders(prev => prev.map(o => o.id === order.id ? order : o));

  return (
    <StoreContext.Provider value={{
      products, cart, orders, employees, user,
      login, logout, addToCart, removeFromCart, clearCart, placeOrder,
      addProduct, updateProduct, deleteProduct,
      addEmployee, removeEmployee, updateOrder
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
