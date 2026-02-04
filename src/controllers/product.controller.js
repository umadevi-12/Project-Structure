const Product = require('../models/Product');
const productStorage = require('../services/ProductStorage');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

class ProductController {
  /**
   * Create a new product
   * POST /api/v1/product
   */
  async createProduct(req, res, next) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const productData = req.body;
      
      // Validate required fields
      if (!productData.title || !productData.price) {
        return res.status(400).json({
          success: false,
          message: 'Title and price are required fields'
        });
      }

      // Set default values if not provided
      const processedData = {
        ...productData,
        brand: productData.brand || this._extractBrandFromTitle(productData.title),
        category: productData.category || 'electronics',
        currency: productData.currency || 'INR'
      };

      // Create new product
      const product = new Product(processedData);
      const savedProduct = productStorage.addProduct(product);
      
      logger.info(`Product created - ID: ${savedProduct.id}, Title: ${savedProduct.title}`);

      // Increment popularity for similar products
      this._updateSimilarProductsPopularity(savedProduct);

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: {
          productId: savedProduct.id,
          title: savedProduct.title,
          price: savedProduct.price,
          category: savedProduct.category
        }
      });
    } catch (error) {
      logger.error(`Error creating product: ${error.message}`, { stack: error.stack });
      next(error);
    }
  }

  /**
   * Get product by ID
   * GET /api/v1/product/:id
   */
  async getProductById(req, res, next) {
    try {
      const { id } = req.params;
      
      const product = productStorage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Increment popularity when product is viewed
      if (product.popularity !== undefined) {
        product.popularity = (product.popularity || 0) + 1;
      }

      logger.info(`Product retrieved - ID: ${id}`);

      res.status(200).json({
        success: true,
        data: product.toJSON()
      });
    } catch (error) {
      logger.error(`Error retrieving product ${req.params.id}: ${error.message}`);
      next(error);
    }
  }

  /**
   * Update product metadata
   * PUT /api/v1/product/meta-data
   */
  async updateProductMetadata(req, res, next) {
    try {
      const { productId, metadata } = req.body;
      
      if (!productId || !metadata) {
        return res.status(400).json({
          success: false,
          message: 'productId and metadata are required'
        });
      }

      // Validate metadata is an object
      if (typeof metadata !== 'object' || metadata === null) {
        return res.status(400).json({
          success: false,
          message: 'metadata must be a valid object'
        });
      }

      const updatedProduct = productStorage.updateProductMetadata(productId, metadata);
      
      if (!updatedProduct) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      logger.info(`Product metadata updated - ID: ${productId}`, { metadata });

      res.status(200).json({
        success: true,
        message: 'Product metadata updated successfully',
        data: {
          productId: updatedProduct.id,
          metadata: updatedProduct.metadata
        }
      });
    } catch (error) {
      logger.error(`Error updating product metadata: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get product statistics
   * GET /api/v1/product/stats
   */
  async getProductStats(req, res, next) {
    try {
      const stats = productStorage.getStats();
      
      // Add additional statistics
      const allProducts = productStorage.getAllProducts();
      const statsWithDetails = {
        ...stats,
        priceDistribution: this._getPriceDistribution(allProducts),
        ratingDistribution: this._getRatingDistribution(allProducts),
        categoryDistribution: this._getCategoryDistribution(allProducts),
        brandDistribution: this._getBrandDistribution(allProducts),
        stockStatus: {
          inStock: allProducts.filter(p => p.stock > 0).length,
          lowStock: allProducts.filter(p => p.stock > 0 && p.stock < 10).length,
          outOfStock: allProducts.filter(p => p.stock === 0).length
        }
      };

      logger.info('Product statistics retrieved');

      res.status(200).json({
        success: true,
        data: statsWithDetails
      });
    } catch (error) {
      logger.error(`Error getting product stats: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get products by category
   * GET /api/v1/product/category/:category
   */
  async getProductsByCategory(req, res, next) {
    try {
      const { category } = req.params;
      const { limit = 50, page = 1, sortBy = 'popularity', order = 'desc' } = req.query;
      
      const allProducts = productStorage.getAllProducts();
      let filteredProducts = allProducts.filter(p => 
        p.category.toLowerCase() === category.toLowerCase()
      );

      // Apply sorting
      filteredProducts = this._sortProducts(filteredProducts, sortBy, order);

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

      logger.info(`Products by category retrieved - Category: ${category}, Count: ${paginatedProducts.length}`);

      res.status(200).json({
        success: true,
        data: {
          category,
          totalProducts: filteredProducts.length,
          currentPage: parseInt(page),
          totalPages: Math.ceil(filteredProducts.length / limit),
          products: paginatedProducts.map(p => p.toJSON())
        }
      });
    } catch (error) {
      logger.error(`Error getting products by category: ${error.message}`);
      next(error);
    }
  }

  /**
   * Update product stock
   * PATCH /api/v1/product/:id/stock
   */
  async updateProductStock(req, res, next) {
    try {
      const { id } = req.params;
      const { stock, operation = 'set' } = req.body;
      
      if (stock === undefined || isNaN(parseInt(stock))) {
        return res.status(400).json({
          success: false,
          message: 'Valid stock value is required'
        });
      }

      const product = productStorage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      let newStock;
      switch (operation) {
        case 'increment':
          newStock = product.stock + parseInt(stock);
          break;
        case 'decrement':
          newStock = Math.max(0, product.stock - parseInt(stock));
          break;
        case 'set':
        default:
          newStock = parseInt(stock);
      }

      product.stock = newStock;
      
      logger.info(`Product stock updated - ID: ${id}, New stock: ${newStock}, Operation: ${operation}`);

      res.status(200).json({
        success: true,
        message: 'Product stock updated successfully',
        data: {
          productId: product.id,
          stock: product.stock,
          operation
        }
      });
    } catch (error) {
      logger.error(`Error updating product stock: ${error.message}`);
      next(error);
    }
  }

  // Helper Methods
  _extractBrandFromTitle(title) {
    const brands = ['apple', 'samsung', 'oneplus', 'xiaomi', 'redmi', 'realme', 'oppo', 'vivo', 'nokia', 'motorola', 'asus', 'lenovo', 'hp', 'dell'];
    const lowerTitle = title.toLowerCase();
    
    for (const brand of brands) {
      if (lowerTitle.includes(brand)) {
        return brand;
      }
    }
    
    // Extract first word as brand
    return title.split(' ')[0].toLowerCase();
  }

  _updateSimilarProductsPopularity(newProduct) {
    const allProducts = productStorage.getAllProducts();
    const similarProducts = allProducts.filter(p => 
      p.brand === newProduct.brand || 
      p.category === newProduct.category
    );
    
    // Slightly increase popularity of similar products
    similarProducts.forEach(product => {
      if (product.id !== newProduct.id) {
        product.popularity = (product.popularity || 0) + 0.5;
      }
    });
  }

  _getPriceDistribution(products) {
    const ranges = [
      { label: 'Under ₹5,000', max: 5000 },
      { label: '₹5,000 - ₹10,000', min: 5000, max: 10000 },
      { label: '₹10,000 - ₹20,000', min: 10000, max: 20000 },
      { label: '₹20,000 - ₹50,000', min: 20000, max: 50000 },
      { label: '₹50,000 - ₹1,00,000', min: 50000, max: 100000 },
      { label: 'Above ₹1,00,000', min: 100000 }
    ];

    return ranges.map(range => {
      const count = products.filter(p => {
        if (range.min !== undefined && range.max !== undefined) {
          return p.price >= range.min && p.price < range.max;
        } else if (range.max !== undefined) {
          return p.price < range.max;
        } else if (range.min !== undefined) {
          return p.price >= range.min;
        }
        return false;
      }).length;

      return {
        range: range.label,
        count,
        percentage: ((count / products.length) * 100).toFixed(1)
      };
    });
  }

  _getRatingDistribution(products) {
    const ranges = [
      { label: '1-2 stars', min: 1, max: 2 },
      { label: '2-3 stars', min: 2, max: 3 },
      { label: '3-4 stars', min: 3, max: 4 },
      { label: '4-5 stars', min: 4, max: 5 },
      { label: '5 stars', min: 5, max: 5 }
    ];

    return ranges.map(range => {
      const count = products.filter(p => 
        p.rating >= range.min && p.rating <= range.max
      ).length;

      return {
        rating: range.label,
        count,
        percentage: ((count / products.length) * 100).toFixed(1)
      };
    });
  }

  _getCategoryDistribution(products) {
    const categoryMap = {};
    products.forEach(product => {
      const category = product.category || 'uncategorized';
      categoryMap[category] = (categoryMap[category] || 0) + 1;
    });

    return Object.keys(categoryMap).map(category => ({
      category,
      count: categoryMap[category],
      percentage: ((categoryMap[category] / products.length) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);
  }

  _getBrandDistribution(products) {
    const brandMap = {};
    products.forEach(product => {
      const brand = product.brand || 'unknown';
      brandMap[brand] = (brandMap[brand] || 0) + 1;
    });

    return Object.keys(brandMap).map(brand => ({
      brand,
      count: brandMap[brand],
      percentage: ((brandMap[brand] / products.length) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);
  }

  _sortProducts(products, sortBy, order) {
    const sorted = [...products];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'rating':
          aValue = a.rating;
          bValue = b.rating;
          break;
        case 'popularity':
          aValue = a.popularity || 0;
          bValue = b.popularity || 0;
          break;
        case 'stock':
          aValue = a.stock;
          bValue = b.stock;
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        default:
          aValue = a.popularity || 0;
          bValue = b.popularity || 0;
      }
      
      if (order === 'desc') {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });
    
    return sorted;
  }
}

module.exports = new ProductController();