// src/routes/repository.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { requireAuth, requireExecutiveOrAdmin } = require('../middleware/auth'); // <- legacy roles
const { Resource, ResourceCategory } = require('../models');
const analyticsService = require('../services/analyticsService');
const notificationService = require('../services/notificationService');
const layoutHook = require('../views/_layout_hook');

const router = express.Router();
router.use(layoutHook);

const UPLOAD_DIR = path.join('uploads', 'resources');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

/* LIST */
router.get('/', async (req, res) => {
  const q = req.query.q || '';
  const category = req.query.category || '';
  const fileType = req.query.fileType || '';
  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder || 'DESC';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const offset = (page - 1) * limit;

  const where = {};
  const include = [{ model: ResourceCategory, attributes: ['id', 'name', 'slug'] }];

  // Enhanced search functionality
  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
      { fileType: { [Op.like]: `%${q}%` } }
    ];
  }

  // Category filter
  if (category) {
    const catObj = await ResourceCategory.findOne({ where: { slug: category } });
    if (catObj) where.categoryId = catObj.id;
  }

  // File type filter
  if (fileType) {
    where.fileType = fileType;
  }

  // Get categories for filter dropdown
  const categories = await ResourceCategory.findAll({
    order: [['name', 'ASC']]
  });

  // Get file types for filter dropdown
  const fileTypes = await Resource.findAll({
    attributes: ['fileType'],
    group: ['fileType'],
    where: { fileType: { [Op.ne]: null } },
    order: [['fileType', 'ASC']]
  });

  // Get total count for pagination
  const totalCount = await Resource.count({ where, include });

  // Get resources with pagination
  const resources = await Resource.findAll({
    where,
    include,
    order: [[sortBy, sortOrder]],
    limit,
    offset
  });

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.render('repository/list', {
    title: 'Resources',
    resources,
    categories,
    fileTypes: fileTypes.map(ft => ft.fileType).filter(Boolean),
    pagination: {
      currentPage: page,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
      totalCount
    },
    filters: {
      q,
      category,
      fileType,
      sortBy,
      sortOrder
    }
  });
});

/* UPLOAD (form) — legacy role gate */
router.get('/upload', requireAuth, requireExecutiveOrAdmin, async (req, res) => {
  const categories = await ResourceCategory.findAll({ order: [['name', 'ASC']] });
  res.render('repository/upload', { title: 'Upload Resource', categories });
});

/* UPLOAD (submit) — legacy role gate */
router.post(
  '/upload',
  requireAuth,
  requireExecutiveOrAdmin,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        req.flash('error', 'Upload failed. ' + (err.message || ''));
        return res.redirect('/repository/upload');
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { title, description, categoryId } = req.body;
      let { fileType } = req.body;
      if (!req.file) { req.flash('error', 'File is required.'); return res.redirect('/repository/upload'); }

      const category = await ResourceCategory.findByPk(categoryId);
      if (!category) {
        try { fs.unlinkSync(path.join(UPLOAD_DIR, req.file.originalname)); } catch {}
        req.flash('error', 'Please choose a valid category.');
        return res.redirect('/repository/upload');
      }

      const diskPath = path.join(UPLOAD_DIR, req.file.originalname).replace(/\\/g, '/');

      // Normalize fileType to supported values
      const allowedTypes = ['PDF','AUDIO','VIDEO','OTHER'];
      if (!allowedTypes.includes(fileType)) {
        // Infer from extension if possible
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (ext === '.pdf') fileType = 'PDF';
        else if (['.mp3','.wav','.m4a','.ogg'].includes(ext)) fileType = 'AUDIO';
        else if (['.mp4','.webm','.ogg'].includes(ext)) fileType = 'VIDEO';
        else fileType = 'OTHER';
      }

      const resource = await Resource.create({
        title,
        description,
        categoryId: category.id,
        fileType,
        filePath: diskPath,
        uploaderId: res.locals.currentUser.id,
      });

      // Send notification about new resource upload
      await notificationService.notifyResourceUploaded(resource.id, res.locals.currentUser.id);

      req.flash('success', 'Resource uploaded.');
      res.redirect('/repository');
    } catch (e) {
      console.error('Upload handler error:', e);
      req.flash('error', 'Upload failed.');
      res.redirect('/repository/upload');
    }
  }
);

/* PREVIEW */
router.get('/:id/preview', async (req, res) => {
  try {
    const r = await Resource.findByPk(req.params.id, { include: [ResourceCategory] });
    if (!r) { req.flash('error', 'Resource not found.'); return res.redirect('/repository'); }

    const absolute = path.resolve(r.filePath);
    if (!fs.existsSync(absolute)) {
      req.flash('error', 'File not found on server.');
      return res.redirect('/repository');
    }

    const fileExt = path.extname(r.filePath).toLowerCase();
    
    // Track view analytics
    analyticsService.trackEvent('VIEW', req.session.userId, r.id, req);
    
    // Handle different file types
    if (fileExt === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(r.filePath) + '"');
      res.sendFile(absolute);
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt)) {
      res.setHeader('Content-Type', 'image/' + fileExt.slice(1));
      res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(r.filePath) + '"');
      res.sendFile(absolute);
    } else if (['.mp3', '.wav', '.m4a', '.ogg'].includes(fileExt)) {
      res.render('repository/audio-preview', { 
        title: 'Audio Preview', 
        resource: r,
        filePath: `/uploads/resources/${path.basename(r.filePath)}`
      });
    } else if (['.mp4', '.webm', '.ogg'].includes(fileExt)) {
      res.render('repository/video-preview', { 
        title: 'Video Preview', 
        resource: r,
        filePath: `/uploads/resources/${path.basename(r.filePath)}`
      });
    } else {
      // For unsupported preview types, redirect to download
      res.redirect(`/repository/${r.id}/download`);
    }
  } catch (e) {
    console.error('Preview handler error:', e);
    req.flash('error', 'Could not preview file.');
    res.redirect('/repository');
  }
});

/* DOWNLOAD */
router.get('/:id/download', async (req, res) => {
  try {
    const r = await Resource.findByPk(req.params.id);
    if (!r) { req.flash('error', 'Resource not found.'); return res.redirect('/repository'); }

    try { await r.update({ downloads: (typeof r.downloads === 'number' ? r.downloads : 0) + 1 }); } catch {}

    // Track download analytics
    analyticsService.trackEvent('DOWNLOAD', req.session.userId, r.id, req);

    const absolute = path.resolve(r.filePath);
    if (!fs.existsSync(absolute)) {
      req.flash('error', 'File not found on server.');
      return res.redirect('/repository');
    }

    res.download(absolute, path.basename(r.filePath), (err) => {
      if (err) {
        console.error('Download error:', err);
        req.flash('error', 'File unavailable.');
        return res.redirect('/repository');
      }
    });
  } catch (e) {
    console.error('Download handler error:', e);
    req.flash('error', 'Could not download file.');
    res.redirect('/repository');
  }
});

module.exports = router;
