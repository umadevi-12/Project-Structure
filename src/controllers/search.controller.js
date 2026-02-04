const productStorage = require('../services/ProductStorage');
const searchRankingService = require('../services/SearchRankingService');
const logger = require('../utils/logger');

class SearchController {
  /**
   * Search products with intelligent ranking
   * GET /api/v1/search/product
   */
  async searchProducts(req, res, next) {
    try {
      const startTime = Date.now();
      const { 
        query, 
        category, 
        brand, 
        minPrice, 
        maxPrice, 
        inStock, 
        limit, 
        sortBy,
        rating,
        page = 1
      } = req.query;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      // Log search query for analytics
      logger.info(`Search query: "${query}"`, {
        category, brand, minPrice, maxPrice, inStock,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Build filters
      const filters = this._buildFilters(req.query);
      
      // Get filtered products
      let products = productStorage.searchProducts(query, filters);
      
      // Apply additional filters
      products = this._applyAdvancedFilters(products, filters);
      
      // Calculate total matches before ranking
      const totalMatches = products.length;
      
      // Rank products using intelligent ranking algorithm
      const rankedProducts = searchRankingService.rankProducts(query, products);
      
      // Apply sorting if specified (overrides ranking)
      let finalProducts = this._applySorting(rankedProducts, sortBy);
      
      // Apply pagination
      const resultLimit = limit ? parseInt(limit) : 20;
      const startIndex = (page - 1) * resultLimit;
      const paginatedProducts = finalProducts.slice(startIndex, startIndex + resultLimit);
      
      const responseTime = Date.now() - startTime;
      
      // Log search performance
      logger.info(`Search executed: "${query}" - ${totalMatches} products found - ${responseTime}ms`);
      
      // Prepare response data
      const responseData = this._formatSearchResponse(
        paginatedProducts, 
        query, 
        filters, 
        totalMatches, 
        responseTime,
        page,
        resultLimit
      );
      
      res.status(200).json(responseData);
    } catch (error) {
      logger.error(`Search error for query "${req.query.query}": ${error.message}`, { 
        stack: error.stack,
        query: req.query 
      });
      next(error);
    }
  }

  /**
   * Auto-complete suggestions
   * GET /api/v1/search/autocomplete
   */
  async autoComplete(req, res, next) {
    try {
      const { q } = req.query;
      
      if (!q || q.length < 2) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'Query must be at least 2 characters'
        });
      }
      
      const products = productStorage.getAllProducts();
      const suggestions = this._generateSuggestions(products, q);
      
      // Add trending searches
      const trendingSuggestions = this._getTrendingSuggestions();
      const allSuggestions = [...suggestions, ...trendingSuggestions];
      
      // Remove duplicates and limit
      const uniqueSuggestions = this._deduplicateSuggestions(allSuggestions).slice(0, 15);
      
      logger.info(`Autocomplete suggestions for: "${q}" - ${uniqueSuggestions.length} results`);
      
      res.status(200).json({
        success: true,
        query: q,
        data: uniqueSuggestions
      });
    } catch (error) {
      logger.error(`Autocomplete error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get search suggestions based on previous searches
   * GET /api/v1/search/suggestions
   */
  async getSearchSuggestions(req, res, next) {
    try {
      const { q } = req.query;
      
      if (!q || q.length < 1) {
        return res.status(200).json({
          success: true,
          data: this._getPopularSearches()
        });
      }
      
      const products = productStorage.getAllProducts();
      const suggestions = [];
      
      // Product title suggestions
      products.forEach(product => {
        const title = product.title.toLowerCase();
        if (title.includes(q.toLowerCase())) {
          suggestions.push({
            type: 'product',
            value: product.title,
            id: product.id,
            category: product.category,
            brand: product.brand,
            price: product.price,
            score: this._calculateSuggestionScore(product, q)
          });
        }
      });
      
      // Category suggestions
      const categories = [...new Set(products.map(p => p.category))];
      categories.forEach(category => {
        if (category.toLowerCase().includes(q.toLowerCase())) {
          suggestions.push({
            type: 'category',
            value: category,
            id: category.toLowerCase().replace(/\s+/g, '-'),
            productCount: products.filter(p => p.category === category).length
          });
        }
      });
      
      // Brand suggestions
      const brands = [...new Set(products.map(p => p.brand))];
      brands.forEach(brand => {
        if (brand.toLowerCase().includes(q.toLowerCase())) {
          suggestions.push({
            type: 'brand',
            value: brand,
            id: brand.toLowerCase().replace(/\s+/g, '-'),
            productCount: products.filter(p => p.brand === brand).length
          });
        }
      });
      
      // Sort by score and remove duplicates
      const sortedSuggestions = suggestions
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 20);
      
      const uniqueSuggestions = this._deduplicateSuggestions(sortedSuggestions);
      
      res.status(200).json({
        success: true,
        query: q,
        data: uniqueSuggestions.slice(0, 10)
      });
    } catch (error) {
      logger.error(`Search suggestions error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get search analytics
   * GET /api/v1/search/analytics
   */
  async getSearchAnalytics(req, res, next) {
    try {
      const { period = 'daily' } = req.query;
      
      // Mock analytics data (in real app, this would come from a database)
      const analytics = {
        totalSearches: 12543,
        topQueries: [
          { query: 'iphone', count: 1250 },
          { query: 'samsung', count: 980 },
          { query: 'laptop', count: 756 },
          { query: 'headphones', count: 632 },
          { query: 'smartwatch', count: 521 }
        ],
        zeroResultQueries: [
          { query: 'xyzabc123', count: 45 },
          { query: 'old model 2005', count: 32 }
        ],
        conversionRate: '12.5%',
        averageResponseTime: '245ms',
        popularCategories: ['mobile', 'laptop', 'audio', 'wearables'],
        searchTrends: this._getSearchTrends(period)
      };
      
      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error(`Search analytics error: ${error.message}`);
      next(error);
    }
  }

  // Helper Methods
  _buildFilters(queryParams) {
    const filters = {};
    
    if (queryParams.category) filters.category = queryParams.category;
    if (queryParams.brand) filters.brand = queryParams.brand;
    if (queryParams.minPrice) filters.minPrice = parseFloat(queryParams.minPrice);
    if (queryParams.maxPrice) filters.maxPrice = parseFloat(queryParams.maxPrice);
    if (queryParams.inStock === 'true') filters.inStock = true;
    if (queryParams.outOfStock === 'true') filters.outOfStock = true;
    if (queryParams.rating) filters.minRating = parseFloat(queryParams.rating);
    if (queryParams.discount) filters.minDiscount = parseFloat(queryParams.discount);
    
    // Advanced filters
    if (queryParams.color) filters.color = queryParams.color;
    if (queryParams.storage) filters.storage = queryParams.storage;
    if (queryParams.ram) filters.ram = queryParams.ram;
    
    return filters;
  }

  _applyAdvancedFilters(products, filters) {
    let filteredProducts = [...products];
    
    // Rating filter
    if (filters.minRating) {
      filteredProducts = filteredProducts.filter(p => p.rating >= filters.minRating);
    }
    
    // Discount filter
    if (filters.minDiscount && filters.minDiscount > 0) {
      filteredProducts = filteredProducts.filter(p => {
        if (!p.mrp || p.mrp <= p.price) return false;
        const discount = ((p.mrp - p.price) / p.mrp) * 100;
        return discount >= filters.minDiscount;
      });
    }
    
    // Out of stock filter
    if (filters.outOfStock) {
      filteredProducts = filteredProducts.filter(p => p.stock === 0);
    }
    
    // Metadata filters
    if (filters.color) {
      filteredProducts = filteredProducts.filter(p => 
        p.metadata && p.metadata.color && 
        p.metadata.color.toLowerCase().includes(filters.color.toLowerCase())
      );
    }
    
    if (filters.storage) {
      filteredProducts = filteredProducts.filter(p => 
        p.metadata && p.metadata.storage && 
        p.metadata.storage.toLowerCase().includes(filters.storage.toLowerCase())
      );
    }
    
    if (filters.ram) {
      filteredProducts = filteredProducts.filter(p => 
        p.metadata && p.metadata.ram && 
        p.metadata.ram.toLowerCase().includes(filters.ram.toLowerCase())
      );
    }
    
    return filteredProducts;
  }

  _applySorting(products, sortBy) {
    if (!sortBy) return products;
    
    const sortedProducts = [...products];
    
    switch(sortBy) {
      case 'price_asc':
        return sortedProducts.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return sortedProducts.sort((a, b) => b.price - a.price);
      case 'rating':
        return sortedProducts.sort((a, b) => b.rating - a.rating);
      case 'popularity':
        return sortedProducts.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      case 'newest':
        return sortedProducts.sort((a, b) => 
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
      case 'discount':
        return sortedProducts.sort((a, b) => {
          const discountA = a.mrp ? ((a.mrp - a.price) / a.mrp) * 100 : 0;
          const discountB = b.mrp ? ((b.mrp - b.price) / b.mrp) * 100 : 0;
          return discountB - discountA;
        });
      default:
        return products; // Use ranking algorithm's order
    }
  }

  _formatSearchResponse(products, query, filters, totalMatches, responseTime, page, limit) {
    return {
      success: true,
      query,
      filters: this._sanitizeFilters(filters),
      pagination: {
        currentPage: parseInt(page),
        pageSize: limit,
        totalResults: totalMatches,
        totalPages: Math.ceil(totalMatches / limit),
        hasNext: (page * limit) < totalMatches,
        hasPrevious: page > 1
      },
      performance: {
        responseTime: `${responseTime}ms`,
        status: responseTime < 500 ? 'excellent' : responseTime < 1000 ? 'good' : 'slow'
      },
      resultsCount: products.length,
      totalMatches,
      data: products.map(product => {
        const json = product.toJSON ? product.toJSON() : product;
        
        // Calculate discount if available
        let discount = null;
        if (json.mrp && json.mrp > json.price) {
          discount = {
            percentage: Math.round(((json.mrp - json.price) / json.mrp) * 100),
            amount: json.mrp - json.price
          };
        }
        
        return {
          productId: json.id,
          title: json.title,
          description: json.description,
          mrp: json.mrp,
          sellingPrice: json.price,
          currency: json.currency,
          rating: json.rating,
          stock: json.stock,
          stockStatus: json.stock > 10 ? 'in_stock' : json.stock > 0 ? 'low_stock' : 'out_of_stock',
          category: json.category,
          brand: json.brand,
          metadata: json.metadata || {},
          discount,
          popularity: json.popularity || 0,
          isFeatured: json.popularity > 1000
        };
      })
    };
  }

  _generateSuggestions(products, query) {
    const suggestions = [];
    const queryLower = query.toLowerCase();
    
    products.forEach(product => {
      // Product title matches
      if (product.title.toLowerCase().includes(queryLower)) {
        suggestions.push({
          type: 'product',
          value: product.title,
          id: product.id,
          category: product.category,
          brand: product.brand,
          price: product.price
        });
      }
      
      // Brand matches
      if (product.brand.toLowerCase().includes(queryLower)) {
        suggestions.push({
          type: 'brand',
          value: product.brand,
          id: product.brand,
          productCount: products.filter(p => p.brand === product.brand).length
        });
      }
      
      // Category matches
      if (product.category.toLowerCase().includes(queryLower)) {
        suggestions.push({
          type: 'category',
          value: product.category,
          id: product.category,
          productCount: products.filter(p => p.category === product.category).length
        });
      }
      
      // Metadata matches
      if (product.metadata) {
        Object.entries(product.metadata).forEach(([key, value]) => {
          if (value.toString().toLowerCase().includes(queryLower)) {
            suggestions.push({
              type: 'feature',
              value: `${key}: ${value}`,
              id: `${key}-${value}`,
              productId: product.id
            });
          }
        });
      }
    });
    
    // Add query corrections for common misspellings
    const corrections = this._getQueryCorrections(query);
    corrections.forEach(correction => {
      suggestions.push({
        type: 'correction',
        value: `Did you mean: ${correction}`,
        id: `correction-${correction}`,
        correctedQuery: correction
      });
    });
    
    return suggestions;
  }

  _getTrendingSuggestions() {
    // In a real app, this would come from analytics
    return [
      { type: 'trending', value: 'iPhone 16', id: 'trending-iphone16' },
      { type: 'trending', value: 'Samsung S24', id: 'trending-samsung-s24' },
      { type: 'trending', value: 'Wireless Earbuds', id: 'trending-earbuds' },
      { type: 'trending', value: 'Gaming Laptop', id: 'trending-gaming-laptop' },
      { type: 'trending', value: 'Smart Watch', id: 'trending-smartwatch' }
    ];
  }

  _getPopularSearches() {
    return [
      { query: 'iphone', count: 1250 },
      { query: 'samsung mobile', count: 980 },
      { query: 'laptop under 50000', count: 756 },
      { query: 'wireless headphones', count: 632 },
      { query: 'smart watch', count: 521 },
      { query: 'tablet', count: 432 },
      { query: 'power bank', count: 389 },
      { query: 'mobile cover', count: 345 },
      { query: 'bluetooth speaker', count: 321 },
      { query: 'camera', count: 298 }
    ];
  }

  _getQueryCorrections(query) {
    const corrections = [];
    const commonMisspellings = {
      'ifone': 'iphone',
      'samsang': 'samsung',
      'redme': 'redmi',
      'realmi': 'realme',
      'oppoo': 'oppo',
      'vivoo': 'vivo',
      'onepluse': 'oneplus'
    };
    
    Object.keys(commonMisspellings).forEach(misspelling => {
      if (query.toLowerCase().includes(misspelling)) {
        const corrected = query.toLowerCase().replace(misspelling, commonMisspellings[misspelling]);
        corrections.push(corrected);
      }
    });
    
    return corrections;
  }

  _calculateSuggestionScore(product, query) {
    let score = 0;
    const queryLower = query.toLowerCase();
    const titleLower = product.title.toLowerCase();
    
    // Exact match at beginning of title gets highest score
    if (titleLower.startsWith(queryLower)) score += 10;
    
    // Exact match anywhere in title
    else if (titleLower.includes(queryLower)) score += 5;
    
    // Brand match
    if (product.brand.toLowerCase().includes(queryLower)) score += 3;
    
    // Popularity boost
    score += (product.popularity || 0) / 100;
    
    // Rating boost
    score += product.rating;
    
    return score;
  }

  _deduplicateSuggestions(suggestions) {
    const seen = new Set();
    return suggestions.filter(suggestion => {
      const key = `${suggestion.type}-${suggestion.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  _sanitizeFilters(filters) {
    const sanitized = { ...filters };
    
    // Remove any sensitive or internal data
    delete sanitized.userId;
    delete sanitized.sessionId;
    
    return sanitized;
  }

  _getSearchTrends(period) {
    // Mock data for trends
    const now = new Date();
    const trends = [];
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      trends.push({
        date: date.toISOString().split('T')[0],
        searches: Math.floor(Math.random() * 100) + 50,
        conversions: Math.floor(Math.random() * 20) + 5
      });
    }
    
    return trends;
  }
}

module.exports = new SearchController();