import { jest } from '@jest/globals';

// Mock OpenAI SDK
const mockCreate = jest.fn();
const mockOpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: mockCreate
    }
  }
}));

jest.unstable_mockModule('openai', () => ({
  default: mockOpenAI
}));

// Import after mocks
const { analyzeSentiment, analyzeSegmentSentiments } = await import('../src/sentiment.js');

describe('Sentiment Analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeSentiment (Overall)', () => {
    test('should analyze overall sentiment with new business schema', async () => {
      const mockSentiment = {
        overall_sentiment: 'positive',
        mood_keywords: ['educational', 'friendly'],
        confidence: 0.88,
        short_summary: 'The creator speaks in an educational and friendly tone.'
      };

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockSentiment)
          }
        }]
      });

      const transcript = 'This is a great tutorial about programming.';
      const result = await analyzeSentiment(transcript);

      expect(result).toEqual(mockSentiment);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('creator content')
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(transcript)
          })
        ]),
        response_format: { type: 'json_object' },
        temperature: 0.3
      });
    });

    test('should include all required fields in new format', async () => {
      const mockSentiment = {
        overall_sentiment: 'neutral',
        mood_keywords: ['casual', 'informative'],
        confidence: 0.6,
        short_summary: 'Conversational tone with informative content.'
      };

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockSentiment)
          }
        }]
      });

      const result = await analyzeSentiment('Some transcript');

      expect(result).toHaveProperty('overall_sentiment');
      expect(result).toHaveProperty('mood_keywords');
      expect(Array.isArray(result.mood_keywords)).toBe(true);
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('short_summary');
    });

    test('should return fallback data on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await analyzeSentiment('Test transcript');

      expect(result).toHaveProperty('overall_sentiment', 'neutral');
      expect(result).toHaveProperty('mood_keywords');
      expect(result.mood_keywords).toContain('unknown');
      expect(result).toHaveProperty('confidence', 0);
      expect(result.short_summary).toContain('Error');
    });
  });

  describe('analyzeSegmentSentiments', () => {
    test('should analyze sentiment for multiple segments', async () => {
      const segments = [
        { id: 0, text: 'Welcome to this video!' },
        { id: 1, text: 'Today we will learn something new.' }
      ];

      const mockResponse = {
        segments: [
          { segment_id: 0, sentiment: 'positive', mood_keywords: ['welcoming', 'friendly'] },
          { segment_id: 1, sentiment: 'positive', mood_keywords: ['educational', 'informative'] }
        ]
      };

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockResponse)
          }
        }]
      });

      const result = await analyzeSegmentSentiments(segments);

      expect(result).toEqual(mockResponse.segments);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('segment_id', 0);
      expect(result[0]).toHaveProperty('sentiment', 'positive');
      expect(result[0]).toHaveProperty('mood_keywords');
      expect(Array.isArray(result[0].mood_keywords)).toBe(true);
    });

    test('should handle API error with fallback', async () => {
      const segments = [
        { id: 0, text: 'Test segment' },
        { id: 1, text: 'Another segment' }
      ];

      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await analyzeSegmentSentiments(segments);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        segment_id: 0,
        sentiment: 'neutral',
        mood_keywords: ['unknown']
      });
    });

    test('should use creator-focused system prompt', async () => {
      const segments = [{ id: 0, text: 'Test' }];
      
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({ segments: [{ segment_id: 0, sentiment: 'neutral', mood_keywords: ['test'] }] })
          }
        }]
      });

      await analyzeSegmentSentiments(segments);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('creator video content')
            })
          ])
        })
      );
    });
  });
});

