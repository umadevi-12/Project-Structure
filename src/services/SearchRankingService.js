
const natural = require('natural');

// Inline config since path might be wrong
const config = {
  RANKING_WEIGHTS: {
    RELEVANCE: 0.35,
    RATING: 0.20,
    PRICE: 0.15,
    STOCK: 0.15,
    POPULARITY: 0.10,
    METADATA_MATCH: 0.05
  },
  SCORING: {
    MAX_RATING: 5.0,
    MIN_PRICE_THRESHOLD: 500,
    MAX_PRICE_THRESHOLD: 200000,
    STOCK_BOOST_THRESHOLD: 10,
    POPULARITY_BASE: 1000,
    PRICE_MATCH_BOOST: 1.5,
    CHEAP_INTENT_BOOST: 1.3
  },
  COMMON_MISSPELLINGS: {
    'ifone': 'iphone',
    'samsang': 'samsung',
    'redme': 'redmi',
    'realmi': 'realme',
    'oppoo': 'oppo',
    'vivoo': 'vivo',
    'onepluse': 'oneplus',
    'nokiaa': 'nokia',
    'lenevo': 'lenovo'
  },
  INTENT_KEYWORDS: {
    CHEAP: ['sasta', 'cheap', 'affordable', 'low price', 'kam dam', 'budget', 'sasti'],
    LATEST: ['latest', 'new', 'naya'],
    ACCESSORIES: ['cover', 'case', 'charger', 'headphone']
  }
};

class SearchRankingService {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.weights = config.RANKING_WEIGHTS;
    this.scoring = config.SCORING;
    this.commonMisspellings = config.COMMON_MISSPELLINGS || {};
    this.intentKeywords = config.INTENT_KEYWORDS || {};
    
    // Stemmer for better matching
    this.stemmer = natural.PorterStemmer;
  }

  rankProducts(query, products) {
    const normalizedQuery = this._normalizeQuery(query);
    const intent = this._detectIntent(normalizedQuery);
    
    const scoredProducts = products.map(product => {
      const scores = this._calculateScores(product, normalizedQuery, intent);
      const totalScore = this._calculateTotalScore(scores);
      
      return {
        product,
        scores,
        totalScore,
        intentMatch: intent
      };
    });
    
    // Sort by total score (descending)
    return scoredProducts
      .sort((a, b) => {
        // First by total score
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        // Then by relevance score
        if (b.scores.relevance !== a.scores.relevance) {
          return b.scores.relevance - a.scores.relevance;
        }
        // Then by rating
        return b.scores.rating - a.scores.rating;
      })
      .map(item => item.product);
  }

  _normalizeQuery(query) {
    let normalized = query.toLowerCase().trim();
    
    // Remove special characters but keep numbers for price detection
    normalized = normalized.replace(/[^\w\s\d₹]/g, ' ');
    
    // Correct common misspellings
    Object.keys(this.commonMisspellings).forEach(misspelling => {
      const regex = new RegExp(`\\b${misspelling}\\b`, 'g');
      if (regex.test(normalized)) {
        normalized = normalized.replace(regex, this.commonMisspellings[misspelling]);
      }
    });
    
    // Replace Hinglish words
    const hinglishMap = {
      'sasta': 'cheap',
      'sasti': 'cheap',
      'kam': 'less',
      'zyada': 'more',
      'accha': 'good',
      'naya': 'new',
      'purana': 'old'
    };
    
    Object.keys(hinglishMap).forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      normalized = normalized.replace(regex, hinglishMap[word]);
    });
    
    return normalized.trim();
  }

  _detectIntent(query) {
    const intent = {
      cheap: false,
      priceRange: null,
      featureBased: false,
      latest: false,
      accessories: false,
      specificFeature: null
    };
    
    // Check for cheap intent
    if (this.intentKeywords.CHEAP.some(keyword => query.includes(keyword))) {
      intent.cheap = true;
    }
    
    // Check for latest intent
    if (this.intentKeywords.LATEST.some(keyword => query.includes(keyword))) {
      intent.latest = true;
    }
    
    // Check for accessories
    if (this.intentKeywords.ACCESSORIES.some(keyword => query.includes(keyword))) {
      intent.accessories = true;
    }
    
    // Check for price range (Indian format: 50k, 50 thousand)
    const priceMatch = query.match(/(\d+)\s*(k|thousand|hazar|kilo)/i);
    if (priceMatch) {
      const price = parseInt(priceMatch[1]) * 1000;
      intent.priceRange = { 
        min: Math.max(price * 0.7, this.scoring.MIN_PRICE_THRESHOLD), 
        max: price * 1.3 
      };
    }
    
    // Check for rupee symbol
    const rupeeMatch = query.match(/₹?\s*(\d+)\s*(rupees?)/i);
    if (rupeeMatch) {
      const price = parseInt(rupeeMatch[1]);
      intent.priceRange = { 
        min: Math.max(price * 0.7, this.scoring.MIN_PRICE_THRESHOLD), 
        max: price * 1.3 
      };
    }
    
    // Check for specific features
    const features = ['storage', 'ram', 'color', 'screen', 'battery', 'camera', 'gb', 'inch', 'mp'];
    features.forEach(feature => {
      if (query.includes(feature)) {
        intent.featureBased = true;
        intent.specificFeature = feature;
      }
    });
    
    return intent;
  }

  _calculateScores(product, query, intent) {
    return {
      relevance: this._calculateRelevanceScore(product, query),
      rating: this._calculateRatingScore(product),
      price: this._calculatePriceScore(product, intent),
      stock: this._calculateStockScore(product),
      popularity: this._calculatePopularityScore(product),
      metadata: this._calculateMetadataScore(product, query, intent)
    };
  }

  _calculateRelevanceScore(product, query) {
    const productText = `${product.title} ${product.description} ${product.brand} ${product.category}`.toLowerCase();
    
    const queryTerms = query.split(/\s+/).filter(term => term.length > 1);
    
    if (queryTerms.length === 0) return 0;
    
    let score = 0;
    
    // Exact matches get higher scores
    queryTerms.forEach(term => {
      if (product.title.toLowerCase().includes(term)) {
        score += 0.4; // Title matches are most important
      } else if (product.brand.toLowerCase().includes(term)) {
        score += 0.3;
      } else if (product.description.toLowerCase().includes(term)) {
        score += 0.2;
      } else if (productText.includes(term)) {
        score += 0.1;
      }
    });
    
    // Bonus for exact product name match
    if (product.title.toLowerCase().includes(query)) {
      score += 0.5;
    }
    
    return Math.min(score, 1);
  }

  _calculateRatingScore(product) {
    if (product.rating <= 0) return 0;
    
    // Exponential scoring: higher ratings get disproportionately better scores
    const normalized = product.rating / this.scoring.MAX_RATING;
    return Math.pow(normalized, 1.5); // Exponential boost for high ratings
  }

  _calculatePriceScore(product, intent) {
    let score = 0;
    
    // Base price score (lower price gets higher score for budget-conscious market)
    const priceRange = this.scoring.MAX_PRICE_THRESHOLD - this.scoring.MIN_PRICE_THRESHOLD;
    const normalizedPrice = Math.max(Math.min(
      (this.scoring.MAX_PRICE_THRESHOLD - product.price) / priceRange,
      1
    ), 0);
    
    score = normalizedPrice;
    
    // Boost for cheap intent
    if (intent.cheap) {
      score *= this.scoring.CHEAP_INTENT_BOOST;
    }
    
    // Penalty/Boost for price range intent
    if (intent.priceRange) {
      if (product.price >= intent.priceRange.min && product.price <= intent.priceRange.max) {
        score *= this.scoring.PRICE_MATCH_BOOST;
      } else {
        // Outside range gets penalty based on distance
        const distance = Math.min(
          Math.abs(product.price - intent.priceRange.min),
          Math.abs(product.price - intent.priceRange.max)
        ) / intent.priceRange.max;
        score *= Math.max(0.1, 1 - distance);
      }
    }
    
    return Math.min(score, 1);
  }

  _calculateStockScore(product) {
    if (product.stock <= 0) return 0;
    
    if (product.stock >= this.scoring.STOCK_BOOST_THRESHOLD) return 1;
    
    // Logarithmic scoring: first few units matter more
    return Math.log1p(product.stock) / Math.log1p(this.scoring.STOCK_BOOST_THRESHOLD);
  }

  _calculatePopularityScore(product) {
    const popularity = product.popularity || 0;
    
    if (popularity <= 0) return 0;
    
    // Logarithmic scale for popularity
    return Math.min(Math.log1p(popularity) / Math.log1p(this.scoring.POPULARITY_BASE), 1);
  }

  _calculateMetadataScore(product, query, intent) {
    let score = 0;
    const metadata = product.metadata || {};
    
    // Check for metadata matches
    Object.keys(metadata).forEach(key => {
      const value = metadata[key].toString().toLowerCase();
      
      // Exact metadata key match
      if (query.includes(key.toLowerCase())) {
        score += 0.2;
      }
      
      // Metadata value match
      if (query.includes(value)) {
        score += 0.15;
      }
      
      // Feature-based intent match
      if (intent.specificFeature && 
          (key.toLowerCase().includes(intent.specificFeature) || 
           value.includes(intent.specificFeature))) {
        score += 0.3;
      }
    });
    
    return Math.min(score, 1);
  }

  _calculateTotalScore(scores) {
    let total = 0;
    total += scores.relevance * this.weights.RELEVANCE;
    total += scores.rating * this.weights.RATING;
    total += scores.price * this.weights.PRICE;
    total += scores.stock * this.weights.STOCK;
    total += scores.popularity * this.weights.POPULARITY;
    total += scores.metadata * this.weights.METADATA_MATCH;
    
    return Math.min(total, 1);
  }
}

module.exports = new SearchRankingService();