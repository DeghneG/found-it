const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image and video files are allowed'));
  }
});

// Accept both 'file' and 'image' field names
router.post('/', requireAuth, (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const file = req.files && req.files[0];
      if (!file) return res.status(400).json({ error: 'No file uploaded' });
      const fileUrl = `/uploads/${file.filename}`;
      const isVideo = file.mimetype.startsWith('video/');
      // Return both formats for backward compatibility
      res.json({ success: true, url: fileUrl, imageUrl: fileUrl, type: isVideo ? 'video' : 'image' });
    } catch (err) { res.status(500).json({ error: 'Upload failed' }); }
  });
});

module.exports = router;
