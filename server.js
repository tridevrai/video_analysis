import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import our video processing modules
import { extractAudio, extractFrames, getVideoDuration } from './src/videoProcessor.js';
import { transcribeVideo } from './src/transcription.js';
import { detectObjectsInFrames } from './src/objectDetection.js';
import { analyzeSentiment, analyzeSegmentSentiments } from './src/sentiment.js';
import { generateQAPairs } from './src/qaGenerator.js';
import { ensureDir, cleanupTempDir } from './src/utils.js';
import { generateDemoResults } from './src/demoMode.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Only MP4 files are allowed'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Store active processing sessions for progress updates
const activeSessions = new Map();

// Server-Sent Events endpoint for progress updates
app.get('/api/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Store the response object for this session
  activeSessions.set(sessionId, res);
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  
  // Clean up on client disconnect
  req.on('close', () => {
    activeSessions.delete(sessionId);
  });
});

// Helper function to send progress updates
function sendProgress(sessionId, step, message, progress) {
  const res = activeSessions.get(sessionId);
  if (res) {
    res.write(`data: ${JSON.stringify({ type: 'progress', step, message, progress })}\n\n`);
  }
}

// Main processing endpoint
app.post('/api/process', upload.single('video'), async (req, res) => {
  const startTime = Date.now();
  // sessionId is now passed from frontend or generated here
  let tempVideoPath = null;
  let tmpDir = null;

  try {
    // Validate inputs
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const apiKey = req.body.apiKey;
    const sessionId = req.body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const demoMode = req.body.demoMode === 'true' || apiKey === 'demo' || apiKey === 'test';
    
    // Demo mode - no API calls, instant results!
    if (demoMode) {
      console.log('🎭 Running in DEMO MODE - no API calls will be made');
      
      // Send demo mode progress updates with proper timing
      sendProgress(sessionId, 0, 'Demo mode: Analyzing video...', 5);
      
      setTimeout(() => {
        sendProgress(sessionId, 1, 'Demo mode: Simulating audio extraction...', 20);
      }, 500);
      
      setTimeout(() => {
        sendProgress(sessionId, 2, 'Demo mode: Simulating frame extraction...', 40);
      }, 1000);
      
      setTimeout(() => {
        sendProgress(sessionId, 3, 'Demo mode: Simulating transcription...', 60);
      }, 1500);
      
      setTimeout(() => {
        sendProgress(sessionId, 4, 'Demo mode: Simulating object detection...', 80);
      }, 2000);
      
      setTimeout(() => {
        sendProgress(sessionId, 5, 'Demo mode: Simulating sentiment analysis...', 90);
      }, 2500);
      
      setTimeout(() => {
        sendProgress(sessionId, 6, 'Demo mode: Simulating QA generation...', 95);
      }, 3000);
      
      // Wait for all progress updates to be sent
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      const result = generateDemoResults(req.file.originalname);
      result.sessionId = sessionId;
      
      // Cleanup uploaded file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      sendProgress(sessionId, 6, 'Demo processing complete! 🎉', 100);
      return res.json(result);
    }
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return res.status(400).json({ error: 'Invalid OpenAI API key. Use "demo" for demo mode without API calls.' });
    }

    // Set API key for this request
    process.env.OPENAI_API_KEY = apiKey;

    tempVideoPath = req.file.path;
    tmpDir = `./tmp/${Date.now()}`;
    ensureDir(tmpDir);

    console.log(`Processing video: ${req.file.originalname}`);
    sendProgress(sessionId, 0, `Processing video: ${req.file.originalname}`, 5);

    // Get video duration
    const duration = await getVideoDuration(tempVideoPath);
    console.log(`Video duration: ${duration.toFixed(2)} seconds`);
    sendProgress(sessionId, 0, `Video duration: ${duration.toFixed(2)} seconds`, 10);

    // Step 1: Extract audio
    console.log('[1/6] Extracting audio...');
    sendProgress(sessionId, 1, 'Extracting audio from video...', 15);
    const audioPath = path.join(tmpDir, 'audio.wav');
    await extractAudio(tempVideoPath, audioPath);
    sendProgress(sessionId, 1, 'Audio extraction completed', 20);

    // Step 2: Extract frames
    console.log('[2/6] Extracting frames...');
    sendProgress(sessionId, 2, 'Extracting frames from video...', 25);
    const framesDir = path.join(tmpDir, 'frames');
    const framePaths = await extractFrames(tempVideoPath, framesDir, 1);
    console.log(`Extracted ${framePaths.length} frames`);
    sendProgress(sessionId, 2, `Extracted ${framePaths.length} frames`, 30);

    // Step 3: Transcribe
    console.log('[3/6] Transcribing audio...');
    sendProgress(sessionId, 3, 'Transcribing audio with Whisper API...', 35);
    const transcriptionData = await transcribeVideo(audioPath);
    console.log(`Transcript length: ${transcriptionData.full_text.length} characters`);
    sendProgress(sessionId, 3, `Transcription complete (${transcriptionData.full_text.length} characters)`, 40);

    // Step 3.5: Analyze segment sentiments
    console.log('[3.5/6] Analyzing segment sentiments...');
    sendProgress(sessionId, 3, 'Analyzing sentiment for each segment...', 42);
    const segmentSentiments = await analyzeSegmentSentiments(transcriptionData.segments);
    
    // Merge segment sentiments into transcript segments and add speaker
    const enrichedSegments = transcriptionData.segments.map(segment => {
      const sentimentData = segmentSentiments.find(s => s.segment_id === segment.id) || {
        sentiment: 'neutral',
        mood_keywords: ['unknown']
      };
      
      return {
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        speaker: 'creator',
        sentiment: sentimentData.sentiment,
        mood_keywords: sentimentData.mood_keywords
      };
    });
    sendProgress(sessionId, 3, `Segment sentiment analysis complete`, 45);

    // Step 4: Detect objects
    console.log('[4/6] Detecting objects...');
    const sampleRate = framePaths.length <= 30 ? 1 : 2;
    const framesToProcess = Math.ceil(framePaths.length / sampleRate);
    const fps = 1; // We extract at 1 FPS
    sendProgress(sessionId, 4, `Detecting objects in ${framesToProcess} frames with GPT-4 Vision...`, 50);
    const objects_detected = await detectObjectsInFrames(framePaths, sampleRate, fps);
    sendProgress(sessionId, 4, `Found ${objects_detected.length} unique objects`, 65);

    // Step 5: Analyze overall sentiment
    console.log('[5/6] Analyzing overall sentiment...');
    sendProgress(sessionId, 5, 'Analyzing overall sentiment and mood with GPT-4...', 75);
    const sentiment = await analyzeSentiment(transcriptionData.full_text);
    sendProgress(sessionId, 5, `Sentiment: ${sentiment.overall_sentiment}`, 85);

    // Step 6: Generate QA pairs
    console.log('[6/6] Generating QA pairs...');
    sendProgress(sessionId, 6, 'Generating question-answer pairs with GPT-4...', 90);
    const qaPairs = await generateQAPairs(transcriptionData.full_text, 10, enrichedSegments);
    sendProgress(sessionId, 6, `Generated ${qaPairs.length} QA pairs`, 95);

    // Build response in new business schema format
    const result = {
      sessionId: sessionId,
      metadata: {
        videoFile: req.file.originalname,
        videoDuration: duration,
        processedAt: new Date().toISOString(),
        processingTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
      },
      transcript: {
        full_text: transcriptionData.full_text,
        language: transcriptionData.language,
        segments: enrichedSegments
      },
      sentiment: sentiment,
      objects_detected: objects_detected,
      qa_pairs: qaPairs
    };

    console.log('Processing completed successfully');
    sendProgress(sessionId, 6, 'Processing complete! 🎉', 100);

    res.json(result);

  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred during processing',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    // Cleanup
    try {
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
      if (tmpDir) {
        cleanupTempDir(tmpDir);
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
    }
  }
  console.error('Server error:', error);
  res.status(500).json({ error: error.message || 'Internal server error' });
});

// Start server - bind to 0.0.0.0 for CodeSandbox compatibility
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🎬 AI Video Processor Server');
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log();
  console.log('💡 In CodeSandbox: Use the preview URL provided by the platform');
  console.log('Ready to process videos!');
  console.log('='.repeat(60));
});

export default app;

