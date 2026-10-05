const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const gedcomController = require('../controllers/gedcomController');
const { verifyToken } = require('../middleware/authMiddleware');

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// File filter (Max 5MB and .ged extension)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.ged') {
    return cb(new Error('Only .ged files are allowed'), false);
  }
  cb(null, true);
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Import route (protected)
router.post(
  '/import', 
  verifyToken, 
  (req, res, next) => {
    upload.single('file')(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: true, message: err.message });
      } else if (err) {
        return res.status(400).json({ error: true, message: err.message });
      }
      next();
    });
  },
  gedcomController.importGedcom
);

module.exports = router;
