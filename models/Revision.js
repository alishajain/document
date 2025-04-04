const db = require('../config/db');

class Revision {
  static async create({ documentId, version, title, content, description, filePath }) {
    const [result] = await db.execute(
      `INSERT INTO revisions 
      (document_id, version, title, content, description, file_path, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [documentId, version, title, content, description, filePath]
    );
    return result.insertId;
  }

  static async countByDocumentId(documentId) {
    const [rows] = await db.execute(
      `SELECT COUNT(*) as count FROM revisions WHERE document_id = ?`,
      [documentId]
    );
    return rows[0].count;
  }

  static async findByDocumentId(documentId) {
    const [rows] = await db.execute(
      `SELECT * FROM revisions WHERE document_id = ? ORDER BY version DESC`,
      [documentId]
    );
    return rows;
  }
}

module.exports = Revision;