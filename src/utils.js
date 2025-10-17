import fs from 'fs';
import path from 'path';

/**
 * Ensure a directory exists, create it if it doesn't
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Clean up temporary directory
 */
export function cleanupTempDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Convert image file to base64
 */
export function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

/**
 * Get all files in a directory with a specific extension
 */
export function getFilesInDir(dirPath, extension = '') {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  
  const files = fs.readdirSync(dirPath);
  
  if (extension) {
    return files
      .filter(file => file.endsWith(extension))
      .map(file => path.join(dirPath, file))
      .sort();
  }
  
  return files.map(file => path.join(dirPath, file)).sort();
}

