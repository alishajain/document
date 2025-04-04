const db = require('../config/db');

class Document {
  static async create({ title, content, userId, description, filePath }) {
    const [result] = await db.execute(
      `INSERT INTO documents 
      (title, content, user_id, description, file_path, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, content, userId, description, filePath]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT * FROM documents WHERE id = ?`,
      [id]
    );
    return rows[0];
  }

  static async findByUserId(userId) {
    const [rows] = await db.execute(
      `SELECT id, title, description, created_at, updated_at 
       FROM documents WHERE user_id = ? ORDER BY updated_at DESC`,
      [userId]
    );
    return rows;
  }

  static async update(id, { title, content, description, filePath, revisionId }) {
    await db.execute(
      `UPDATE documents 
       SET title = ?, content = ?, description = ?, file_path = ?, revision_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, content, description, filePath, revisionId, id]
    );
  }

  static async addPrivateLink(documentId, userId, token) {
    await db.execute(
      `INSERT INTO document_private_links 
      (document_id, user_id, token, created_at) 
      VALUES (?, ?, ?, NOW())`,
      [documentId, userId, token]
    );
  }

  static async findPrivateLink(documentId, token) {
    const [rows] = await db.execute(
      `SELECT * FROM document_private_links 
       WHERE document_id = ? AND token = ?`,
      [documentId, token]
    );
    return rows[0];
  }

  static async findPublicLink(documentId, token) {
    const [rows] = await db.execute(
      `SELECT * FROM document_public_links 
       WHERE document_id = ? AND token = ? AND expires_at > NOW()`,
      [documentId, token]
    );
    return rows[0];
  }
}

module.exports = Document;