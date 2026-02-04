const { v4: uuidv4 } = require('uuid');

class Product {
  constructor(data) {
    this.id = data.id || uuidv4();
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
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.popularity = parseInt(data.popularity) || 0;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  updateMetadata(newMetadata) {
    this.metadata = { ...this.metadata, ...newMetadata };
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      price: this.price,
      mrp: this.mrp,
      currency: this.currency,
      rating: this.rating,
      stock: this.stock,
      category: this.category,
      brand: this.brand,
      metadata: this.metadata,
      popularity: this.popularity,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Product;