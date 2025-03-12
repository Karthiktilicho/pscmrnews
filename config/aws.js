require('dotenv').config();

const awsConfig = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  bucketName: process.env.S3_BUCKET_NAME
};

// Log AWS configuration (without sensitive data)
console.log('AWS Configuration:', {
  region: awsConfig.region,
  bucketName: awsConfig.bucketName,
  hasAccessKey: !!awsConfig.credentials.accessKeyId,
  hasSecretKey: !!awsConfig.credentials.secretAccessKey
});

module.exports = awsConfig;
