const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const emailController = require('../controllers/emailController');
const authMiddleware = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

// Document CRUD routes
router.post('/documents', 
  authMiddleware, 
  uploadMiddleware.single('file'), 
  documentController.uploadDocument
);

router.put('/documents/:id', 
  authMiddleware, 
  uploadMiddleware.single('file'), 
  documentController.updateDocument
);

router.get('/documents', 
  authMiddleware, 
  documentController.getDocumentList
);

router.get('/documents/:id/url', 
  authMiddleware, 
  documentController.getDocumentUrl
);

// Document sharing routes
router.post('/documents/:id/share', 
  authMiddleware, 
  emailController.shareDocument
);

router.post('/documents/:id/private-link', 
  authMiddleware, 
  documentController.generatePrivateLink
);

// Document access routes
router.get('/documents/:id/file', 
  documentController.serveDocument
);

router.get('/documents/:id/public', 
  documentController.servePublicDocument
);

router.get('/documents/:id/private', 
  documentController.servePrivateDocument
);

// Token verification route
router.get('/documents/verify-token', 
  emailController.verifyToken
);

module.exports = router;