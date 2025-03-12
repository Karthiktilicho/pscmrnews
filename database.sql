-- Drop database if exists (be careful with this in production)
DROP DATABASE IF EXISTS pscmr_news;

-- Create database
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
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create news table
CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    category_id INT,
    created_by INT,
    status ENUM('draft', 'published', 'deleted') DEFAULT 'draft',
    published_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default admin user
INSERT INTO users (username, password, role) 
VALUES ('newadmin', '$2b$10$5dwsS5snIRlKu8ka5r5UhuM6WWwpzFx.PwuZoAqJcaF1hiHRfQdWm', 'admin');

-- Insert initial categories
INSERT INTO categories (name, created_by) VALUES 
('Academic News', 1),
('Campus Events', 1),
('Announcements', 1),
('Research Updates', 1),
('Student Activities', 1),
('Faculty News', 1),
('Placements', 1),
('Sports', 1);
