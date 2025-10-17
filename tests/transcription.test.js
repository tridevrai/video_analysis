import { jest } from '@jest/globals';

// Mock OpenAI SDK
const mockCreate = jest.fn();
const mockOpenAI = jest.fn().mockImplementation(() => ({
  audio: {
    transcriptions: {
      create: mockCreate
    }
  }
}));

jest.unstable_mockModule('openai', () => ({
  default: mockOpenAI
}));

// Mock fs
jest.unstable_mockModule('fs', () => ({
  default: {
    createReadStream: jest.fn().mockReturnValue('mock-stream')
  },
  createReadStream: jest.fn().mockReturnValue('mock-stream')
}));

// Import module after mocks
const { transcribeVideo } = await import('../src/transcription.js');

describe('Transcription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('transcribeVideo', () => {
    test('should call Whisper API with verbose_json format and return structured data', async () => {
      const mockResponse = {
        text: 'This is a test transcript.',
        language: 'en',
        segments: [
          { id: 0, start: 0, end: 5, text: 'This is a test transcript.' }
        ]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await transcribeVideo('./test-audio.wav');

      expect(result).toEqual({
        full_text: mockResponse.text,
        language: 'en',
        segments: mockResponse.segments
      });
      expect(mockCreate).toHaveBeenCalledWith({
        file: 'mock-stream',
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        temperature: 0.0
      });
    });

    test('should handle missing language field', async () => {
      const mockResponse = {
        text: 'Test transcript',
        segments: []
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await transcribeVideo('./test-audio.wav');

      expect(result.language).toBe('en'); // Default language
    });

    test('should throw error on API failure', async () => {
      const errorMessage = 'API Error';
      mockCreate.mockRejectedValue(new Error(errorMessage));

      await expect(transcribeVideo('./test-audio.wav'))
        .rejects.toThrow(errorMessage);
    });
  });
});

