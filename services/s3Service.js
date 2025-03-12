const { 
  S3Client, 
  PutObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const awsConfig = require('../config/aws');

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.credentials.accessKeyId,
    secretAccessKey: awsConfig.credentials.secretAccessKey
  }
});

const uploadToS3 = async (file) => {
  if (!file || !file.buffer) {
    throw new Error('Invalid file: No file buffer provided');
  }

  try {
    console.log('Starting S3 upload with config:', {
      region: awsConfig.region,
      bucket: awsConfig.bucketName,
      fileInfo: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }
    });

    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const fileName = `${timestamp}-${uuidv4()}.${fileExtension}`;
    const key = `news-images/${fileName}`;

    // Upload the file using PutObject
    const uploadParams = {
      Bucket: awsConfig.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    };

    console.log('Uploading file to S3...');
    await s3Client.send(new PutObjectCommand(uploadParams));

    // Generate a presigned URL for reading the file
    const getObjectParams = {
      Bucket: awsConfig.bucketName,
      Key: key
    };
    const command = new GetObjectCommand(getObjectParams);
    const imageUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 * 24 * 7 }); // URL valid for 7 days

    console.log('Successfully uploaded to S3, presigned URL:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('Error uploading to S3:', {
      error: error.message,
      stack: error.stack,
      code: error.$metadata?.httpStatusCode
    });
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

module.exports = { uploadToS3 };
