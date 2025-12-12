import { Product, Employee } from './types';

export const CATEGORIES = ['Fruit', 'Vegetable', 'Tuber'] as const;

// Helper to generate dummy produce data
const generateProducts = (): Product[] => {
  const products: Product[] = [];
  const fruits = ['Apple', 'Banana', 'Orange', 'Mango', 'Pineapple', 'Strawberry', 'Grape', 'Watermelon', 'Papaya', 'Kiwi', 'Peach', 'Pear', 'Plum', 'Cherry', 'Blueberry', 'Raspberry', 'Blackberry', 'Lemon', 'Lime', 'Avocado', 'Pomegranate', 'Coconut', 'Fig', 'Guava', 'Lychee', 'Dragonfruit', 'Passion Fruit', 'Durian', 'Jackfruit', 'Starfruit'];
  const veggies = ['Carrot', 'Broccoli', 'Spinach', 'Lettuce', 'Tomato', 'Cucumber', 'Bell Pepper', 'Onion', 'Garlic', 'Cauliflower', 'Zucchini', 'Eggplant', 'Cabbage', 'Kale', 'Celery', 'Asparagus', 'Green Bean', 'Pea', 'Corn', 'Mushroom', 'Radish', 'Beet', 'Artichoke', 'Okra', 'Brussels Sprout', 'Pumpkin', 'Squash', 'Arugula', 'Bok Choy', 'Chard'];
  const tubers = ['Potato', 'Sweet Potato', 'Yam', 'Cassava', 'Taro', 'Ginger', 'Turmeric', 'Jicama', 'Rutabaga', 'Turnip', 'Parsnip', 'Lotus Root', 'Jerusalem Artichoke', 'Yuca', 'Malanga', 'Arrowroot', 'Water Chestnut', 'Galangal', 'Wasabi', 'Sunchoke'];

  let idCounter = 1;

  fruits.forEach(name => {
    products.push({
      id: `p-${idCounter++}`,
      name,
      category: 'Fruit',
      price: parseFloat((Math.random() * 5 + 1).toFixed(2)),
      image: `https://picsum.photos/seed/${name}/300/300`,
      description: `Fresh and delicious ${name} directly from the market.`
    });
  });

  veggies.forEach(name => {
    products.push({
      id: `p-${idCounter++}`,
      name,
      category: 'Vegetable',
      price: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      image: `https://picsum.photos/seed/${name}/300/300`,
      description: `Organic ${name}, perfect for salads and cooking.`
    });
  });

  tubers.forEach(name => {
    products.push({
      id: `p-${idCounter++}`,
      name,
      category: 'Tuber',
      price: parseFloat((Math.random() * 4 + 0.8).toFixed(2)),
      image: `https://picsum.photos/seed/${name}/300/300`,
      description: `High quality ${name}, great source of carbohydrates.`
    });
  });

  // Fill up to 100+ if needed by duplicating or variations
  while(products.length < 105) {
     const base = products[Math.floor(Math.random() * products.length)];
     products.push({
        ...base,
        id: `p-${idCounter++}`,
        name: `${base.name} (Bulk)`,
        price: parseFloat((base.price * 5).toFixed(2)),
        description: `Bulk pack of ${base.name}.`
     });
  }

  return products;
};

export const INITIAL_PRODUCTS: Product[] = generateProducts();

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'e-1', name: 'John Doe', role: 'Manager', email: 'john@pollostore.com' },
  { id: 'e-2', name: 'Jane Smith', role: 'Driver', email: 'jane@pollostore.com' },
];
