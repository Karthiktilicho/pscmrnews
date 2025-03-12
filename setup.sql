-- Create database if not exists
CREATE DATABASE IF NOT EXISTS pscmr_news;

-- Use the database
USE pscmr_news;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create news table
CREATE TABLE IF NOT EXISTS news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  image_url VARCHAR(255),
  category_id INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Insert admin user (password: admin123)
INSERT INTO users (username, password, role)
VALUES ('admin', '$2b$10$8ZXXMq.kQYwQ5R5Eb8MYWOxuEzWG3yKvUJ8nB5QHtU19Jt7J4zKYy', 'admin')
ON DUPLICATE KEY UPDATE password = '$2b$10$8ZXXMq.kQYwQ5R5Eb8MYWOxuEzWG3yKvUJ8nB5QHtU19Jt7J4zKYy', role = 'admin';
