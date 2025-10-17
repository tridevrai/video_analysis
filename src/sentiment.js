import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Analyze overall sentiment and mood of video transcript using GPT-4
 * @param {string} transcript - Video transcript text
 * @returns {Promise<object>} Sentiment analysis with overall_sentiment, mood_keywords, confidence, and short_summary
 */
export async function analyzeSentiment(transcript) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log('Starting overall sentiment analysis...');

  const prompt = `You are analyzing a video transcript from a content creator.

Analyze the overall sentiment and mood of this transcript.

Return a JSON object with these exact keys:
- overall_sentiment: "positive", "neutral", or "negative"
- mood_keywords: array of 1-3 descriptive words (e.g., ["cheerful", "friendly", "excited"])
- confidence: confidence score from 0 to 1 (as a decimal number)
- short_summary: 1-2 sentence description of emotional tone

Focus only on the transcript content. Do not assume external context.

Transcript:
${transcript}

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a video sentiment analyst specializing in creator content. Analyze emotional tone and mood from video transcripts. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const sentimentData = JSON.parse(response.choices[0].message.content);
    
    console.log('Overall sentiment analysis completed');
    
    return sentimentData;
  } catch (error) {
    console.error('Error during sentiment analysis:', error.message);
    
    // Return fallback sentiment data
    return {
      overall_sentiment: 'neutral',
      mood_keywords: ['unknown'],
      confidence: 0,
      short_summary: `Error analyzing sentiment: ${error.message}`
    };
  }
}

/**
 * Analyze sentiment for individual transcript segments
 * @param {Array} segments - Array of transcript segments with id and text
 * @returns {Promise<Array>} Array of sentiment analysis per segment
 */
export async function analyzeSegmentSentiments(segments) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log(`Analyzing sentiment for ${segments.length} segments...`);

  // Format segments for the prompt
  const segmentsList = segments.map(seg => `[${seg.id}] "${seg.text}"`).join('\n');

  const prompt = `You are analyzing individual segments from a creator video transcript.

For each segment below, determine:
- sentiment: "positive", "neutral", or "negative"
- mood_keywords: 1-2 descriptive words for this specific segment

Return a JSON object with a single key "segments" containing an array.
Each array item should have: segment_id, sentiment, mood_keywords

Segments:
${segmentsList}

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a sentiment analyst for creator video content. Analyze emotional tone of individual transcript segments. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const responseData = JSON.parse(response.choices[0].message.content);
    const segmentSentiments = responseData.segments || [];
    
    console.log(`Segment sentiment analysis completed for ${segmentSentiments.length} segments`);
    
    return segmentSentiments;
  } catch (error) {
    console.error('Error during segment sentiment analysis:', error.message);
    
    // Return fallback with neutral sentiment for all segments
    return segments.map(seg => ({
      segment_id: seg.id,
      sentiment: 'neutral',
      mood_keywords: ['unknown']
    }));
  }
}

