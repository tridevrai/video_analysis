import OpenAI from 'openai';
import dotenv from 'dotenv';
import { imageToBase64 } from './utils.js';

dotenv.config();

/**
 * Detect objects in a single frame using GPT-4 Vision with confidence and context
 * @param {string} imagePath - Path to image file
 * @returns {Promise<Array>} Array of detected objects with name, confidence, and context
 */
export async function detectObjectsInFrame(imagePath) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const base64Image = imageToBase64(imagePath);
  
  const prompt = `You are analyzing a video frame from a content creator.

Detect all visible objects, people, and environments in this image.

Return a JSON object with a single key "objects" containing an array of detected items.
Each object must have:
- name: label of object/entity (e.g., "laptop", "person", "desk")
- confidence: confidence score from 0 to 1 (as a decimal number)
- context: short description of location or appearance in the frame (e.g., "on desk in background", "creator in center frame")

Do not speculate beyond visible content. Use concise labels and descriptive context.
Return ONLY the JSON object, no additional text.`;
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an AI vision analyst analyzing videos from content creators. Analyze frames from creator videos to detect objects, people, and environments. Return detailed, structured information about visible content. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'low' // Use 'low' detail to reduce costs
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.3
    });

    const responseData = JSON.parse(response.choices[0].message.content);
    const objects = responseData.objects || [];

    return objects;
  } catch (error) {
    console.error(`Error detecting objects in ${imagePath}:`, error.message);
    return [];
  }
}

/**
 * Detect objects across multiple frames and aggregate results (business schema format)
 * @param {string[]} framePaths - Array of frame image paths
 * @param {number} sampleRate - Process every Nth frame (default: 1 = all frames)
 * @param {number} fps - Frames per second for timestamp calculation (default: 1)
 * @returns {Promise<Array>} Array of objects grouped by name with appearance_percentage, avg_confidence, and frames
 */
export async function detectObjectsInFrames(framePaths, sampleRate = 1, fps = 1) {
  console.log(`Starting object detection on ${framePaths.length} frames (sampling every ${sampleRate} frame(s))...`);

  const detectionsByFrame = [];

  // Sample frames to reduce API costs
  const sampledFrames = framePaths.filter((_, index) => index % sampleRate === 0);
  
  console.log(`Processing ${sampledFrames.length} sampled frames...`);

  for (let i = 0; i < sampledFrames.length; i++) {
    const framePath = sampledFrames[i];
    const frameNumber = framePaths.indexOf(framePath) + 1;
    
    console.log(`Processing frame ${i + 1}/${sampledFrames.length} (frame #${frameNumber})...`);
    
    const objects = await detectObjectsInFrame(framePath);
    
    // Store per-frame detections with frame metadata
    detectionsByFrame.push({
      frame_id: frameNumber,
      frameFile: framePath.split('/').pop(),
      timestamp: (frameNumber - 1) / fps,
      objects: objects
    });
  }

  // Group objects by name and calculate metrics
  const objectMap = {};
  
  detectionsByFrame.forEach(frameData => {
    frameData.objects.forEach(obj => {
      const objName = obj.name.toLowerCase();
      
      if (!objectMap[objName]) {
        objectMap[objName] = {
          name: objName,
          frames: [],
          confidences: []
        };
      }
      
      objectMap[objName].frames.push({
        frame_id: frameData.frame_id,
        timestamp: frameData.timestamp,
        confidence: obj.confidence,
        context: obj.context
      });
      
      objectMap[objName].confidences.push(obj.confidence);
    });
  });

  // Calculate appearance_percentage and avg_confidence for each object
  const objects_detected = Object.values(objectMap).map(obj => {
    const appearance_percentage = (obj.frames.length / framePaths.length) * 100;
    const avg_confidence = obj.confidences.reduce((sum, conf) => sum + conf, 0) / obj.confidences.length;
    
    return {
      name: obj.name,
      appearance_percentage: Math.round(appearance_percentage * 10) / 10, // Round to 1 decimal
      avg_confidence: Math.round(avg_confidence * 100) / 100, // Round to 2 decimals
      frames: obj.frames
    };
  });

  // Sort by appearance_percentage (most frequent first)
  objects_detected.sort((a, b) => b.appearance_percentage - a.appearance_percentage);

  console.log(`Object detection completed. Found ${objects_detected.length} unique objects.`);

  return objects_detected;
}

