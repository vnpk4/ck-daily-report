import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import apiRouter from './routes/api.js';
import { uploadsBaseDir } from './storage.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Trust reverse proxy (for correct client IP resolution in rate limiting)
app.set('trust proxy', 1);

// CORS - allow local Vite dev server
app.use(cors());

// Parse JSON and urlencoded bodies
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsBaseDir));

// API routes
app.use('/api', apiRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production: Serve built frontend from client/dist
const clientDistDir = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistDir)) {
  console.log('Serving production client build from:', clientDistDir);
  app.use(express.static(clientDistDir));

  // Client-side routing fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDistDir, 'index.html'));
    } else {
      res.status(404).json({ success: false, message: 'Endpoint API không tồn tại.' });
    }
  });
}

// 404 fallback for API in dev mode (when dist doesn't exist)
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint API không tồn tại.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🚀 CK Daily Report Server running on: http://localhost:${PORT}`);
  console.log(`📁 Uploads Directory: ${uploadsBaseDir}`);
  console.log(`=========================================`);
});
