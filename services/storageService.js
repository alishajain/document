const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const mkdirp = require("mkdirp");
const { v4: uuidv4 } = require("uuid");
const mime = require("mime-types");
const sanitizeFilename = require("sanitize-filename");
const db = require("../config/db");
const logger = require("../utils/logger");

// Promisify file system methods
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

class StorageService {
  constructor() {
    this.storagePath =
      process.env.STORAGE_PATH || path.join(process.cwd(), "documents");
    this.allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/rtf",
      "application/vnd.oasis.opendocument.text",
    ];
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB default
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await mkdirp(this.storagePath);
      logger.info(`Storage directory initialized at: ${this.storagePath}`);
    } catch (err) {
      logger.error("Failed to initialize storage directory:", err);
      throw err;
    }
  }

  async saveDocument(file, userId) {
    try {
      // Validate file input
      if (!file || !file.buffer || !file.originalname) {
        throw new Error("Invalid file upload");
      }

      // Validate file size
      if (file.size > this.maxFileSize) {
        throw new Error(`File size exceeds limit of ${this.maxFileSize} bytes`);
      }

      // Validate MIME type
      const mimeType = mime.lookup(file.originalname);
      if (!this.allowedMimeTypes.includes(mimeType)) {
        throw new Error("Unsupported file type");
      }

      // Sanitize filename
      const sanitizedFilename = sanitizeFilename(
        path.basename(file.originalname)
      );
      const fileExtension = path.extname(sanitizedFilename);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(this.storagePath, uniqueFilename);

      // Write file to storage
      await writeFile(filePath, file.buffer);

      // Get file stats for metadata
      const fileStats = await stat(filePath);

      return {
        originalName: sanitizedFilename,
        storageName: uniqueFilename,
        filePath,
        mimeType,
        size: fileStats.size,
        createdAt: fileStats.birthtime,
        updatedAt: fileStats.mtime,
      };
    } catch (err) {
      logger.error("Failed to save document:", err);
      throw err;
    }
  }

  async getDocumentStream(filePath) {
    try {
      // Validate file path
      if (!filePath || typeof filePath !== "string") {
        throw new Error("Invalid file path");
      }

      // Check if file exists
      const exists = fs.existsSync(filePath);
      if (!exists) {
        throw new Error("File not found");
      }

      // Create read stream
      const stream = fs.createReadStream(filePath);
      const stats = await stat(filePath);

      return {
        stream,
        stats,
      };
    } catch (err) {
      logger.error("Failed to get document stream:", err);
      throw err;
    }
  }

  async deleteDocument(filePath) {
    try {
      if (!filePath) return;

      // Check if file exists before deletion
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
        logger.info(`Deleted file: ${filePath}`);
        return true;
      }
      return false;
    } catch (err) {
      logger.error("Failed to delete document:", err);
      throw err;
    }
  }

  async cleanupOrphanedFiles() {
    try {
      const files = await readdir(this.storagePath);
      const [dbDocuments] = await db.execute("SELECT file_path FROM documents");

      const dbFilePaths = dbDocuments.map((doc) =>
        path.basename(doc.file_path)
      );

      const orphanedFiles = files.filter((file) => !dbFilePaths.includes(file));

      for (const file of orphanedFiles) {
        const filePath = path.join(this.storagePath, file);
        await this.deleteDocument(filePath);
      }

      logger.info(`Cleaned up ${orphanedFiles.length} orphaned files`);
      return orphanedFiles.length;
    } catch (err) {
      logger.error("Failed to cleanup orphaned files:", err);
      throw err;
    }
  }

  async getStorageUsage() {
    try {
      const files = await readdir(this.storagePath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.storagePath, file);
        const stats = await stat(filePath);
        totalSize += stats.size;
      }

      return {
        fileCount: files.length,
        totalSize,
        humanReadableSize: this.bytesToSize(totalSize),
      };
    } catch (err) {
      logger.error("Failed to get storage usage:", err);
      throw err;
    }
  }

  bytesToSize(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Byte";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
  }
}

module.exports = new StorageService();
