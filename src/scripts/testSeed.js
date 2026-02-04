
console.log('Testing Product model...');

try {
  const Product = require('./src/models/Product');
  const productStorage = require('./src/services/ProductStorage');
  
  console.log('✅ Modules loaded successfully');
  
  // Create a test product
  const testProduct = new Product({
    title: "Test Product",
    price: 1000,
    stock: 10
  });
  
  productStorage.addProduct(testProduct);
  
  console.log('✅ Test product added');
  console.log('📦 Total products:', productStorage.getAllProducts().length);
  console.log('🛒 First product:', productStorage.getAllProducts()[0]?.title);
  
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('Stack:', error.stack);
}