const axios = require('axios');
const cheerio = require('cheerio');
const Product = require('./src/models/Product');
const productStorage = require('./src/services/ProductStorage');

class WebScraper {
  constructor() {
    this.baseURLs = [
      'https://www.flipkart.com/mobiles/pr',
      'https://www.amazon.in/s',
      'https://www.reliancedigital.in/mobile-phones'
    ];
  }

  async scrapeFlipkart(query = 'smartphones', limit = 50) {
    try {
      const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const products = [];
      
      $('div[data-id]').each((i, elem) => {
        if (products.length >= limit) return false;
        
        try {
          const title = $(elem).find('a.s1Q9rs')?.text() || 
                       $(elem).find('div._4rR01T')?.text() || 
                       $(elem).find('a.IRpwTa')?.text();
          
          const priceText = $(elem).find('div._30jeq3')?.text();
          const mrpText = $(elem).find('div._3I9_wc')?.text() || priceText;
          
          if (title && priceText) {
            const price = this._extractPrice(priceText);
            const mrp = this._extractPrice(mrpText);
            
            // Extract brand from title
            const brand = this._extractBrand(title);
            
            // Extract category
            const category = this._inferCategory(title);
            
            const productData = {
              title: title.trim(),
              description: title.trim(),
              price: price || 9999,
              mrp: mrp || price || 11999,
              rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)), // 3.5-5.0
              stock: Math.floor(Math.random() * 100) + 10,
              category: category,
              brand: brand.toLowerCase(),
              popularity: Math.floor(Math.random() * 1000) + 100,
              metadata: {
                source: 'flipkart',
                scraped: new Date().toISOString()
              }
            };
            
            products.push(productData);
          }
        } catch (err) {
          console.log(`Error parsing product ${i}:`, err.message);
        }
      });
      
      return products;
    } catch (error) {
      console.error('Error scraping Flipkart:', error.message);
      return [];
    }
  }

  async scrapeMultipleSources(totalProducts = 100) {
    console.log(`🌐 Starting web scraping for ${totalProducts} products...`);
    
    const queries = [
      'smartphone', 'iphone', 'samsung mobile', 'oneplus mobile',
      'redmi phone', 'realme mobile', 'mobile charger', 'headphones',
      'earphones', 'laptop', 'tablet', 'smart watch'
    ];
    
    let allProducts = [];
    
    for (const query of queries) {
      if (allProducts.length >= totalProducts) break;
      
      console.log(`Scraping: ${query}...`);
      const products = await this.scrapeFlipkart(query, 20);
      allProducts = [...allProducts, ...products];
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`✅ Scraped ${allProducts.length} products total`);
    return allProducts.slice(0, totalProducts);
  }

  async scrapeAndStore(limit = 100) {
    try {
      const products = await this.scrapeMultipleSources(limit);
      
      let count = 0;
      for (const productData of products) {
        try {
          const product = new Product(productData);
          productStorage.addProduct(product);
          count++;
          console.log(`✅ ${count}. ${product.title} - ₹${product.price}`);
        } catch (err) {
          console.log(`❌ Error storing: ${err.message}`);
        }
      }
      
      console.log(`\n🎉 Successfully stored ${count} products`);
      return count;
    } catch (error) {
      console.error('Scraping failed:', error);
      return 0;
    }
  }

  _extractPrice(priceText) {
    if (!priceText) return null;
    
    const match = priceText.match(/₹?[\s,]*(\d+(?:,\d+)*(?:\.\d+)?)/);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
    return null;
  }

  _extractBrand(title) {
    const brands = [
      'apple', 'samsung', 'oneplus', 'redmi', 'xiaomi', 'realme',
      'oppo', 'vivo', 'nokia', 'motorola', 'asus', 'lenovo',
      'hp', 'dell', 'sony', 'jbl', 'boat', 'noise', 'boAt'
    ];
    
    const lowerTitle = title.toLowerCase();
    for (const brand of brands) {
      if (lowerTitle.includes(brand)) {
        return brand;
      }
    }
    
    // Extract first word as potential brand
    return title.split(' ')[0];
  }

  _inferCategory(title) {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('iphone') || lowerTitle.includes('mobile') || 
        lowerTitle.includes('phone') || lowerTitle.includes('smartphone')) {
      return 'mobile';
    } else if (lowerTitle.includes('laptop') || lowerTitle.includes('notebook')) {
      return 'laptop';
    } else if (lowerTitle.includes('headphone') || lowerTitle.includes('earphone') || 
               lowerTitle.includes('earbud') || lowerTitle.includes('headset')) {
      return 'audio';
    } else if (lowerTitle.includes('charger') || lowerTitle.includes('cable') || 
               lowerTitle.includes('adapter') || lowerTitle.includes('power bank')) {
      return 'accessories';
    } else if (lowerTitle.includes('watch') || lowerTitle.includes('smartwatch')) {
      return 'wearables';
    } else if (lowerTitle.includes('tablet') || lowerTitle.includes('ipad')) {
      return 'tablet';
    } else if (lowerTitle.includes('tv') || lowerTitle.includes('television')) {
      return 'television';
    }
    
    return 'electronics';
  }
}

module.exports = new WebScraper();