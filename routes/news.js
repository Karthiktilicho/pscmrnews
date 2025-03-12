const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { uploadToS3 } = require('../services/s3Service');

// Configure multer for memory storage (for S3 upload)
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

// Get all news
router.get('/', async (req, res) => {
  try {
    const news = await query(`
      SELECT n.*, c.name as category_name, u.username as author_name 
      FROM news n 
      LEFT JOIN categories c ON n.category_id = c.id 
      LEFT JOIN users u ON n.created_by = u.id 
      ORDER BY n.created_at DESC
    `);
    res.json(news);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: 'Server error while fetching news' });
  }
});

// Get news by ID
router.get('/:id', async (req, res) => {
  try {
    const newsId = req.params.id;
    const news = await query(`
      SELECT n.*, c.name as category_name, u.username as author_name 
      FROM news n 
      LEFT JOIN categories c ON n.category_id = c.id 
      LEFT JOIN users u ON n.created_by = u.id 
      WHERE n.id = ?
    `, [newsId]);

    if (news.length === 0) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Increment views
    await query('UPDATE news SET views = views + 1 WHERE id = ?', [newsId]);
    res.json(news[0]);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: 'Server error while fetching news' });
  }
});

// Create news
router.post('/', authenticateToken, handleUpload, async (req, res) => {
  try {
    const { title, content, category_id } = req.body;
    const userId = req.user.id;
    let image_url = null;

    if (req.file) {
      const uploadResult = await uploadToS3(req.file);
      image_url = uploadResult.Location;
    }

    const result = await query(
      'INSERT INTO news (title, content, image_url, category_id, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, content, image_url, category_id, userId]
    );

    res.status(201).json({
      id: result.insertId,
      title,
      content,
      image_url,
      category_id,
      created_by: userId
    });
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ message: 'Server error while creating news' });
  }
});

// Update news
router.put('/:id', authenticateToken, handleUpload, async (req, res) => {
  try {
    const newsId = req.params.id;
    const { title, content, category_id } = req.body;
    const userId = req.user.id;

    const existingNews = await query('SELECT * FROM news WHERE id = ?', [newsId]);
    if (existingNews.length === 0) {
      return res.status(404).json({ message: 'News not found' });
    }

    let image_url = existingNews[0].image_url;
    if (req.file) {
      const uploadResult = await uploadToS3(req.file);
      image_url = uploadResult.Location;
    }

    await query(
      'UPDATE news SET title = ?, content = ?, image_url = ?, category_id = ? WHERE id = ?',
      [title, content, image_url, category_id, newsId]
    );

    res.json({
      id: newsId,
      title,
      content,
      image_url,
      category_id,
      updated_by: userId
    });
  } catch (error) {
    console.error('Error updating news:', error);
    res.status(500).json({ message: 'Server error while updating news' });
  }
});

// Delete news
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const newsId = req.params.id;
    const result = await query('DELETE FROM news WHERE id = ?', [newsId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'News not found' });
    }

    res.json({ message: 'News deleted successfully' });
  } catch (error) {
    console.error('Error deleting news:', error);
    res.status(500).json({ message: 'Server error while deleting news' });
  }
});

module.exports = router;
