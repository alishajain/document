const Document = require("../models/Document");
const Revision = require("../models/Revision");
const documentService = require("../services/documentService");
const emailService = require("../services/emailService");
const { v4: uuidv4 } = require("uuid");

exports.uploadDocument = async (req, res) => {
  try {
    const { title, content, description } = req.body;
    const userId = req.user.id;

    const filePath = await documentService.saveDocumentToStorage(req.file);

    const documentId = await Document.create({
      title,
      content,
      userId,
      description,
      filePath,
    });

    const document = await Document.findById(documentId);

    res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, description } = req.body;
    const userId = req.user.id;

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.user_id !== userId) {
      return res
        .status(403)
        .json({ error: "Unauthorized to update this document" });
    }

    let revisionId = null;

    // Check if description changed
    if (description !== document.description) {
      const version = (await Revision.countByDocumentId(id)) + 1;

      // Create new revision
      revisionId = await Revision.create({
        documentId: id,
        version,
        title: document.title,
        content: document.content,
        description: document.description,
        filePath: document.file_path,
      });
    }

    // Update document
    const updateData = {
      title: title || document.title,
      content: content || document.content,
      description: description || document.description,
      revisionId,
    };

    if (req.file) {
      documentService.deleteDocumentFromStorage(document.file_path);
      updateData.filePath = await documentService.saveDocumentToStorage(
        req.file
      );
    }

    await Document.update(id, updateData);

    const updatedDocument = await Document.findById(id);

    res.json({
      success: true,
      data: updatedDocument,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getDocumentList = async (req, res) => {
  try {
    const userId = req.user.id;

    const documents = await Document.findByUserId(userId);

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getDocumentUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const documentUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/documents/${id}/file`;

    res.json({
      success: true,
      data: {
        url: documentUrl,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.shareDocumentViaEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const userId = req.user.id;

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.user_id !== userId) {
      return res
        .status(403)
        .json({ error: "Unauthorized to share this document" });
    }

    // Generate a temporary public URL (expires in 1 minute)
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60000); // 1 minute

    await db.execute(
      `INSERT INTO document_public_links 
      (document_id, token, expires_at, created_at) 
      VALUES (?, ?, ?, NOW())`,
      [id, token, expiresAt]
    );

    const publicUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/documents/${id}/public?token=${token}`;

    // Send email
    await emailService.sendDocumentLink(email, publicUrl, expiresAt);

    res.json({
      success: true,
      message: "Document shared successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.generatePrivateLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: shareWithUserId } = req.body;
    const userId = req.user.id;

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.user_id !== userId) {
      return res
        .status(403)
        .json({ error: "Unauthorized to share this document" });
    }

    // Generate a private access token
    const token = uuidv4();

    // Add private link
    await Document.addPrivateLink(id, shareWithUserId, token);

    const privateUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/documents/${id}/private?token=${token}`;

    res.json({
      success: true,
      data: {
        url: privateUrl,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.serveDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).send("Document not found");
    }

    // Check if user is owner or has access
    if (req.user && req.user.id === document.user_id) {
      const fileStream = documentService.getDocumentStream(document.file_path);
      fileStream.pipe(res);
    } else {
      return res.status(403).send("Unauthorized");
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.servePublicDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    const publicLink = await Document.findPublicLink(id, token);
    if (!publicLink) {
      return res.status(403).send("Invalid or expired link");
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).send("Document not found");
    }

    const fileStream = documentService.getDocumentStream(document.file_path);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.servePrivateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    const privateLink = await Document.findPrivateLink(id, token);
    if (!privateLink) {
      return res.status(403).send("Invalid link");
    }

    // Check if current user matches the link's user (if authenticated)
    if (req.user && req.user.id !== privateLink.user_id) {
      return res.status(403).send("Unauthorized");
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).send("Document not found");
    }

    const fileStream = documentService.getDocumentStream(document.file_path);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).send(error.message);
  }
};
