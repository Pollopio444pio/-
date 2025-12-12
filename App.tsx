import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import Home from './pages/Home';
import CartCheckout from './pages/CartCheckout';
import AdminDashboard from './pages/AdminDashboard';
import { ShoppingCart, LogIn, Store, Shield } from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { cart, user, logout } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const { login } = useStore(); // Access context inside handler to ensure freshness if needed, though hook is fine
    // We need to use the hook's login function.
    // However, we are outside the provider if we try to use useStore in Layout if Layout is not child of StoreProvider.
    // Wait, App wraps StoreProvider, so Layout is child. It's fine.
  };

  // Re-implementing login call inside component to access state
  const { login: contextLogin } = useStore();

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (contextLogin(username, password)) {
      setShowLogin(false);
      setUsername('');
      setPassword('');
      setLoginError('');
      navigate('/admin');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="sticky top-0 z-50 bg-emerald-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Store className="w-8 h-8" />
            <span>Pollo Store</span>
          </Link>
          
          <div className="flex items-center gap-6">
            <Link to="/" className="hidden md:block hover:text-emerald-200 font-medium">Market</Link>
            <Link to="/cart" className="relative group">
              <ShoppingCart className="w-6 h-6 hover:text-emerald-200 transition" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-emerald-900 text-emerald-100 py-8 text-center">
        <p>© 2024 Pollo Store - Fresh Fruits, Vegetables & Tubers</p>
      </footer>

      {/* Floating Admin Button */}
      {!user && location.pathname !== '/admin' && (
        <button
          onClick={() => setShowLogin(true)}
          className="fixed bottom-4 right-4 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition z-50"
          title="Admin Login"
        >
          <Shield className="w-6 h-6" />
        </button>
      )}

      {/* Admin Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md relative">
            <button 
              onClick={() => setShowLogin(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-600" /> Admin Access
            </h2>
            <form onSubmit={submitLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="password"
                />
              </div>
              {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700 font-semibold transition"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!user || !user.isAdmin) {
      navigate('/');
    }
  }, [user, navigate]);

  return user ? <>{children}</> : null;
};

const App = () => {
  return (
    <StoreProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cart" element={<CartCheckout />} />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Layout>
      </Router>
    </StoreProvider>
  );
};

export default App;
