import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ck_reports.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    is_active INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_name TEXT NOT NULL,
    region_id INTEGER NOT NULL,
    category TEXT DEFAULT 'Góp ý chung',
    report_date TEXT NOT NULL, -- YYYY-MM-DD
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS report_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_reports_region ON reports(region_id);
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(report_date);
  CREATE INDEX IF NOT EXISTS idx_images_report ON report_images(report_id);
`);

// Migration for existing databases
try {
  db.exec("ALTER TABLE reports ADD COLUMN category TEXT DEFAULT 'Góp ý chung';");
} catch (e) {
  // Column already exists, safe to ignore
}

// Seed 22 default regions if table is empty
const countStmt = db.prepare('SELECT COUNT(*) as count FROM regions');
const { count } = countStmt.get();

if (count === 0) {
  const insertRegion = db.prepare(`
    INSERT INTO regions (name, code, display_order)
    VALUES (?, ?, ?)
  `);

  for (let i = 1; i <= 22; i++) {
    insertRegion.run(`Khu vực ${i}`, `KV_${i}`, i);
  }
  console.log('Seeded 22 initial regions (Khu vực 1 -> Khu vực 22)');
}

/**
 * Checkpoint WAL and return the database path for backup/download
 */
export const backupDatabase = () => {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (e) {
    console.warn('WAL checkpoint warning:', e.message);
  }
  return dbPath;
};

/**
 * Validate and restore database from uploaded file
 */
export const restoreDatabase = (tempFilePath) => {
  // 1. Verify file is valid SQLite database with required tables
  let testDb;
  try {
    testDb = new DatabaseSync(tempFilePath);
    const integrity = testDb.prepare('PRAGMA integrity_check').get();
    if (!integrity || integrity.integrity_check !== 'ok') {
      throw new Error('File tải lên không phải là cơ sở dữ liệu SQLite hợp lệ.');
    }
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    if (!tables.includes('reports') || !tables.includes('regions')) {
      throw new Error('File không chứa các bảng dữ liệu của hệ thống (thiếu bảng reports hoặc regions).');
    }
  } finally {
    if (testDb) {
      try { testDb.close(); } catch (e) {}
    }
  }

  // 2. Safely swap database file
  const backupTempPath = `${dbPath}.pre_restore.bak`;
  try {
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch (e) {}
    db.close();

    // Keep temporary safety backup
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupTempPath);
    }

    // Overwrite with uploaded file
    fs.copyFileSync(tempFilePath, dbPath);

    // Remove any stale WAL/SHM files
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Reopen database
    db.open();
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');

    // Migration check
    try {
      db.exec("ALTER TABLE reports ADD COLUMN category TEXT DEFAULT 'Góp ý chung';");
    } catch (e) {}

    // Cleanup backup file
    if (fs.existsSync(backupTempPath)) {
      fs.unlinkSync(backupTempPath);
    }

    return { success: true, message: 'Khôi phục cơ sở dữ liệu thành công.' };
  } catch (err) {
    console.error('Error during restoreDatabase:', err);
    // Revert if possible
    if (fs.existsSync(backupTempPath)) {
      try {
        fs.copyFileSync(backupTempPath, dbPath);
        fs.unlinkSync(backupTempPath);
      } catch (revErr) {}
    }
    try {
      db.open();
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA foreign_keys = ON;');
    } catch (reopenErr) {}
    throw err;
  }
};

export { dbPath };
export default db;
