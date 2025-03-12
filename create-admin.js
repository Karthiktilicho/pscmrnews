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

async function createAdmin() {
  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const query = `
    INSERT INTO users (username, password, role) 
    VALUES ('newadmin', ?, 'admin')
    ON DUPLICATE KEY UPDATE password = ?
  `;
  
  db.query(query, [hashedPassword, hashedPassword], (err, result) => {
    if (err) {
      console.error('Error creating admin:', err);
    } else {
      console.log('Admin user created successfully!');
      console.log('Username: newadmin');
      console.log('Password: admin123');
    }
    process.exit();
  });
}

createAdmin();
