class ProductStorage {
  constructor() {
    this.products = new Map();
    this.brandIndex = new Map();
    this.categoryIndex = new Map();
    this.priceIndex = [];
    this.textIndex = new Map(); 
  }

  addProduct(product) {
    this.products.set(product.id, product);
    this._updateIndexes(product);
    return product;
  }

  updateProductMetadata(productId, metadata) {
    const product = this.products.get(productId);
    if (!product) return null;
    
    product.updateMetadata(metadata);
    this._updateIndexes(product);
    return product;
  }

  getProduct(productId) {
    return this.products.get(productId) || null;
  }

  getAllProducts() {
    return Array.from(this.products.values());
  }

  searchProducts(query, filters = {}) {
    let results = this.getAllProducts();
    
    // Apply filters
    if (filters.category) {
      results = results.filter(p => p.category === filters.category);
    }
    if (filters.brand) {
      results = results.filter(p => p.brand === filters.brand);
    }
    if (filters.minPrice !== undefined) {
      results = results.filter(p => p.price >= filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter(p => p.price <= filters.maxPrice);
    }
    if (filters.inStock) {
      results = results.filter(p => p.stock > 0);
    }
    
    return results;
  }

  _updateIndexes(product) {
    // Update brand index
    if (!this.brandIndex.has(product.brand)) {
      this.brandIndex.set(product.brand, new Set());
    }
    this.brandIndex.get(product.brand).add(product.id);
    
    // Update category index
    if (!this.categoryIndex.has(product.category)) {
      this.categoryIndex.set(product.category, new Set());
    }
    this.categoryIndex.get(product.category).add(product.id);
    
    // Update price index (sorted by price)
    this.priceIndex = Array.from(this.products.values())
      .sort((a, b) => a.price - b.price);
    
    // Update text index
    this._updateTextIndex(product);
  }

  _updateTextIndex(product) {
    const terms = this._extractTerms(product);
    terms.forEach(term => {
      if (!this.textIndex.has(term)) {
        this.textIndex.set(term, new Set());
      }
      this.textIndex.get(term).add(product.id);
    });
  }

  _extractTerms(product) {
    const text = `${product.title} ${product.description} ${product.brand} ${Object.values(product.metadata).join(' ')}`;
    return text.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(term => term.length > 2);
  }

  // Get statistics
  getStats() {
    return {
      totalProducts: this.products.size,
      totalBrands: this.brandIndex.size,
      totalCategories: this.categoryIndex.size,
      inStockCount: Array.from(this.products.values()).filter(p => p.stock > 0).length,
      averagePrice: Array.from(this.products.values())
        .reduce((sum, p) => sum + p.price, 0) / this.products.size
    };
  }
}

// Singleton instance
module.exports = new ProductStorage();