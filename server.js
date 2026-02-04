const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// In-memory storage
const products = [];
let idCounter = 1;

// Product class
class Product {
  constructor(data) {
    this.id = data.id || idCounter++;
    this.title = data.title;
    this.description = data.description || '';
    this.price = parseFloat(data.price);
    this.mrp = parseFloat(data.mrp) || parseFloat(data.price);
    this.currency = data.currency || 'INR';
    this.rating = Math.min(Math.max(parseFloat(data.rating) || 0, 0), 5);
    this.stock = parseInt(data.stock) || 0;
    this.category = data.category || 'electronics';
    this.brand = data.brand || '';
    this.metadata = data.metadata || {};
    this.createdAt = new Date().toISOString();
    this.popularity = parseInt(data.popularity) || 0;
  }
}

// Ranking service
class SearchRankingService {
  constructor() {
    this.commonMisspellings = {
      'ifone': 'iphone',
      'samsang': 'samsung',
      'redme': 'redmi',
      'realmi': 'realme'
    };
  }

  rankProducts(query, products) {
    const normalizedQuery = this.normalizeQuery(query);
    const intent = this.detectIntent(normalizedQuery);
    
    const scored = products.map(product => {
      const score = this.calculateScore(product, normalizedQuery, intent);
      return { product, score };
    });
    
    return scored
      .sort((a, b) => b.score - a.score)
      .map(item => item.product);
  }

  normalizeQuery(query) {
    let normalized = query.toLowerCase();
    Object.keys(this.commonMisspellings).forEach(key => {
      if (normalized.includes(key)) {
        normalized = normalized.replace(key, this.commonMisspellings[key]);
      }
    });
    return normalized;
  }

  detectIntent(query) {
    return {
      cheap: query.includes('sasta') || query.includes('cheap') || query.includes('budget'),
      priceRange: this.extractPriceRange(query)
    };
  }

  extractPriceRange(query) {
    const match = query.match(/(\d+)\s*(k|thousand)/i);
    if (match) {
      const price = parseInt(match[1]) * 1000;
      return { min: price * 0.8, max: price * 1.2 };
    }
    return null;
  }

  calculateScore(product, query, intent) {
    let score = 0;
    
    // Relevance (40%)
    const text = `${product.title} ${product.description} ${product.brand}`.toLowerCase();
    if (text.includes(query)) score += 0.4;
    
    // Rating (20%)
    score += (product.rating / 5) * 0.2;
    
    // Price (15%) - lower is better for budget searches
    let priceScore = Math.max(0, 1 - (product.price / 200000));
    if (intent.cheap) priceScore *= 1.5;
    score += priceScore * 0.15;
    
    // Stock (15%)
    if (product.stock > 0) score += 0.15;
    
    // Popularity (10%)
    score += Math.min((product.popularity || 0) / 1000, 0.1);
    
    return score;
  }
}

const rankingService = new SearchRankingService();

// Seed data
const seedData = () => {
  const samples = [
    { title: "Samsung Galaxy S23 Ultra", price: 124999, rating: 4.7, stock: 25, brand: "samsung", category: "mobile", popularity: 1500 },
    { title: "iPhone 15 Pro Max", price: 159900, rating: 4.8, stock: 15, brand: "apple", category: "mobile", popularity: 2000 },
    { title: "OnePlus Nord CE 3 Lite", price: 19999, rating: 4.3, stock: 100, brand: "oneplus", category: "mobile", popularity: 800 },
    { title: "Redmi Note 12 Pro", price: 27999, rating: 4.4, stock: 75, brand: "redmi", category: "mobile", popularity: 1200 },
    { title: "Samsung 25W Fast Charger", price: 1299, rating: 4.1, stock: 200, brand: "samsung", category: "charger", popularity: 400 },
    { title: "Apple 20W USB-C Charger", price: 1900, rating: 4.5, stock: 150, brand: "apple", category: "charger", popularity: 500 },
    { title: "iPhone 14", price: 69999, rating: 4.6, stock: 0, brand: "apple", category: "mobile", popularity: 1800 }
  ];
  
  samples.forEach(data => {
    const product = new Product(data);
    products.push(product);
  });
};

seedData();

// ========== API ENDPOINTS ==========

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    products: products.length,
    timestamp: new Date().toISOString()
  });
});

// Create product
app.post('/api/v1/product', (req, res) => {
  try {
    if (!req.body.title || !req.body.price) {
      return res.status(400).json({
        success: false,
        message: 'Title and price are required'
      });
    }
    
    const product = new Product(req.body);
    products.push(product);
    
    res.status(201).json({
      success: true,
      productId: product.id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Search products
app.get('/api/v1/search/product', (req, res) => {
  try {
    const startTime = Date.now();
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    // Basic filtering
    let filtered = products;
    if (req.query.category) {
      filtered = filtered.filter(p => p.category.toLowerCase().includes(req.query.category.toLowerCase()));
    }
    if (req.query.brand) {
      filtered = filtered.filter(p => p.brand.toLowerCase().includes(req.query.brand.toLowerCase()));
    }
    if (req.query.minPrice) {
      filtered = filtered.filter(p => p.price >= parseFloat(req.query.minPrice));
    }
    if (req.query.maxPrice) {
      filtered = filtered.filter(p => p.price <= parseFloat(req.query.maxPrice));
    }
    if (req.query.inStock === 'true') {
      filtered = filtered.filter(p => p.stock > 0);
    }
    
    // Rank products
    const ranked = rankingService.rankProducts(query, filtered);
    const responseTime = Date.now() - startTime;
    
    // Format response
    const responseData = ranked.slice(0, 20).map(product => ({
      productId: product.id,
      title: product.title,
      description: product.description,
      mrp: product.mrp,
      sellingprice: product.price,
      currency: product.currency,
      rating: product.rating,
      stock: product.stock,
      metadata: product.metadata
    }));
    
    console.log(`🔍 Search: "${query}" - ${responseTime}ms`);
    
    res.json({
      data: responseData,
      query: query,
      resultsCount: responseData.length,
      totalMatches: filtered.length,
      responseTime: `${responseTime}ms`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update metadata
app.put('/api/v1/product/meta-data', (req, res) => {
  try {
    const { productId, metadata } = req.body;
    
    if (!productId || !metadata) {
      return res.status(400).json({
        success: false,
        message: 'productId and metadata are required'
      });
    }
    
    const product = products.find(p => p.id == productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    product.metadata = { ...product.metadata, ...metadata };
    
    res.json({
      success: true,
      productId: product.id,
      metadata: product.metadata
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get product stats
app.get('/api/v1/product/stats', (req, res) => {
  try {
    const stats = {
      totalProducts: products.length,
      inStockCount: products.filter(p => p.stock > 0).length,
      outOfStockCount: products.filter(p => p.stock === 0).length,
      averagePrice: products.reduce((sum, p) => sum + p.price, 0) / products.length,
      averageRating: products.reduce((sum, p) => sum + p.rating, 0) / products.length,
      categories: [...new Set(products.map(p => p.category))],
      brands: [...new Set(products.map(p => p.brand))]
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Total products: ${products.length}`);
  console.log(`🌐 Health: http://localhost:${PORT}/health`);
  console.log(`🔍 Search: http://localhost:${PORT}/api/v1/search/product?query=iphone`);
  console.log(`💰 Budget: http://localhost:${PORT}/api/v1/search/product?query=sasta+mobile`);
  console.log(`📱 Spelling: http://localhost:${PORT}/api/v1/search/product?query=ifone`);
});