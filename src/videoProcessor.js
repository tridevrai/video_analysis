import { createRequire } from 'module';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import path from 'path';
import { ensureDir, getFilesInDir } from './utils.js';

// Use createRequire to import CommonJS modules properly
const require = createRequire(import.meta.url);
const ffmpeg = require('fluent-ffmpeg');

// Configure ffmpeg paths for static binaries
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

/**
 * Extract audio from video file
 * @param {string} videoPath - Path to input video file
 * @param {string} outputPath - Path for output audio file
 * @returns {Promise<string>} Path to extracted audio file
 */
export async function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    ensureDir(outputDir);

    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .format('wav')
      .on('end', () => {
        console.log('Audio extraction completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error extracting audio:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Extract frames from video at specified FPS
 * @param {string} videoPath - Path to input video file
 * @param {string} outputDir - Directory for output frames
 * @param {number} fps - Frames per second to extract (default: 1)
 * @returns {Promise<string[]>} Array of paths to extracted frame images
 */
export async function extractFrames(videoPath, outputDir, fps = 1) {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    ensureDir(outputDir);

    const outputPattern = path.join(outputDir, 'frame-%04d.jpg');

    ffmpeg(videoPath)
      .outputOptions([
        `-vf fps=${fps}`,
        '-q:v 2' // Quality setting for JPEG (2 is high quality)
      ])
      .on('end', () => {
        console.log('Frame extraction completed');
        // Get all extracted frames
        const framePaths = getFilesInDir(outputDir, '.jpg');
        resolve(framePaths);
      })
      .on('error', (err) => {
        console.error('Error extracting frames:', err);
        reject(err);
      })
      .save(outputPattern);
  });
}

/**
 * Get video duration in seconds
 * @param {string} videoPath - Path to video file
 * @returns {Promise<number>} Duration in seconds
 */
export async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

