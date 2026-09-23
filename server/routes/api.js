import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import db, { backupDatabase, restoreDatabase, resetDefaultRegions } from '../db.js';
import { upload, restoreUpload } from '../storage.js';
import { streamImagesZip, sanitizeName, getCleanExtension } from '../zipService.js';
import { isCloudinaryConfigured, uploadToCloudinary, deleteFromCloudinary, testCloudinaryConnection } from '../cloudinaryService.js';

const router = express.Router();

// Rate limiter: each guest (by IP) can send at most 6 requests per minute
export const guestReportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 6, // Max 6 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    message: 'Bạn đã gửi yêu cầu quá nhanh. Mỗi người dùng chỉ được gửi tối đa 6 báo cáo trong vòng 1 phút. Vui lòng chờ giây lát rồi thử lại.'
  }
});

// Dynamically read admin PIN from .env on every check (so changes in .env apply immediately without server restart)
export const getAdminPin = () => {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const parsed = dotenv.parse(content);
      if (parsed.ADMIN_PIN) {
        return parsed.ADMIN_PIN.trim();
      }
    }
  } catch (err) {
    console.error('Error reading .env for ADMIN_PIN:', err);
  }
  return (process.env.ADMIN_PIN || '123456').trim();
};

// Default Feedback Categories
export const FEEDBACK_CATEGORIES = [
  'Cài đặt ứng dụng SOS',
  'Thực hiện định danh mức 2',
  'Góp ý cải cách thủ tục hành chính',
  'Góp ý sửa đổi bộ luật hình sự'
];

// Get categories
router.get('/categories', (req, res) => {
  res.json({ success: true, data: FEEDBACK_CATEGORIES });
});

// -------------------------------------------------------------
// 1. Regions APIs
// -------------------------------------------------------------
router.get('/regions', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT id, name, code, display_order, is_active 
      FROM regions 
      WHERE is_active = 1 
      ORDER BY display_order ASC, id ASC
    `);
    const regions = stmt.all();
    res.json({ success: true, data: regions });
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách khu vực.' });
  }
});

// Update region name (Admin)
router.put('/admin/regions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên khu vực không được để trống.' });
    }

    const trimmedName = name.trim();

    // Check if name already exists for other region
    const checkStmt = db.prepare('SELECT id FROM regions WHERE name = ? AND id != ?');
    const existing = checkStmt.get(trimmedName, id);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Tên khu vực này đã tồn tại.' });
    }

    const updateStmt = db.prepare('UPDATE regions SET name = ? WHERE id = ?');
    const result = updateStmt.run(trimmedName, id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khu vực.' });
    }

    res.json({ success: true, message: 'Cập nhật tên khu vực thành công.', name: trimmedName });
  } catch (error) {
    console.error('Error updating region:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật khu vực.' });
  }
});

// Reset regions to 22 default CSKV officers (Admin)
router.post('/admin/regions/reset-defaults', (req, res) => {
  try {
    const pin = req.body?.pin || req.headers['x-admin-pin'];
    const currentPin = getAdminPin();
    if (!pin || String(pin).trim() !== currentPin) {
      return res.status(401).json({ success: false, message: 'Yêu cầu mã PIN quản trị hợp lệ để khôi phục danh sách CSKV.' });
    }

    const updatedRegions = resetDefaultRegions();
    res.json({
      success: true,
      message: 'Đã khôi phục danh sách 22 cán bộ Cảnh sát khu vực mặc định thành công!',
      data: updatedRegions
    });
  } catch (error) {
    console.error('Error resetting regions to default:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi khôi phục danh sách CSKV mặc định.' });
  }
});

// -------------------------------------------------------------
// 2. Submit Report API (Guest)
// Rate limited: max 6 submissions per minute per IP
// Image limit: unlimited images, total <= 25MB per submission
// -------------------------------------------------------------
router.post('/reports', guestReportLimiter, (req, res) => {
  upload.array('images')(req, res, async (err) => {
    if (err) {
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach(f => {
          if (f.path && fs.existsSync(f.path)) {
            try { fs.unlinkSync(f.path); } catch (e) {}
          }
        });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          success: false, 
          message: 'Dung lượng ảnh vượt quá giới hạn 25MB. Vui lòng chọn ảnh nhỏ hơn.' 
        });
      }
      return res.status(400).json({ success: false, message: err.message || 'Lỗi tải ảnh lên.' });
    }

    try {
      const { guest_name, region_id, category, report_date, note } = req.body;

      if (!region_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vui lòng chọn Khu vực / CSKV tiếp nhận báo cáo.' 
        });
      }

      // Check if region exists
      const regionCheck = db.prepare('SELECT id, name FROM regions WHERE id = ?').get(region_id);
      if (!regionCheck) {
        return res.status(400).json({ success: false, message: 'Khu vực được chọn không hợp lệ trong hệ thống.' });
      }

      const finalGuestName = (guest_name && guest_name.trim())
        ? guest_name.trim()
        : (regionCheck.name || 'Cán bộ');

      const rawFiles = req.files || [];
      const files = rawFiles.filter(f => f && f.size > 0 && fs.existsSync(f.path));
      if (files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ràng buộc bắt buộc: Vui lòng đính kèm ít nhất 1 hình ảnh báo cáo/chứng minh hợp lệ.' 
        });
      }

      // Check total size across all files: max 25MB per submission
      const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
      const totalFilesSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalFilesSize > MAX_TOTAL_SIZE) {
        files.forEach(f => {
          if (f.path && fs.existsSync(f.path)) {
            try { fs.unlinkSync(f.path); } catch (e) {}
          }
        });
        return res.status(400).json({ 
          success: false, 
          message: 'Tổng dung lượng các ảnh vượt quá giới hạn 25MB cho mỗi lần gửi.' 
        });
      }

      const dateStr = report_date && /^\d{4}-\d{2}-\d{2}$/.test(report_date)
        ? report_date
        : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

      const selectedCategory = (category && category.trim()) ? category.trim() : FEEDBACK_CATEGORIES[0];

      // Save report with category
      const insertReport = db.prepare(`
        INSERT INTO reports (guest_name, region_id, category, report_date, note)
        VALUES (?, ?, ?, ?, ?)
      `);
      const reportResult = insertReport.run(finalGuestName, region_id, selectedCategory, dateStr, note ? note.trim() : '');
      const reportId = reportResult.lastInsertRowid;

      // Save report images (Cloudinary or local disk)
      const insertImage = db.prepare(`
        INSERT INTO report_images (report_id, original_name, stored_name, file_path, file_size, mime_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const file of files) {
        if (isCloudinaryConfigured) {
          try {
            const cloudRes = await uploadToCloudinary(file.path, dateStr);
            insertImage.run(
              reportId,
              file.originalname,
              cloudRes.public_id,
              cloudRes.url,
              cloudRes.bytes || file.size,
              file.mimetype
            );
          } catch (cloudErr) {
            console.error('Cloudinary upload error, fallback to local:', cloudErr);
            const relativePath = `${dateStr}/${file.filename}`;
            insertImage.run(
              reportId,
              file.originalname,
              relativePath,
              file.path,
              file.size,
              file.mimetype
            );
          }
        } else {
          const relativePath = `${dateStr}/${file.filename}`;
          insertImage.run(
            reportId,
            file.originalname,
            relativePath,
            file.path,
            file.size,
            file.mimetype
          );
        }
      }

      res.status(201).json({
        success: true,
        message: 'Gửi báo cáo hình ảnh thành công!',
        data: {
          reportId,
          guestName: finalGuestName,
          regionName: regionCheck.name,
          category: selectedCategory,
          reportDate: dateStr,
          imageCount: files.length
        }
      });
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lưu báo cáo.' });
    }
  });
});

// -------------------------------------------------------------
// 3. Admin Reports List & Filter
// -------------------------------------------------------------
router.get('/admin/reports', (req, res) => {
  try {
    const { region_id, category, startDate, endDate } = req.query;

    let whereClauses = [];
    let params = [];

    if (region_id && region_id !== 'all') {
      whereClauses.push('r.region_id = ?');
      params.push(Number(region_id));
    }

    if (category && category !== 'all') {
      whereClauses.push('r.category = ?');
      params.push(category);
    }

    if (startDate) {
      whereClauses.push('r.report_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('r.report_date <= ?');
      params.push(endDate);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Fetch reports with category
    const sql = `
      SELECT 
        r.id,
        r.guest_name,
        r.region_id,
        reg.name as region_name,
        r.category,
        r.report_date,
        r.note,
        strftime('%Y-%m-%dT%H:%M:%SZ', r.created_at) as created_at,
        COUNT(img.id) as image_count
      FROM reports r
      JOIN regions reg ON r.region_id = reg.id
      LEFT JOIN report_images img ON r.id = img.report_id
      ${whereSql}
      GROUP BY r.id
      ORDER BY r.report_date DESC, r.created_at DESC
    `;

    const reports = db.prepare(sql).all(...params);

    // If reports exist, fetch image thumbnails for each
    const reportIds = reports.map(r => r.id);
    let imagesByReport = {};

    if (reportIds.length > 0) {
      // Fetch up to 10 images per report
      const placeholders = reportIds.map(() => '?').join(',');
      const imgSql = `
        SELECT id, report_id, original_name, stored_name, file_path, file_size, mime_type,
               strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at,
               strftime('%Y-%m-%d', created_at) as created_date
        FROM report_images 
        WHERE report_id IN (${placeholders})
        ORDER BY id ASC
      `;
      const allImages = db.prepare(imgSql).all(...reportIds);
      for (const img of allImages) {
        if (!imagesByReport[img.report_id]) {
          imagesByReport[img.report_id] = [];
        }
        // Expose public URL for image
        // Stored on disk under /uploads/report_date/stored_name or similar
        const imgUrl = (img.file_path && (img.file_path.startsWith('http://') || img.file_path.startsWith('https://')))
          ? img.file_path
          : `/uploads/${img.stored_name}`;

        imagesByReport[img.report_id].push({
          id: img.id,
          original_name: img.original_name,
          stored_name: img.stored_name,
          file_size: img.file_size,
          mime_type: img.mime_type,
          url: imgUrl
        });
      }
    }

    const enrichedReports = reports.map(rep => ({
      ...rep,
      images: (imagesByReport[rep.id] || []).map(img => ({
        ...img,
        guest_name: rep.guest_name,
        region_name: rep.region_name,
        report_date: rep.report_date,
        download_url: `/api/admin/download-image/${img.id}`
      }))
    }));

    // Calculate total images matching filter
    const totalImages = enrichedReports.reduce((acc, r) => acc + (r.image_count || 0), 0);

    res.json({
      success: true,
      data: enrichedReports,
      meta: {
        totalReports: enrichedReports.length,
        totalImages
      }
    });
  } catch (error) {
    console.error('Error fetching admin reports:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách báo cáo.' });
  }
});

// Delete a report
router.delete('/admin/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get all image file paths first
    const images = db.prepare('SELECT file_path, stored_name FROM report_images WHERE report_id = ?').all(id);

    // Delete physical or cloud files
    for (const img of images) {
      if (img.file_path && (img.file_path.startsWith('http://') || img.file_path.startsWith('https://'))) {
        await deleteFromCloudinary(img.stored_name);
      } else if (img.file_path && fs.existsSync(img.file_path)) {
        try {
          fs.unlinkSync(img.file_path);
        } catch (e) {
          console.warn('Failed to delete file from disk:', img.file_path, e);
        }
      }
    }

    // Delete from database
    const delStmt = db.prepare('DELETE FROM reports WHERE id = ?');
    const result = delStmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.' });
    }

    res.json({ success: true, message: 'Đã xóa báo cáo và các hình ảnh liên quan.' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa báo cáo.' });
  }
});

// -------------------------------------------------------------
// 4. Export ZIP (Pattern B)
// -------------------------------------------------------------
router.get('/admin/export-zip', (req, res) => {
  try {
    const { region_id, category, startDate, endDate } = req.query;

    let whereClauses = [];
    let params = [];

    if (region_id && region_id !== 'all') {
      whereClauses.push('r.region_id = ?');
      params.push(Number(region_id));
    }

    if (category && category !== 'all') {
      whereClauses.push('r.category = ?');
      params.push(category);
    }

    if (startDate) {
      whereClauses.push('r.report_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('r.report_date <= ?');
      params.push(endDate);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Fetch all image records matching filters
    const sql = `
      SELECT 
        img.id,
        img.report_id,
        img.original_name,
        img.stored_name,
        img.file_path,
        img.file_size,
        r.guest_name,
        r.report_date,
        reg.name as region_name
      FROM report_images img
      JOIN reports r ON img.report_id = r.id
      JOIN regions reg ON r.region_id = reg.id
      ${whereSql}
      ORDER BY reg.display_order ASC, r.report_date ASC, r.id ASC, img.id ASC
    `;

    const images = db.prepare(sql).all(...params);

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hình ảnh nào phù hợp với bộ lọc đã chọn.'
      });
    }

    let filenameParts = ['CK_DailyReport'];
    if (region_id && region_id !== 'all') {
      const reg = db.prepare('SELECT name FROM regions WHERE id = ?').get(region_id);
      if (reg) filenameParts.push(reg.name.replace(/\s+/g, '_'));
    }
    if (category && category !== 'all') {
      filenameParts.push(category.replace(/\s+/g, '_').replace(/[/\\:*?"<>|]/g, ''));
    }
    if (startDate && endDate) {
      filenameParts.push(`${startDate}_den_${endDate}`);
    } else if (startDate) {
      filenameParts.push(`tu_${startDate}`);
    } else if (endDate) {
      filenameParts.push(`den_${endDate}`);
    } else {
      filenameParts.push(new Date().toISOString().split('T')[0]);
    }

    const zipFilename = `${filenameParts.join('_')}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`);

    streamImagesZip(images, res);
  } catch (error) {
    console.error('Error generating export ZIP:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi khi xuất file ZIP.' });
    }
  }
});

// -------------------------------------------------------------
// 4b. Download Individual Image with Standardized Clean Filename
// Format: [Khu_Vuc]_[YYYY-MM-DD]_[Ten_Khach]_[ID].[ext]
// Completely prevents duplicate generic filenames like image.jpg
// -------------------------------------------------------------
router.get('/admin/download-image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const img = db.prepare(`
      SELECT 
        img.id,
        img.original_name,
        img.stored_name,
        img.file_path,
        img.file_size,
        img.mime_type,
        r.guest_name,
        r.report_date,
        reg.name as region_name
      FROM report_images img
      JOIN reports r ON img.report_id = r.id
      JOIN regions reg ON r.region_id = reg.id
      WHERE img.id = ?
    `).get(id);

    if (!img) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hình ảnh.' });
    }

    const regionPart = sanitizeName(img.region_name || 'Khu_Vuc');
    const datePart = img.report_date || 'Ngay';
    const guestPart = sanitizeName(img.guest_name || 'Nguoi_Dung');
    const ext = getCleanExtension(img.original_name, img.file_path);
    const downloadFilename = `${regionPart}_${datePart}_${guestPart}_${img.id}${ext}`;

    // Cloudinary / remote URL
    if (img.file_path && (img.file_path.startsWith('http://') || img.file_path.startsWith('https://'))) {
      const response = await fetch(img.file_path);
      if (!response.ok) {
        return res.status(502).json({ success: false, message: 'Không thể tải ảnh từ Cloudinary.' });
      }
      res.setHeader('Content-Type', img.mime_type || response.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

    // Local file on disk
    if (img.file_path && fs.existsSync(img.file_path)) {
      return res.download(img.file_path, downloadFilename);
    }

    return res.status(404).json({ success: false, message: 'File ảnh không tồn tại trên hệ thống.' });
  } catch (error) {
    console.error('Error downloading image:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi khi tải ảnh.' });
    }
  }
});

// -------------------------------------------------------------
// 5. Admin Authentication & Stats
// -------------------------------------------------------------
router.post('/admin/verify-pin', (req, res) => {
  const { pin } = req.body;
  const currentPin = getAdminPin();
  if (pin && String(pin).trim() === currentPin) {
    res.json({ success: true, message: 'Xác thực thành công.' });
  } else {
    res.status(401).json({ success: false, message: 'Mã PIN quản trị không chính xác.' });
  }
});

router.get('/admin/cloudinary-status', async (req, res) => {
  const result = await testCloudinaryConnection();
  res.json({
    configured: isCloudinaryConfigured,
    ...result
  });
});

// Backup Database API (Download .db file)
router.get('/admin/backup-db', (req, res) => {
  const pin = req.query.pin || req.headers['x-admin-pin'];
  const currentPin = getAdminPin();
  if (!pin || String(pin).trim() !== currentPin) {
    return res.status(401).json({ success: false, message: 'Yêu cầu mã PIN quản trị hợp lệ để sao lưu CSDL.' });
  }

  try {
    const dbFile = backupDatabase();
    if (!fs.existsSync(dbFile)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy file CSDL.' });
    }
    const timestamp = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(new Date()).replace(/[/:]/g, '-').replace(', ', '_');
    const filename = `ck_reports_backup_${timestamp}.db`;

    res.download(dbFile, filename);
  } catch (err) {
    console.error('Error backing up database:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi sao lưu CSDL: ' + err.message });
  }
});

// Restore Database API (Upload & apply .db file)
router.post('/admin/restore-db', restoreUpload.single('db_file'), (req, res) => {
  const pin = req.body.pin || req.headers['x-admin-pin'];
  const currentPin = getAdminPin();

  if (!pin || String(pin).trim() !== currentPin) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(401).json({ success: false, message: 'Yêu cầu mã PIN quản trị hợp lệ để khôi phục CSDL.' });
  }

  if (!req.file || !req.file.path) {
    return res.status(400).json({ success: false, message: 'Vui lòng đính kèm file .db để khôi phục.' });
  }

  try {
    const result = restoreDatabase(req.file.path);
    if (fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.json({ success: true, message: 'Khôi phục cơ sở dữ liệu thành công! Toàn bộ dữ liệu đã được phục hồi.' });
  } catch (err) {
    console.error('Error restoring database:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(400).json({ success: false, message: 'Lỗi khôi phục CSDL: ' + err.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const totalReports = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;
    const totalImages = db.prepare('SELECT COUNT(*) as count FROM report_images').get().count;
    const reportsToday = db.prepare('SELECT COUNT(*) as count FROM reports WHERE report_date = ?').get(today).count;
    const imagesToday = db.prepare(`
      SELECT COUNT(img.id) as count 
      FROM report_images img
      JOIN reports r ON img.report_id = r.id
      WHERE r.report_date = ?
    `).get(today).count;

    res.json({
      success: true,
      data: {
        totalReports,
        totalImages,
        reportsToday,
        imagesToday,
        cloudinary: {
          configured: isCloudinaryConfigured,
          cloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME || ''
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải thống kê.' });
  }
});

// -------------------------------------------------------------
// 6. CSKV Leaderboard / Rankings API (Theo ngày, tháng, năm)
// -------------------------------------------------------------
const getCskvRankings = (req, res) => {
  try {
    const { timeRange = 'all', date, month, year, startDate, endDate } = req.query;

    let dateWhere = '';
    let params = [];

    if (timeRange === 'day') {
      const targetDate = date || new Date().toISOString().split('T')[0];
      dateWhere = 'AND r.report_date = ?';
      params.push(targetDate);
    } else if (timeRange === 'month') {
      const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM
      dateWhere = 'AND r.report_date LIKE ?';
      params.push(`${targetMonth}%`);
    } else if (timeRange === 'year') {
      const targetYear = year || new Date().getFullYear().toString(); // YYYY
      dateWhere = 'AND r.report_date LIKE ?';
      params.push(`${targetYear}%`);
    } else if (timeRange === 'custom') {
      let conditions = [];
      if (startDate) {
        conditions.push('r.report_date >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('r.report_date <= ?');
        params.push(endDate);
      }
      if (conditions.length > 0) {
        dateWhere = `AND ${conditions.join(' AND ')}`;
      }
    }

    // 1. Rankings of regions by image count and report count
    const sql = `
      SELECT 
        reg.id as region_id,
        reg.name as region_name,
        reg.code as region_code,
        reg.display_order,
        COUNT(DISTINCT r.id) as report_count,
        COUNT(img.id) as image_count
      FROM regions reg
      LEFT JOIN reports r ON reg.id = r.region_id ${dateWhere}
      LEFT JOIN report_images img ON r.id = img.report_id
      WHERE reg.is_active = 1
      GROUP BY reg.id
      ORDER BY image_count DESC, report_count DESC, reg.display_order ASC
    `;

    const rankings = db.prepare(sql).all(...params);

    // 2. Category breakdowns per region (Calculated by number of uploaded images per category)
    const catSql = `
      SELECT 
        r.region_id,
        r.category,
        COUNT(img.id) as count
      FROM reports r
      JOIN report_images img ON r.id = img.report_id
      WHERE 1=1 ${dateWhere}
      GROUP BY r.region_id, r.category
    `;
    const catRows = db.prepare(catSql).all(...params);
    const catMap = {};
    for (const row of catRows) {
      if (!catMap[row.region_id]) catMap[row.region_id] = {};
      catMap[row.region_id][row.category] = row.count;
    }

    const totalReports = rankings.reduce((sum, r) => sum + (r.report_count || 0), 0);
    const totalImages = rankings.reduce((sum, r) => sum + (r.image_count || 0), 0);

    const enrichedRankings = rankings.map((item, idx) => {
      const imagePercentage = totalImages > 0 ? Math.round((item.image_count / totalImages) * 100) : 0;
      const reportPercentage = totalReports > 0 ? Math.round((item.report_count / totalReports) * 100) : 0;
      return {
        ...item,
        rank: idx + 1,
        categories: catMap[item.region_id] || {},
        imagePercentage,
        reportPercentage,
        percentage: imagePercentage
      };
    });

    res.json({
      success: true,
      data: enrichedRankings,
      meta: {
        totalReports,
        totalImages,
        totalRegions: rankings.length,
        timeRange,
        filterValue: date || month || year || 'all'
      }
    });
  } catch (error) {
    console.error('Error calculating CSKV rankings:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thống kê xếp hạng CSKV.' });
  }
};

router.get('/cskv-rankings', getCskvRankings);
router.get('/admin/cskv-rankings', getCskvRankings);

export default router;
