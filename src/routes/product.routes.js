const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// Create a new product
router.post('/', productController.createProduct);

// Update product metadata
router.put('/meta-data', productController.updateProductMetadata);

// Get product statistics
router.get('/stats', productController.getProductStats);

module.exports = router;