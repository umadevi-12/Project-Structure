const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');

// Search products with ranking
router.get('/product', searchController.searchProducts);

// Auto-complete suggestions
router.get('/autocomplete', searchController.autoComplete);

module.exports = router;