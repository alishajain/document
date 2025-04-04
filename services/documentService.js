const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const mkdirp = require('mkdirp');
const { v4: uuidv4 } = require('uuid');

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'documents');

// Ensure storage directory exists
mkdirp.sync(storagePath);

exports.saveDocumentToStorage = async (file) => {
  if (!file) {
    throw new Error('No file provided');
  }
  
  const fileExtension = path.extname(file.originalname);
  const fileName = `${uuidv4()}${fileExtension}`;
  const filePath = path.join(storagePath, fileName);
  
  await writeFile(filePath, file.buffer);
  
  return filePath;
};

exports.deleteDocumentFromStorage = async (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      await unlink(filePath);
    }
  } catch (error) {
    console.error('Error deleting document file:', error);
    throw error;
  }
};

exports.getDocumentStream = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('File not found');
  }
  return fs.createReadStream(filePath);
};

exports.getDocumentInfo = async (filePath) => {
  try {
    const stats = await promisify(fs.stat)(filePath);
    return {
      size: stats.size,
      lastModified: stats.mtime,
      created: stats.birthtime
    };
  } catch (error) {
    console.error('Error getting document info:', error);
    throw error;
  }
};