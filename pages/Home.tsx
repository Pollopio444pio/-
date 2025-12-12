import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, CartItem } from '../types';
import { Plus, Search, Filter } from 'lucide-react';
import { CATEGORIES } from '../constants';

const Home = () => {
  const { products, addToCart } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customNote, setCustomNote] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customProduct: Product = {
      id: `custom-${Date.now()}`,
      name: customItemName,
      price: 0, // Placeholder
      category: 'Custom',
      image: 'https://picsum.photos/seed/custom/300/300',
      description: customNote || 'Custom request pending pricing.',
      isCustom: true
    };
    addToCart(customProduct, customItemQty);
    setShowCustomModal(false);
    setCustomItemName('');
    setCustomItemQty(1);
    setCustomNote('');
    alert("Custom item added to cart! Price will be set by admin after order.");
  };

  return (
    <div>
      {/* Hero / Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Market of Abastos Prices</h1>
        <p className="text-gray-600">Fresh fruits, vegetables, and tubers delivered to your door.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search products..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-emerald-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button 
            onClick={() => setSelectedCategory('All')}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition ${selectedCategory === 'All' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            All Items
          </button>
          {CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition ${selectedCategory === cat ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {cat}s
            </button>
          ))}
        </div>

        <button 
          onClick={() => setShowCustomModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 transition"
        >
          <Plus className="w-5 h-5" /> Request Custom Item
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition duration-300 overflow-hidden border border-gray-100 flex flex-col group">
            <div className="relative h-48 overflow-hidden bg-gray-100">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" loading="lazy" />
              <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-bold text-emerald-800 shadow-sm">
                {product.category}
              </div>
            </div>
            <div className="p-4 flex-grow flex flex-col">
              <h3 className="text-lg font-bold text-gray-800 mb-1">{product.name}</h3>
              <p className="text-emerald-600 font-bold text-xl mb-2">${product.price.toFixed(2)}</p>
              <p className="text-gray-500 text-sm mb-4 flex-grow line-clamp-2">{product.description}</p>
              <button 
                onClick={() => addToCart(product)}
                className="w-full bg-gray-900 text-white py-2 rounded-lg hover:bg-emerald-600 transition flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="w-4 h-4" /> Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          No products found matching your criteria.
        </div>
      )}

      {/* Custom Item Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button 
              onClick={() => setShowCustomModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold mb-4">Request Custom Product</h3>
            <p className="text-sm text-gray-500 mb-4">
              Can't find what you're looking for? Add it here. We'll set the price after you place the order.
            </p>
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Product Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. Rare Mushroom"
                  value={customItemName}
                  onChange={e => setCustomItemName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity / Weight</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={customItemQty}
                  onChange={e => setCustomItemQty(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                <textarea 
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Specific details..."
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded font-bold hover:bg-emerald-700">
                Add Request to Cart
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
