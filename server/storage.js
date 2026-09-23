import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadsBaseDir = path.resolve(__dirname, '../uploads');

// Ensure base upload directory exists
if (!fs.existsSync(uploadsBaseDir)) {
  fs.mkdirSync(uploadsBaseDir, { recursive: true });
}

// Multer disk storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Group physical storage by report date (or today's date if not provided yet)
    const reportDate = req.body.report_date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.report_date)
      ? req.body.report_date
      : new Date().toISOString().split('T')[0];

    const targetDir = path.join(uploadsBaseDir, reportDate);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `img-${uniqueSuffix}${ext}`);
  }
});

// File filter: accept only image types
const fileFilter = (req, file, cb) => {
  const allowedMime = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/heic',
    'image/heif'
  ];

  if (allowedMime.includes(file.mimetype.toLowerCase()) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`Định dạng tệp không được hỗ trợ (${file.mimetype}). Chỉ chấp nhận file ảnh.`), false);
  }
};

// Max 25MB per upload
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter
});
