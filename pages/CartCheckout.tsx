import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CartCheckout = () => {
  const { cart, removeFromCart, placeOrder } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [formData, setFormData] = useState({ name: '', email: '', payment: 'Cash' });

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const hasPendingItems = cart.some(i => i.isCustom && i.price === 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    placeOrder(formData.name, formData.email, formData.payment);
    alert("Order Placed Successfully!");
    navigate('/');
  };

  if (cart.length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
        <button onClick={() => navigate('/')} className="text-emerald-600 font-semibold hover:underline">
          Go back to shopping
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">{step === 'cart' ? 'Shopping Cart' : 'Checkout'}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Items */}
        <div className="md:col-span-2 space-y-4">
          {step === 'cart' ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              {cart.map(item => (
                <div key={item.id} className="flex items-center p-4 border-b last:border-0 hover:bg-gray-50 transition">
                  <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-md" />
                  <div className="ml-4 flex-grow">
                    <h3 className="font-semibold text-gray-800">{item.name}</h3>
                    <p className="text-sm text-gray-500">
                      {item.isCustom ? <span className="text-orange-500 font-bold">Price TBD</span> : `$${item.price.toFixed(2)}`} x {item.quantity}
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="font-bold text-gray-900">
                      {item.isCustom ? '$-.--' : `$${(item.price * item.quantity).toFixed(2)}`}
                    </p>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-400 hover:text-red-600 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <form id="checkout-form" onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input 
                  required
                  type="email" 
                  className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                <select 
                  className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.payment}
                  onChange={e => setFormData({...formData, payment: e.target.value})}
                >
                  <option value="Cash">Cash on Delivery</option>
                  <option value="Card">Credit/Debit Card (Online)</option>
                  <option value="Transfer">Bank Transfer</option>
                </select>
              </div>
              {hasPendingItems && (
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded text-sm text-orange-700">
                  <p className="font-bold">Note:</p>
                  <p>You have custom items in your cart. The final total will be updated by the admin after review. You will receive an updated confirmation email.</p>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Right Column: Summary */}
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 sticky top-24">
            <h3 className="text-xl font-bold mb-4">Order Summary</h3>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">${total.toFixed(2)}</span>
            </div>
            {hasPendingItems && (
               <div className="flex justify-between mb-2 text-orange-600 text-sm">
               <span>+ Custom Items</span>
               <span>TBD</span>
             </div>
            )}
            <div className="border-t my-4 pt-4 flex justify-between">
              <span className="text-lg font-bold">Total</span>
              <span className="text-lg font-bold text-emerald-600">
                ${total.toFixed(2)}{hasPendingItems && '*'}
              </span>
            </div>
            
            {step === 'cart' ? (
              <button 
                onClick={() => setStep('checkout')}
                className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2"
              >
                Proceed to Checkout <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="space-y-3">
                <button 
                  type="submit" 
                  form="checkout-form"
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition"
                >
                  Place Order
                </button>
                <button 
                  onClick={() => setStep('cart')}
                  className="w-full text-gray-500 py-2 hover:text-gray-800 transition"
                >
                  Back to Cart
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartCheckout;
