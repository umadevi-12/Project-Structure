
const Product = require('./src/models/Product');
const productStorage = require('./src/services/ProductStorage');

console.log('🚀 Starting data seed...');

const sampleProducts = [
  {
    title: "Samsung Galaxy S23 Ultra",
    description: "Premium smartphone with 200MP camera",
    price: 124999,
    mrp: 134999,
    rating: 4.7,
    stock: 25,
    category: "mobile",
    brand: "samsung",
    popularity: 1500,
    metadata: {
      ram: "12GB",
      storage: "256GB",
      color: "black",
      screen_size: "6.8 inches",
      battery: "5000mAh"
    }
  },
  {
    title: "iPhone 15 Pro Max",
    description: "Apple flagship with titanium design",
    price: 159900,
    mrp: 159900,
    rating: 4.8,
    stock: 15,
    category: "mobile",
    brand: "apple",
    popularity: 2000,
    metadata: {
      ram: "8GB",
      storage: "256GB",
      color: "natural titanium",
      screen_size: "6.7 inches"
    }
  },
  {
    title: "Redmi Note 12 Pro",
    description: "Mid-range smartphone with 120Hz display",
    price: 27999,
    mrp: 29999,
    rating: 4.4,
    stock: 75,
    category: "mobile",
    brand: "redmi",
    popularity: 1200,
    metadata: {
      ram: "8GB",
      storage: "128GB",
      color: "blue",
      screen_size: "6.67 inches"
    }
  }
];

// Clear any existing data (optional)
// productStorage.products.clear();

// Add products
let count = 0;
sampleProducts.forEach(productData => {
  try {
    const product = new Product(productData);
    productStorage.addProduct(product);
    count++;
    console.log(`✅ ${count}. ${product.title} - ₹${product.price}`);
  } catch (error) {
    console.log(`❌ Error adding product: ${error.message}`);
  }
});

console.log('\n========================================');
console.log(`🎉 SEEDING COMPLETE!`);
console.log(`Added ${count} products`);
console.log(`Total in memory: ${productStorage.getAllProducts().length}`);
console.log('========================================\n');

// Test search
console.log('Testing search...');
const testResults = productStorage.searchProducts('samsung');
console.log(`Found ${testResults.length} Samsung products`);