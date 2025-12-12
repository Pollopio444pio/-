import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, Employee, Order } from '../types';
import { generateProductDescription } from '../services/geminiService';
import { LogOut, Package, Users, ShoppingCart, Plus, Edit, Trash2, Wand2, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { CATEGORIES } from '../constants';

const AdminDashboard = () => {
  const { 
    user, logout, products, orders, employees,
    addProduct, updateProduct, deleteProduct,
    addEmployee, removeEmployee, updateOrder
  } = useStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'employees'>('orders');

  // Product Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState<Partial<Product>>({ category: 'Fruit', price: 0 });
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Employee Form State
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('Staff');

  const handleLogout = () => {
    logout();
    window.location.href = '#/';
  };

  // --- Product Logic ---
  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProdForm(product);
    } else {
      setEditingProduct(null);
      setProdForm({ category: 'Fruit', price: 0, name: '', description: '', image: '' });
    }
    setShowProductModal(true);
  };

  const handleGenerateDescription = async () => {
    if (!prodForm.name || !prodForm.category) {
      alert("Please enter a name and category first.");
      return;
    }
    setIsGeneratingAI(true);
    const desc = await generateProductDescription(prodForm.name, prodForm.category);
    setProdForm(prev => ({ ...prev, description: desc }));
    setIsGeneratingAI(false);
  };

  const saveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct({ ...editingProduct, ...prodForm } as Product);
    } else {
      addProduct({ 
        ...prodForm, 
        id: `p-${Date.now()}`,
        image: prodForm.image || `https://picsum.photos/seed/${prodForm.name}/300/300`
      } as Product);
    }
    setShowProductModal(false);
  };

  // --- Order Logic ---
  const handleGeneratePaymentLink = (orderId: string) => {
    const link = `https://pollostore.com/pay/${orderId}`;
    alert(`Payment link generated and copied to clipboard: ${link}`);
    // Simulate updating order with link
    const order = orders.find(o => o.id === orderId);
    if(order) updateOrder({...order, paymentLink: link});
  };

  const handleUpdateOrderPrice = (order: Order, itemId: string, newPrice: number) => {
    const updatedItems = order.items.map(item => 
      item.id === itemId ? { ...item, price: newPrice } : item
    );
    const newTotal = updatedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    // If all items have price > 0, allow confirming
    const allPriced = updatedItems.every(i => i.price > 0);
    const newStatus = allPriced ? 'Pricing Updated' : 'Pending';

    updateOrder({
        ...order,
        items: updatedItems,
        total: newTotal,
        status: newStatus
    });
  };

  // --- Employee Logic ---
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    addEmployee({
      id: `e-${Date.now()}`,
      name: newEmpName,
      email: newEmpEmail,
      role: newEmpRole
    });
    setNewEmpName('');
    setNewEmpEmail('');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-lg shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Admin Panel</h1>
            <p className="text-gray-500">Welcome back, {user?.username}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-600 hover:text-red-800 font-medium">
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-300 pb-2">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition ${activeTab === 'orders' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <ShoppingCart className="w-5 h-5" /> Manage Orders
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition ${activeTab === 'products' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <Package className="w-5 h-5" /> Manage Products
          </button>
          <button 
            onClick={() => setActiveTab('employees')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition ${activeTab === 'employees' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <Users className="w-5 h-5" /> Employees
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6 min-h-[500px]">
          
          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
               <h2 className="text-xl font-bold mb-4">Recent Orders</h2>
               {orders.length === 0 ? <p className="text-gray-500">No orders yet.</p> : (
                 <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="border-b bg-gray-50">
                         <th className="p-4 font-semibold text-gray-600">ID</th>
                         <th className="p-4 font-semibold text-gray-600">Customer</th>
                         <th className="p-4 font-semibold text-gray-600">Total</th>
                         <th className="p-4 font-semibold text-gray-600">Status</th>
                         <th className="p-4 font-semibold text-gray-600">Items (Check Prices)</th>
                         <th className="p-4 font-semibold text-gray-600">Actions</th>
                       </tr>
                     </thead>
                     <tbody>
                       {orders.map(order => (
                         <tr key={order.id} className="border-b hover:bg-gray-50">
                           <td className="p-4 text-sm font-mono text-gray-500">{order.id}</td>
                           <td className="p-4">
                             <div className="font-medium">{order.customerName}</div>
                             <div className="text-xs text-gray-400">{order.customerEmail}</div>
                           </td>
                           <td className="p-4 font-bold text-emerald-600">${order.total.toFixed(2)}</td>
                           <td className="p-4">
                             <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                               order.status === 'Confirmed' ? 'bg-green-100 text-green-800' : 
                               order.status === 'Pending' ? 'bg-orange-100 text-orange-800' :
                               'bg-blue-100 text-blue-800'
                             }`}>
                               {order.status}
                             </span>
                           </td>
                           <td className="p-4 min-w-[300px]">
                              <ul className="text-sm space-y-2">
                                {order.items.map(item => (
                                  <li key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                    <span>{item.name} (x{item.quantity})</span>
                                    {item.isCustom && item.price === 0 ? (
                                      <input 
                                        type="number" 
                                        placeholder="Set Price"
                                        className="w-20 border rounded px-1 py-0.5 text-right"
                                        onBlur={(e) => handleUpdateOrderPrice(order, item.id, parseFloat(e.target.value))}
                                      />
                                    ) : (
                                      <span className="text-gray-600">${item.price}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                           </td>
                           <td className="p-4">
                             <div className="flex flex-col gap-2">
                               <button 
                                 onClick={() => handleGeneratePaymentLink(order.id)}
                                 className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200"
                               >
                                 <LinkIcon className="w-3 h-3" /> Pay Link
                               </button>
                               {order.status === 'Pending' && order.items.every(i => i.price > 0) && (
                                   <button 
                                   onClick={() => updateOrder({...order, status: 'Confirmed'})}
                                   className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                 >
                                   <CheckCircle className="w-3 h-3" /> Confirm
                                 </button>
                               )}
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>
          )}

          {/* PRODUCTS TAB */}
          {activeTab === 'products' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Product Inventory ({products.length})</h2>
                <button 
                  onClick={() => openProductModal()}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700"
                >
                  <Plus className="w-5 h-5" /> Add New Product
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map(product => (
                  <div key={product.id} className="border border-gray-200 rounded-lg p-4 flex flex-col relative group bg-white">
                    <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-md mb-3 bg-gray-100" />
                    <h3 className="font-bold text-gray-800">{product.name}</h3>
                    <p className="text-xs text-emerald-600 font-bold mb-1">{product.category}</p>
                    <p className="text-gray-500 text-xs mb-3 line-clamp-2 h-8">{product.description}</p>
                    <div className="mt-auto flex justify-between items-center">
                      <span className="font-bold">${product.price.toFixed(2)}</span>
                      <div className="flex gap-2">
                        <button onClick={() => openProductModal(product)} className="text-blue-500 hover:bg-blue-50 p-1 rounded">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteProduct(product.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMPLOYEES TAB */}
          {activeTab === 'employees' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Staff Management</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Add Form */}
                <div className="md:col-span-1 bg-gray-50 p-4 rounded-lg h-fit">
                  <h3 className="font-bold mb-4 text-gray-700">Add New Employee</h3>
                  <form onSubmit={handleAddEmployee} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Name</label>
                      <input required type="text" className="w-full border rounded p-2 text-sm" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Email</label>
                      <input required type="email" className="w-full border rounded p-2 text-sm" value={newEmpEmail} onChange={e => setNewEmpEmail(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                      <select className="w-full border rounded p-2 text-sm" value={newEmpRole} onChange={e => setNewEmpRole(e.target.value)}>
                        <option>Manager</option>
                        <option>Driver</option>
                        <option>Staff</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded font-bold hover:bg-emerald-700">Add Employee</button>
                  </form>
                </div>

                {/* List */}
                <div className="md:col-span-2 space-y-4">
                  {employees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm bg-white">
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                           {emp.name.charAt(0)}
                         </div>
                         <div>
                           <h4 className="font-bold text-gray-800">{emp.name}</h4>
                           <p className="text-sm text-gray-500">{emp.email} • {emp.role}</p>
                         </div>
                       </div>
                       <button onClick={() => removeEmployee(emp.id)} className="text-red-400 hover:text-red-600">
                         <Trash2 className="w-5 h-5" />
                       </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
             <button 
              onClick={() => setShowProductModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold mb-4">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
            <form onSubmit={saveProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                  <input required type="text" className="w-full border rounded p-2" value={prodForm.name || ''} onChange={e => setProdForm({...prodForm, name: e.target.value})} />
                </div>
                 <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                  <select className="w-full border rounded p-2" value={prodForm.category} onChange={e => setProdForm({...prodForm, category: e.target.value as any})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Price ($)</label>
                <input required type="number" step="0.01" className="w-full border rounded p-2" value={prodForm.price} onChange={e => setProdForm({...prodForm, price: parseFloat(e.target.value)})} />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Image URL</label>
                <input type="text" className="w-full border rounded p-2" placeholder="https://..." value={prodForm.image || ''} onChange={e => setProdForm({...prodForm, image: e.target.value})} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase">Description</label>
                  <button 
                    type="button" 
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingAI}
                    className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-purple-200"
                  >
                    <Wand2 className="w-3 h-3" /> {isGeneratingAI ? 'Generating...' : 'Generate with AI'}
                  </button>
                </div>
                <textarea 
                  rows={3} 
                  className="w-full border rounded p-2" 
                  value={prodForm.description || ''} 
                  onChange={e => setProdForm({...prodForm, description: e.target.value})}
                ></textarea>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded font-bold hover:bg-emerald-700">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
