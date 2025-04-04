const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const Document = require("../models/Document");
const db = require("../config/db");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Verify connection configuration
transporter.verify((error) => {
  if (error) {
    console.error("Email server connection error:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

/**
 * Send document link via email
 * @param {string} email - Recipient email
 * @param {string} documentUrl - Document access URL
 * @param {Date} expiresAt - Link expiration time
 */
const sendDocumentLink = async (email, documentUrl, expiresAt) => {
  try {
    const mailOptions = {
      from: `"Document Management System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Document Shared With You",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50;">Document Shared With You</h2>
            <p>You've been given access to a document in the Document Management System.</p>
            
            <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin: 20px 0;">
              <p><strong>Important:</strong> This link will expire on ${expiresAt.toLocaleString()}.</p>
              <a href="${documentUrl}" 
                 style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; 
                        text-decoration: none; border-radius: 5px; margin: 10px 0;">
                Access Document
              </a>
            </div>
            
            <p>If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all;">${documentUrl}</p>
            
            <p style="margin-top: 20px; font-size: 0.9em; color: #7f8c8d;">
              This is an automated message. Please do not reply directly to this email.
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email}`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

/**
 * Generate and store a secure document access token
 * @param {number} documentId
 * @param {number} userId
 * @returns {string} Generated token
 */
const generateAccessToken = async (documentId, userId) => {
  const token = jwt.sign(
    { docId: documentId, userId },
    process.env.JWT_SECRET,
    { expiresIn: "1m" }
  );

  // Store token in database
  await db.execute(
    "INSERT INTO document_tokens (document_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 MINUTE))",
    [documentId, token]
  );

  return token;
};

/**
 * Controller for sharing document via email
 */
exports.shareDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { email } = req.body;
    const userId = req.user.id;

    // Validate document ownership
    const [document] = await db.execute(
      "SELECT * FROM documents WHERE id = ? AND user_id = ?",
      [documentId, userId]
    );

    if (document.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Document not found or access denied",
      });
    }

    // Generate secure token
    const token = await generateAccessToken(documentId, userId);
    const documentUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/documents/${documentId}/access?token=${token}`;

    // Send email
    const result = await sendDocumentLink(
      email,
      documentUrl,
      new Date(Date.now() + 60000)
    );

    res.json({
      success: true,
      message: "Document shared successfully",
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Error in shareDocument:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to share document",
    });
  }
};

/**
 * Controller for verifying document access token
 */
exports.verifyToken = async (req, res) => {
  try {
    const { token } = req.query;

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check database for valid token
    const [tokenRecord] = await db.execute(
      "SELECT * FROM document_tokens WHERE token = ? AND expires_at > NOW()",
      [token]
    );

    if (tokenRecord.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    // Get document
    const [document] = await db.execute(
      "SELECT * FROM documents WHERE id = ?",
      [decoded.docId]
    );

    if (document.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    res.json({
      success: true,
      document: {
        id: document[0].id,
        title: document[0].title,
        description: document[0].description,
        createdAt: document[0].created_at,
      },
    });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
};

module.exports = exports;
