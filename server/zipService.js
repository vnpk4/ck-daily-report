import archiver from 'archiver';
import fs from 'node:fs';
import path from 'node:path';

// Clean string for safe folder and file names
export function sanitizeName(name) {
  if (!name) return 'Unknown';
  return name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Remove illegal path chars
    .replace(/\s+/g, '_'); // Replace spaces with underscore for clean folder paths
}

/**
 * Extracts and cleans image extension safely
 */
export function getCleanExtension(originalName, filePath) {
  let ext = '';
  if (originalName) {
    ext = path.extname(originalName).split('?')[0].toLowerCase();
  }
  if (!ext && filePath) {
    ext = path.extname(filePath).split('?')[0].toLowerCase();
  }
  if (!ext || ext.length > 5 || !/^\.[a-z0-9]+$/i.test(ext)) {
    ext = '.jpg';
  }
  return ext;
}

/**
 * Creates and streams a ZIP file adhering to Pattern B:
 * [Tên_Khu_Vực] / [YYYY-MM-DD] / [Tên_Khách]_[01..10].[ext]
 * 
 * Ensures all files have unique sequential names per guest in each folder,
 * completely preventing duplicate filenames or overwriting.
 * 
 * @param {Array} images - List of image records with region_name, report_date, guest_name, file_path, original_name
 * @param {Response} res - Express response object for streaming
 */
export async function streamImagesZip(images, res) {
  const archive = archiver('zip', {
    zlib: { level: 6 } // Good compression & speed balance
  });

  archive.on('error', (err) => {
    console.error('ZIP Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi khi đóng gói file ZIP.' });
    }
  });

  archive.pipe(res);

  // Track counts per guest in each region+date folder to generate _01, _02, _03...
  const counterMap = new Map();
  const usedZipPaths = new Set();

  for (const img of images) {
    const regionFolder = sanitizeName(img.region_name || 'Khu_Vuc_Khac');
    const dateFolder = img.report_date || 'Ngay_Khong_Xac_Dinh';
    const guestPrefix = sanitizeName(img.guest_name || 'Nguoi_Dung');

    // Grouping key: region + date + guest
    const guestKey = `${regionFolder}/${dateFolder}/${guestPrefix}`;
    let currentIndex = counterMap.get(guestKey) || 0;

    const ext = getCleanExtension(img.original_name, img.file_path);
    
    // Pattern B filename: Khu_Vuc_1/2026-09-23/NguyenVanA_01.jpg
    // Sequential counter with collision prevention
    let zipInternalPath;
    do {
      currentIndex += 1;
      const indexPadded = String(currentIndex).padStart(2, '0');
      zipInternalPath = `${regionFolder}/${dateFolder}/${guestPrefix}_${indexPadded}${ext}`;
    } while (usedZipPaths.has(zipInternalPath));

    counterMap.set(guestKey, currentIndex);
    usedZipPaths.add(zipInternalPath);

    // Case 1: Remote URL (Cloudinary / Cloud Storage)
    if (img.file_path && (img.file_path.startsWith('http://') || img.file_path.startsWith('https://'))) {
      try {
        const response = await fetch(img.file_path);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          archive.append(Buffer.from(arrayBuffer), { name: zipInternalPath });
        } else {
          console.warn(`Failed to fetch cloud image (${response.status}): ${img.file_path}`);
        }
      } catch (err) {
        console.error(`Error downloading cloud image for zip: ${img.file_path}`, err);
      }
    } 
    // Case 2: Local file on disk
    else if (img.file_path && fs.existsSync(img.file_path)) {
      archive.file(img.file_path, { name: zipInternalPath });
    } else {
      console.warn(`File not found, skipping: ${img.file_path}`);
    }
  }

  archive.finalize();
}
