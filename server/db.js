import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 22 Default CSKV Officer Names in exact order
export const DEFAULT_CSKV_OFFICERS = [
  'Trần Hoàng Bảo',
  'Nguyễn Thành Nên',
  'Mạch Trung Hiếu',
  'Trần Quốc Nhân',
  'Thạch Lai Châu',
  'Lê Trọng Tâm',
  'Nguyễn Hoàng Minh',
  'Nguyễn Trung Nhiệm',
  'Nguyễn Trần Đãng Nguyên',
  'Phạm Duy Thức',
  'Huỳnh Thanh Tấn',
  'Trần Quốc Nhã',
  'Cao Quốc Hội',
  'Nguyễn Trần Khải',
  'Trần Minh Thuy',
  'Vô Quang Tiến',
  'Trần Minh Pho',
  'Trần Thành Vinh',
  'Nguyễn Xuân Trường',
  'Hà Thanh Duy',
  'Phạm Anh Hưng',
  'Huỳnh Minh Kha'
];

const databaseUrl = (process.env.DATABASE_URL || '').trim();
const isPostgres = Boolean(databaseUrl);

let pool = null;
let sqliteDb = null;
let dbPath = '';

// Helper to convert '?' placeholders to PostgreSQL '$1, $2, ...'
function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function flattenParams(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

if (isPostgres) {
  console.log('⚡ Đang kết nối tới Supabase PostgreSQL...');
  const { default: pg } = await import('pg');
  pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  // Test connection and initialize schema
  try {
    const testRes = await pool.query('SELECT NOW()');
    console.log(`✅ Kết nối Supabase PostgreSQL thành công! (Server time: ${testRes.rows[0].now})`);

    // Create tables in PostgreSQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        guest_name TEXT NOT NULL,
        region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
        category TEXT DEFAULT 'Góp ý chung',
        report_date TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS report_images (
        id SERIAL PRIMARY KEY,
        report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_reports_region ON reports(region_id);
      CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(report_date);
      CREATE INDEX IF NOT EXISTS idx_images_report ON report_images(report_id);
    `);

    // Create compatibility functions for strftime in PostgreSQL
    await pool.query(`
      CREATE OR REPLACE FUNCTION strftime(format text, val timestamptz)
      RETURNS text AS $$
      BEGIN
        IF format = '%Y-%m-%dT%H:%M:%SZ' THEN
          RETURN to_char(val AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
        ELSIF format = '%Y-%m-%d' THEN
          RETURN to_char(val, 'YYYY-MM-DD');
        ELSE
          RETURN to_char(val, 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
        END IF;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;

      CREATE OR REPLACE FUNCTION strftime(format text, val timestamp)
      RETURNS text AS $$
      BEGIN
        IF format = '%Y-%m-%dT%H:%M:%SZ' THEN
          RETURN to_char(val, 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
        ELSIF format = '%Y-%m-%d' THEN
          RETURN to_char(val, 'YYYY-MM-DD');
        ELSE
          RETURN to_char(val, 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
        END IF;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // Check if regions table needs initial seed
    const countCheck = await pool.query('SELECT COUNT(*) as count FROM regions');
    if (parseInt(countCheck.rows[0].count, 10) === 0) {
      console.log(`🌱 Đang nạp danh sách ${DEFAULT_CSKV_OFFICERS.length} Cảnh sát khu vực mặc định vào Supabase...`);
      for (let i = 0; i < DEFAULT_CSKV_OFFICERS.length; i++) {
        const order = i + 1;
        await pool.query(
          'INSERT INTO regions (name, code, display_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
          [DEFAULT_CSKV_OFFICERS[i], `KV_${order}`, order]
        );
      }
      console.log('✅ Đã nạp thành công 22 CSKV mặc định lên Supabase!');
    }
  } catch (initErr) {
    console.error('❌ Lỗi khởi tạo Supabase PostgreSQL:', initErr);
  }
} else {
  // Fallback to SQLite (Local environment)
  console.log('📁 Không tìm thấy biến DATABASE_URL, sử dụng SQLite cục bộ (data/ck_reports.db)...');
  const { DatabaseSync } = await import('node:sqlite');
  const dataDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbPath = path.join(dataDir, 'ck_reports.db');
  sqliteDb = new DatabaseSync(dbPath);

  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec('PRAGMA foreign_keys = ON;');

  sqliteDb.exec(`
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
      report_date TEXT NOT NULL,
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

  try {
    sqliteDb.exec("ALTER TABLE reports ADD COLUMN category TEXT DEFAULT 'Góp ý chung';");
  } catch (e) {}

  const countStmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM regions');
  const { count } = countStmt.get();
  if (count === 0) {
    DEFAULT_CSKV_OFFICERS.forEach((name, index) => {
      const order = index + 1;
      sqliteDb.prepare('INSERT INTO regions (name, code, display_order) VALUES (?, ?, ?)').run(name, `KV_${order}`, order);
    });
    console.log(`Seeded ${DEFAULT_CSKV_OFFICERS.length} initial CSKV officers into local SQLite`);
  }
}

/**
 * Unified async DB query runner
 */
export const db = {
  isPostgres,
  
  async all(sql, ...args) {
    const params = flattenParams(args);
    if (isPostgres) {
      const pgSql = toPgSql(sql);
      const res = await pool.query(pgSql, params);
      return res.rows;
    } else {
      return sqliteDb.prepare(sql).all(...params);
    }
  },

  async get(sql, ...args) {
    const params = flattenParams(args);
    if (isPostgres) {
      const pgSql = toPgSql(sql);
      const res = await pool.query(pgSql, params);
      return res.rows[0] || null;
    } else {
      return sqliteDb.prepare(sql).get(...params);
    }
  },

  async run(sql, ...args) {
    const params = flattenParams(args);
    if (isPostgres) {
      let pgSql = sql.trim();
      const upper = pgSql.toUpperCase();
      if (upper.startsWith('INSERT') && !upper.includes('RETURNING')) {
        pgSql = `${pgSql} RETURNING id`;
      }
      pgSql = toPgSql(pgSql);
      const res = await pool.query(pgSql, params);
      return {
        changes: res.rowCount || 0,
        lastInsertRowid: res.rows?.[0]?.id || null,
        rows: res.rows
      };
    } else {
      return sqliteDb.prepare(sql).run(...params);
    }
  },

  async exec(sql) {
    if (isPostgres) {
      return await pool.query(sql);
    } else {
      return sqliteDb.exec(sql);
    }
  },

  prepare(sql) {
    return {
      all: (...args) => db.all(sql, ...args),
      get: (...args) => db.get(sql, ...args),
      run: (...args) => db.run(sql, ...args)
    };
  }
};

/**
 * Reset regions to default 22 CSKV officers
 */
export const resetDefaultRegions = async () => {
  if (isPostgres) {
    for (let index = 0; index < DEFAULT_CSKV_OFFICERS.length; index++) {
      const name = DEFAULT_CSKV_OFFICERS[index];
      const order = index + 1;
      const checkRes = await pool.query('SELECT id FROM regions WHERE display_order = $1', [order]);
      if (checkRes.rows.length > 0) {
        await pool.query('UPDATE regions SET name = $1 WHERE display_order = $2', [name, order]);
      } else {
        await pool.query(
          'INSERT INTO regions (name, code, display_order) VALUES ($1, $2, $3)',
          [name, `KV_${order}`, order]
        );
      }
    }
    const res = await pool.query('SELECT id, name, code, display_order FROM regions ORDER BY display_order ASC');
    return res.rows;
  } else {
    const checkOrder = sqliteDb.prepare('SELECT id FROM regions WHERE display_order = ?');
    const updateRegion = sqliteDb.prepare('UPDATE regions SET name = ? WHERE display_order = ?');
    const insertRegion = sqliteDb.prepare(`
      INSERT INTO regions (name, code, display_order)
      VALUES (?, ?, ?)
    `);

    DEFAULT_CSKV_OFFICERS.forEach((name, index) => {
      const order = index + 1;
      const existing = checkOrder.get(order);
      if (existing) {
        updateRegion.run(name, order);
      } else {
        insertRegion.run(name, `KV_${order}`, order);
      }
    });

    return sqliteDb.prepare('SELECT id, name, code, display_order FROM regions ORDER BY display_order ASC').all();
  }
};

/**
 * Backup Database
 */
export const backupDatabase = async () => {
  if (isPostgres) {
    // Return export object for Postgres
    const regions = (await pool.query('SELECT * FROM regions ORDER BY display_order ASC')).rows;
    const reports = (await pool.query('SELECT * FROM reports ORDER BY id ASC')).rows;
    const reportImages = (await pool.query('SELECT * FROM report_images ORDER BY id ASC')).rows;
    return {
      type: 'postgres_json',
      data: {
        exportedAt: new Date().toISOString(),
        regions,
        reports,
        reportImages
      }
    };
  } else {
    try {
      sqliteDb.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (e) {
      console.warn('WAL checkpoint warning:', e.message);
    }
    return { type: 'sqlite_file', path: dbPath };
  }
};

/**
 * Restore Database
 */
export const restoreDatabase = async (tempFilePath) => {
  if (isPostgres) {
    throw new Error('Supabase PostgreSQL đã hỗ trợ sao lưu tự động và lưu trữ vĩnh viễn trên đám mây.');
  }

  // SQLite restore logic
  const backupTempPath = `${dbPath}.pre_restore.bak`;
  try {
    try { sqliteDb.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch (e) {}
    sqliteDb.close();

    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupTempPath);
    }
    fs.copyFileSync(tempFilePath, dbPath);

    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    sqliteDb.open();
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA foreign_keys = ON;');

    if (fs.existsSync(backupTempPath)) {
      fs.unlinkSync(backupTempPath);
    }
    return { success: true, message: 'Khôi phục cơ sở dữ liệu thành công.' };
  } catch (err) {
    console.error('Error during restoreDatabase:', err);
    throw err;
  }
};

export { dbPath };
export default db;
