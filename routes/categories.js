const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { uploadToS3 } = require('../services/s3Service');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
    cb(null, true);
  }
}).single('image');

// Custom middleware to handle file upload
const handleUpload = (req, res, next) => {
  upload(req, res, function (err) {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
};

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY created_at DESC');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error while fetching categories' });
  }
});

// Create category
router.post('/', authenticateToken, handleUpload, async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;
    let image_url = null;

    if (req.file) {
      const uploadResult = await uploadToS3(req.file);
      image_url = uploadResult.Location;
    }

    const result = await query(
      'INSERT INTO categories (name, image_url, created_by) VALUES (?, ?, ?)',
      [name, image_url, userId]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      image_url,
      created_by: userId
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Server error while creating category' });
  }
});

// Update category
router.put('/:id', authenticateToken, handleUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    const existingCategory = await query('SELECT * FROM categories WHERE id = ?', [id]);
    if (existingCategory.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    let image_url = existingCategory[0].image_url;
    if (req.file) {
      const uploadResult = await uploadToS3(req.file);
      image_url = uploadResult.Location;
    }

    await query(
      'UPDATE categories SET name = ?, image_url = ? WHERE id = ?',
      [name, image_url, id]
    );

    res.json({
      id,
      name,
      image_url,
      updated_by: userId
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Server error while updating category' });
  }
});

// Delete category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category has associated news
    const newsCount = await query('SELECT COUNT(*) as count FROM news WHERE category_id = ?', [id]);
    if (newsCount[0].count > 0) {
      return res.status(400).json({ message: 'Cannot delete category with associated news articles' });
    }

    const result = await query('DELETE FROM categories WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Server error while deleting category' });
  }
});

module.exports = router;
