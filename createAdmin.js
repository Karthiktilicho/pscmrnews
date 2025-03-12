const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = mysql.createConnection({
  host: '172.31.0.100',
  port: 3306,
  user: 'root',
  password: 'place-your-password-here',
  database: 'pscmrnews'
});

const adminUser = {
  username: 'admin',
  password: 'admin123', // This will be hashed
  role: 'admin'
};

async function createAdminUser() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(adminUser.password, 10);

    // Create users table if it doesn't exist
    const createTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.query(createTable, (err) => {
      if (err) {
        console.error('Error creating table:', err);
        process.exit(1);
      }

      // Insert admin user
      const insertAdmin = `
        INSERT INTO users (username, password, role)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE password = ?, role = 'admin'
      `;

      db.query(
        insertAdmin,
        [adminUser.username, hashedPassword, adminUser.role, hashedPassword],
        (err, result) => {
          if (err) {
            console.error('Error creating admin user:', err);
          } else {
            console.log('Admin user created successfully!');
            console.log('Username:', adminUser.username);
            console.log('Password:', adminUser.password);
          }
          process.exit(0);
        }
      );
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createAdminUser();
