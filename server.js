const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToS3 } = require('./services/s3Service');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

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

// MySQL Connection
const db = mysql.createConnection({
  host: '172.31.0.100',
  port: 3306,
  user: 'root',
  password: 'place-your-password-here',
  database: 'pscmrnews'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', {
      error: err.message,
      code: err.code,
      errno: err.errno,
      sqlMessage: err.sqlMessage,
      host,
      port,
      user: process.env.DB_USER,
      database: process.env.DB_NAME
    });
    return;
  }
  console.log('Connected to MySQL database with config:', {
    host,
    port,
    user: process.env.DB_USER,
    database: process.env.DB_NAME
  });

  // Add image_url column to categories table if it doesn't exist
  const addImageUrlColumn = `
    ALTER TABLE categories 
    ADD COLUMN image_url VARCHAR(255) AFTER name
  `;

  db.query(addImageUrlColumn, (err) => {
    if (err && !err.message.includes('Duplicate column name')) {
      console.error('Error adding image_url column:', err);
    } else {
      console.log('Successfully added or verified image_url column');
    }
  });
});

// Convert db.query to Promise
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) {
        console.error('Database Error:', error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

// Test database connection
db.connect(error => {
  if (error) {
    console.error('Error connecting to the database:', error);
    return;
  }
  console.log('Successfully connected to database');
  
  // Create categories table if it doesn't exist
  const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      image_url VARCHAR(255),
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `;
  
  db.query(createCategoriesTable, (err) => {
    if (err) {
      console.error('Error creating categories table:', err);
    } else {
      console.log('Categories table ready');
    }
  });

  // Create users table if it doesn't exist
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'user') DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(createUsersTable, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('Users table ready');
    }
  });

  // Create news table if it doesn't exist
  const createNewsTable = `
    CREATE TABLE IF NOT EXISTS news (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      image_url VARCHAR(255),
      category_id INT,
      created_by INT,
      views INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `;

  db.query(createNewsTable, (err) => {
    if (err) {
      console.error('Error creating news table:', err);
    } else {
      console.log('News table ready');
      
      // Add views column if it doesn't exist
      const addViewsColumn = `
        ALTER TABLE news 
        ADD COLUMN views INT DEFAULT 0 AFTER created_by
      `;

      db.query(addViewsColumn, (err) => {
        if (err && err.message.includes('Duplicate column name')) {
          console.log('Views column already exists');
        } else if (err) {
          console.error('Error adding views column:', err);
        } else {
          console.log('Successfully added views column');
        }
      });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size should be less than 5MB',
        field: 'image'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Error uploading file',
      field: 'image'
    });
  }
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  console.log('Authenticating request:', req.method, req.path);
  console.log('Headers:', req.headers);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      console.log('Token verification failed:', err);
      return res.status(403).json({ 
        success: false,
        message: 'Invalid or expired token' 
      });
    }

    console.log('Authenticated user:', user);
    req.user = user;
    next();
  });
};

// Categories routes
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY created_at DESC');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching categories' 
    });
  }
});

app.post('/api/categories', authenticateToken, handleUpload, async (req, res) => {
  try {
    console.log('========= Request Debug =========');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Files:', req.files);
    console.log('File:', req.file);
    console.log('Form Data Name:', req.body.name);
    console.log('Form Data Type:', typeof req.body.name);
    console.log('================================');

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'No form data received',
        debug: { received: req.body }
      });
    }

    const name = req.body.name;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
        debug: { 
          receivedName: name,
          bodyKeys: Object.keys(req.body)
        }
      });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: 'Category name cannot be empty',
        field: 'name'
      });
    }

    let image_url = null;
    if (req.file) {
      try {
        image_url = await uploadToS3(req.file);
        console.log('Image uploaded to S3:', image_url);
      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to S3',
          error: uploadError.message
        });
      }
    }

    const existing = await query('SELECT id FROM categories WHERE name = ?', [trimmedName]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Category name already exists',
        field: 'name'
      });
    }

    const result = await query(
      'INSERT INTO categories (name, image_url, created_by) VALUES (?, ?, ?)',
      [trimmedName, image_url, req.user.id]
    );

    const newCategory = {
      id: result.insertId,
      name: trimmedName,
      image_url,
      created_by: req.user.id
    };

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: newCategory
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
});

app.put('/api/categories/:id', authenticateToken, handleUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    console.log('Updating category:', { id, name, file: req.file });
    
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category name is required',
        field: 'name'
      });
    }

    const existingCategory = await query('SELECT * FROM categories WHERE id = ?', [id]);
    console.log('Existing category:', existingCategory);
    
    if (!existingCategory || existingCategory.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found'
      });
    }

    const duplicate = await query(
      'SELECT id FROM categories WHERE name = ? AND id != ?', 
      [name.trim(), id]
    );
    
    if (duplicate.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Category name already exists',
        field: 'name'
      });
    }

    let updateQuery = 'UPDATE categories SET name = ?';
    let params = [name.trim()];

    if (req.file) {
      try {
        const image_url = await uploadToS3(req.file);
        console.log('New image uploaded to S3:', image_url);
        updateQuery += ', image_url = ?';
        params.push(image_url);
      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to S3',
          error: uploadError.message
        });
      }
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    await query(updateQuery, params);

    const updatedCategory = await query('SELECT * FROM categories WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Category updated successfully',
      category: updatedCategory[0]
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category exists
    const category = await query('SELECT * FROM categories WHERE id = ?', [id]);
    if (category.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found'
      });
    }

    // Delete category
    await query('DELETE FROM categories WHERE id = ?', [id]);

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Error deleting category' });
  }
});

// Users routes
app.get('/api/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  db.query('SELECT id, username, role, created_at FROM users', (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching users' });
    res.json(results);
  });
});

app.post('/api/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const { username, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
    [username, hashedPassword, role],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'Username already exists' });
        }
        return res.status(500).json({ message: 'Error creating user' });
      }
      res.status(201).json({ message: 'User created successfully' });
    }
  );
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting user' });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

// Login route
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const users = await query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login'
    });
  }
});

// Get all news for admin panel
app.get('/api/admin/news', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT n.*, c.name as category_name, u.username as publisher
      FROM news n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.created_by = u.id
      ORDER BY n.created_at DESC
    `;
    
    const [news] = await db.promise().query(query);
    res.json(news);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: 'Error fetching news' });
  }
});

// Get user's own news
app.get('/api/news/my-news', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT n.*, c.name as category_name,
             CASE WHEN u.id IS NULL THEN NULL ELSE u.username END as publisher
      FROM news n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.created_by = u.id
      WHERE n.created_by = ?
      ORDER BY n.created_at DESC
    `;
    
    const [news] = await db.promise().query(query, [req.user.id]);
    res.json(news);
  } catch (error) {
    console.error('Error fetching user news:', error);
    res.status(500).json({ message: 'Error fetching your news' });
  }
});

// Create news (for any authenticated user)
app.post('/api/news', authenticateToken, handleUpload, async (req, res) => {
  console.log('Received news creation request:', {
    body: req.body,
    file: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : null,
    userId: req.user.id
  });

  const { title, content, category_id } = req.body;
  const userId = req.user.id;
  
  try {
    let imageUrl = null;
    if (req.file) {
      try {
        console.log('Attempting S3 upload...');
        imageUrl = await uploadToS3(req.file);
        console.log('S3 upload successful:', imageUrl);
      } catch (uploadError) {
        console.error('S3 Upload Error:', uploadError);
        return res.status(500).json({ 
          message: 'Error uploading image to S3', 
          error: uploadError.message,
          details: uploadError.stack
        });
      }
    }

    console.log('Attempting database insert with data:', {
      title,
      content,
      category_id,
      image_url: imageUrl,
      userId
    });

    const [result] = await db.promise().query(
      'INSERT INTO news (title, content, category_id, image_url, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, content, category_id, imageUrl, userId]
    );

    console.log('Database insert successful:', result);

    res.status(201).json({ 
      message: 'News created successfully',
      newsId: result.insertId,
      imageUrl
    });
  } catch (error) {
    console.error('Database Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      message: 'Error saving news', 
      error: error.message,
      sqlError: error.sqlMessage
    });
  }
});

// Update news (only own news)
app.put('/api/news/:id', authenticateToken, handleUpload, async (req, res) => {
  const newsId = req.params.id;
  const { title, content, category_id } = req.body;
  const userId = req.user.id;
  
  try {
    // Check if news exists and was created by this user
    const [news] = await db.promise().query(
      'SELECT * FROM news WHERE id = ? AND created_by = ?',
      [newsId, userId]
    );
    
    if (!news || news.length === 0) {
      return res.status(403).json({ message: 'You can only edit your own news posts' });
    }

    let imageUrl = news[0].image_url;
    if (req.file) {
      try {
        console.log('Attempting S3 upload for update...');
        imageUrl = await uploadToS3(req.file);
        console.log('S3 upload successful:', imageUrl);
      } catch (uploadError) {
        console.error('S3 Upload Error:', uploadError);
        return res.status(500).json({ 
          message: 'Error uploading image to S3', 
          error: uploadError.message,
          details: uploadError.stack
        });
      }
    }

    const [result] = await db.promise().query(
      'UPDATE news SET title = ?, content = ?, category_id = ?, image_url = ? WHERE id = ?',
      [title, content, category_id, imageUrl, newsId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Failed to update news');
    }

    const updatedNews = {
      id: parseInt(newsId),
      title,
      content,
      category_id,
      image_url: imageUrl,
      created_by: news[0].created_by
    };

    res.json({ 
      message: 'News updated successfully',
      news: updatedNews
    });
  } catch (error) {
    console.error('Error updating news:', error);
    res.status(500).json({ 
      message: 'Error updating news',
      error: error.message,
      sqlError: error.sqlMessage
    });
  }
});

// Delete news (own news or admin)
app.delete('/api/news/:id', authenticateToken, async (req, res) => {
  const newsId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  
  try {
    // Check if the news exists
    const [news] = await db.promise().query(
      'SELECT * FROM news WHERE id = ?',
      [newsId]
    );

    if (!news || news.length === 0) {
      return res.status(404).json({ message: 'News not found' });
    }

    // Check if user is admin or news creator
    if (!isAdmin && news[0].created_by !== userId) {
      return res.status(403).json({ message: 'You can only delete your own news posts' });
    }

    await db.promise().query('DELETE FROM news WHERE id = ?', [newsId]);
    res.json({ message: 'News deleted successfully' });
  } catch (error) {
    console.error('Error deleting news:', error);
    res.status(500).json({ message: 'Error deleting news' });
  }
});

// Get single news item
app.get('/api/news/:id', async (req, res) => {
  try {
    const newsId = req.params.id;
    
    // Increment view count
    await query('UPDATE news SET views = views + 1 WHERE id = ?', [newsId]);
    
    // Get updated news item with view count
    const [news] = await query(`
      SELECT n.*, 
        c.name as category_name, 
        u.username as publisher,
        n.views as view_count
      FROM news n 
      LEFT JOIN categories c ON n.category_id = c.id 
      LEFT JOIN users u ON n.created_by = u.id 
      WHERE n.id = ?
    `, [newsId]);

    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    res.json(news);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: 'Error fetching news' });
  }
});

// Get all news
app.get('/api/news', async (req, res) => {
  try {
    const news = await query(`
      SELECT n.*, 
        c.name as category_name, 
        u.username as publisher,
        n.views as view_count
      FROM news n 
      LEFT JOIN categories c ON n.category_id = c.id 
      LEFT JOIN users u ON n.created_by = u.id 
      ORDER BY n.created_at DESC
    `);
    res.json(news);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: 'Error fetching news' });
  }
});

// Get all news for home page (public endpoint)
app.get('/api/news', async (req, res) => {
  try {
    const query = `
      SELECT n.*, 
        c.name as category_name, 
        u.username as publisher,
        n.views as view_count
      FROM news n 
      LEFT JOIN categories c ON n.category_id = c.id 
      LEFT JOIN users u ON n.created_by = u.id 
      ORDER BY n.created_at DESC
    `;
    
    const [news] = await db.promise().query(query);
    res.json(news);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: 'Error fetching news' });
  }
});

// Delete all news and categories
app.delete('/api/clear-all', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  try {
    // First delete all news since they reference categories
    await query('DELETE FROM news');
    
    // Then delete all categories
    await query('DELETE FROM categories');
    
    // Delete any uploaded images
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.readdirSync(uploadsDir).forEach(file => {
        const filePath = path.join(uploadsDir, file);
        if (file !== '.gitkeep') { // Preserve .gitkeep if it exists
          fs.unlinkSync(filePath);
        }
      });
    }

    res.json({ message: 'Successfully deleted all news and categories' });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ message: 'Error clearing database', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
