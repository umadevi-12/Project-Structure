
require('dotenv').config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Search ranking weights (configurable)
  RANKING_WEIGHTS: {
    RELEVANCE: 0.35,
    RATING: 0.20,
    PRICE: 0.15,
    STOCK: 0.15,
    POPULARITY: 0.10,
    METADATA_MATCH: 0.05
  },
  
  // Scoring parameters
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
    'lenevo': 'lenovo',
    'asus': 'asus',
    'jbl': 'jbl',
    'boat': 'boat',
    'sonyy': 'sony'
  },
  
  // Intent keywords (Hinglish support)
  INTENT_KEYWORDS: {
    CHEAP: ['sasta', 'cheap', 'affordable', 'low price', 'kam dam', 'budget', 'sasti', 'thoda sasta'],
    LATEST: ['latest', 'new', 'naya', 'navin', '2024', '2023'],
    ACCESSORIES: ['cover', 'case', 'charger', 'headphone', 'earphone', 'cable', 'guard', 'protector']
  }
};