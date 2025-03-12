module.exports = {
  apps: [{
    name: 'pscmr-news',
    script: 'server.js',
    watch: true,
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 5000,
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_USER: process.env.DB_USER || 'root',
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_NAME: process.env.DB_NAME || 'pscmrnews'
    }
  }]
}
