const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const mkdirp = require("mkdirp");
const writeFile = promisify(fs.writeFile);

const storagePath =
  process.env.STORAGE_PATH || path.join(process.cwd(), "documents");

// Checks for storage directory
mkdirp.sync(storagePath);

exports.getStoragePath = () => storagePath;

exports.initializeStorage = () => {
  if (!fs.existsSync(storagePath)) {
    mkdirp.sync(storagePath);
    console.log(`Created storage directory at ${storagePath}`);
  }
};

exports.cleanupStorage = async (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    await promisify(fs.unlink)(filePath);
  }
};
