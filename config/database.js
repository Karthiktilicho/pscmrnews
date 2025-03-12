const mysql = require('mysql2');
require('dotenv').config();

const [host, port] = (process.env.DB_HOST || 'localhost:3306').split(':');
const db = mysql.createConnection({
  host: host,
  port: parseInt(port) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'pscmr_news'
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

const initDatabase = () => {
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
    console.log('Connected to MySQL database');

    // Create tables
    const createTables = async () => {
      const tables = [
        `CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role ENUM('admin', 'user') DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          image_url VARCHAR(255),
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )`,
        `CREATE TABLE IF NOT EXISTS news (
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
        )`
      ];

      for (const tableQuery of tables) {
        try {
          await query(tableQuery);
          console.log('Table created successfully');
        } catch (error) {
          console.error('Error creating table:', error);
        }
      }
    };

    createTables();
  });
};

module.exports = { db, query, initDatabase };
