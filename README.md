# News Portal Backend

This is the backend server for the News Portal application, designed to be deployed on AWS EC2.

## Project Structure
```
server/
├── config/
│   └── database.js     # Database configuration
├── middleware/
│   └── auth.js         # Authentication middleware
├── routes/
│   ├── auth.js         # Authentication routes
│   ├── news.js         # News routes
│   └── categories.js   # Categories routes
├── services/
│   └── s3Service.js    # AWS S3 service
├── .env.example        # Example environment variables
├── app.js             # Main application file
└── README.md          # This file
```

## Prerequisites
- Node.js (v14 or higher)
- MySQL Server
- AWS Account with S3 bucket
- PM2 (for production deployment)

## EC2 Deployment Steps

1. **Launch EC2 Instance**
   - Launch an Ubuntu EC2 instance
   - Configure security groups to allow inbound traffic on port 80/443 (HTTP/HTTPS) and 22 (SSH)
   - Create and download your key pair

2. **Connect to EC2**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-public-dns
   ```

3. **Install Dependencies**
   ```bash
   # Update package list
   sudo apt update

   # Install Node.js and npm
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install MySQL
   sudo apt install -y mysql-server

   # Install PM2 globally
   sudo npm install -y pm2 -g
   ```

4. **Configure MySQL**
   ```bash
   # Secure MySQL installation
   sudo mysql_secure_installation

   # Create database and user
   sudo mysql
   CREATE DATABASE pscmr_news;
   CREATE USER 'your_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON pscmr_news.* TO 'your_user'@'localhost';
   FLUSH PRIVILEGES;
   exit;
   ```

5. **Deploy Application**
   ```bash
   # Clone your repository
   git clone your-repository-url
   cd your-repository/server

   # Install dependencies
   npm install

   # Create and configure .env file
   cp .env.example .env
   nano .env  # Edit with your actual values
   ```

6. **Start Application with PM2**
   ```bash
   # Start the application
   pm2 start app.js --name "news-portal"

   # Make PM2 start on boot
   pm2 startup
   pm2 save

   # Monitor the application
   pm2 monit
   ```

7. **Setup Nginx (Optional - for domain routing)**
   ```bash
   # Install Nginx
   sudo apt install -y nginx

   # Configure Nginx
   sudo nano /etc/nginx/sites-available/news-portal

   # Add this configuration:
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }

   # Create symbolic link and restart Nginx
   sudo ln -s /etc/nginx/sites-available/news-portal /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Environment Variables
Create a `.env` file in the root directory with the following variables:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=pscmr_news
JWT_SECRET=your_jwt_secret
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_bucket_name
PORT=5000
```

## Monitoring and Maintenance
- Use `pm2 monit` to monitor the application
- Use `pm2 logs` to view application logs
- Use `pm2 restart news-portal` to restart the application
- Use `pm2 list` to see running applications

## Backup
Set up regular database backups:
```bash
# Create backup script
echo '#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mysqldump -u your_user -p your_password pscmr_news > "$BACKUP_DIR/backup_$TIMESTAMP.sql"' > backup.sh

# Make script executable
chmod +x backup.sh

# Add to crontab (runs daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/backup.sh") | crontab -
```
