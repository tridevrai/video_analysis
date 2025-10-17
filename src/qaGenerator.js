import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generate question-answer pairs from video transcript using GPT-4 (creator-fan engagement focus)
 * @param {string} transcript - Video transcript text
 * @param {number} numPairs - Number of QA pairs to generate (default: 10)
 * @param {Array} segments - Optional array of transcript segments for segment_id mapping
 * @returns {Promise<Array>} Array of QA pair objects with relevantSnippets
 */
export async function generateQAPairs(transcript, numPairs = 10, segments = null) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log(`Generating ${numPairs} question-answer pairs...`);

  // Build segment reference for the prompt if segments are provided
  let segmentReference = '';
  if (segments && segments.length > 0) {
    segmentReference = '\n\nTranscript Segments:\n' + 
      segments.map(seg => `[${seg.id}] ${seg.text}`).join('\n');
  }

  const prompt = `You are creating interactive Q&A content for fans of a content creator.

Based on the video transcript below, generate ${numPairs} factual, relevant Q&A pairs that:
- Are answerable directly from the transcript
- Focus on key actions, tips, insights, or topics the creator discusses
- Avoid duplicates or trivial questions
- Help fans engage with and understand the content better

Each QA pair should include:
- question: A clear, specific question fans might ask
- answer: A concise but complete answer based on the transcript
- relevantSnippets: An array of 1-3 most relevant snippets from the transcript that support the answer
  Each snippet should have:
  - segment_id: The segment ID number (if segments provided, otherwise 0)
  - text: The exact text from the transcript (1-2 sentences)

Return a JSON object with a single key "qa_pairs" containing an array of objects with keys: question, answer, relevantSnippets

Transcript:
${transcript}
${segmentReference}

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an AI that creates interactive fan engagement content from creator videos. Generate questions and answers that fans would want to ask about the video content. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000
    });

    const responseData = JSON.parse(response.choices[0].message.content);
    const qaPairs = responseData.qa_pairs || responseData.qaPairs || [];
    
    console.log(`Generated ${qaPairs.length} QA pairs`);
    
    return qaPairs;
  } catch (error) {
    console.error('Error generating QA pairs:', error.message);
    
    // Return fallback QA pair
    return [
      {
        question: 'Error generating questions',
        answer: `Unable to generate QA pairs: ${error.message}`,
        relevantSnippets: [{ segment_id: 0, text: '' }]
      }
    ];
  }
}

