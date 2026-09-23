import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs';

// Helper to extract credentials supporting different naming formats
const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME || '').trim();
const apiKey = (process.env.CLOUDINARY_API_KEY || process.env['API KEY'] || process.env.API_KEY || '').trim();
const apiSecret = (process.env.CLOUDINARY_API_SECRET || process.env['SECRET KEY'] || process.env.SECRET_KEY || process.env.API_SECRET || '').trim();
const cloudinaryUrl = (process.env.CLOUDINARY_URL || '').trim();

let isCloudinaryConfigured = Boolean(cloudinaryUrl || (cloudName && apiKey && apiSecret));

if (cloudinaryUrl) {
  cloudinary.config({
    cloudinary_url: cloudinaryUrl,
    secure: true,
    timeout: 10000
  });
  console.log('☁️ Cloudinary Storage is CONFIGURED and ACTIVE (via CLOUDINARY_URL)!');
} else if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
    timeout: 10000
  });
  console.log(`☁️ Cloudinary Storage is CONFIGURED and ACTIVE! (Cloud: ${cloudName})`);
} else {
  console.log('📁 Cloudinary chưa được cấu hình đầy đủ, tạm thời sử dụng bộ nhớ cục bộ (local disk).');
  if (apiKey && apiSecret && !cloudName) {
    console.warn('⚠️ Cảnh báo Cloudinary: Đã có API KEY và SECRET KEY, nhưng ĐANG THIẾU CLOUDINARY_CLOUD_NAME trong file .env!');
  }
}

export { isCloudinaryConfigured, cloudinary };

/**
 * Kiểm tra kết nối tới máy chủ Cloudinary
 */
export async function testCloudinaryConnection() {
  if (!isCloudinaryConfigured) {
    return { success: false, message: 'Cloudinary chưa được cấu hình (thiếu CLOUDINARY_CLOUD_NAME hoặc API KEY/SECRET).' };
  }
  try {
    const res = await cloudinary.api.ping();
    return { success: true, message: 'Kết nối Cloudinary thành công!', data: res };
  } catch (error) {
    return { success: false, message: error.message || 'Không thể kết nối tới Cloudinary.' };
  }
}


/**
 * Uploads a local file (from multer temp) to Cloudinary
 * @param {string} localFilePath - Path on disk from multer
 * @param {string} folderDate - Date string YYYY-MM-DD
 * @returns {Promise<{ url: string, public_id: string, bytes: number }>}
 */
export async function uploadToCloudinary(localFilePath, folderDate = 'general') {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary is not configured');
  }

  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: `cand_reports/${folderDate}`,
      resource_type: 'image',
      quality: 'auto:good' // Auto-compress to save bandwidth while keeping great clarity
    });

    // Optionally remove temporary local file after successful upload to cloud
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (e) {
        // Ignore temp file cleanup error
      }
    }

    return {
      url: result.secure_url,
      public_id: result.public_id,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

/**
 * Deletes an image from Cloudinary by its public_id
 * @param {string} publicId
 */
export async function deleteFromCloudinary(publicId) {
  if (!isCloudinaryConfigured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn('Failed to delete from Cloudinary:', publicId, error);
  }
}
