import OpenAI from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Transcribe audio file using OpenAI Whisper API with segments
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<object>} Transcription object with full_text, language, and segments
 */
export async function transcribeVideo(audioPath) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log('Starting transcription with segments...');

  try {
    const audioFile = fs.createReadStream(audioPath);
    
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      temperature: 0.0
    });

    console.log('Transcription completed');
    
    // Return structured format for business schema
    return {
      full_text: response.text,
      language: response.language || 'en',
      segments: response.segments || []
    };
  } catch (error) {
    console.error('Error during transcription:', error.message);
    throw error;
  }
}
