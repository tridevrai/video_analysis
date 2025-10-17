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
const { generateQAPairs } = await import('../src/qaGenerator.js');

describe('QA Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate QA pairs with relevantSnippets array', async () => {
    const mockQAPairs = [
      {
        question: 'What is the main topic?',
        answer: 'Programming in JavaScript',
        relevantSnippets: [
          { segment_id: 0, text: 'Today we will learn about JavaScript...' }
        ]
      },
      {
        question: 'What tool is mentioned?',
        answer: 'Node.js',
        relevantSnippets: [
          { segment_id: 1, text: 'We will use Node.js for this tutorial.' }
        ]
      }
    ];

    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ qa_pairs: mockQAPairs })
        }
      }]
    });

    const transcript = 'Today we will learn about JavaScript. We will use Node.js for this tutorial.';
    const result = await generateQAPairs(transcript, 10);

    expect(result).toEqual(mockQAPairs);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('question');
    expect(result[0]).toHaveProperty('answer');
    expect(result[0]).toHaveProperty('relevantSnippets');
    expect(Array.isArray(result[0].relevantSnippets)).toBe(true);
    expect(result[0].relevantSnippets[0]).toHaveProperty('segment_id');
    expect(result[0].relevantSnippets[0]).toHaveProperty('text');
  });

  test('should call GPT-4 with creator-focused parameters', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ qa_pairs: [] })
        }
      }]
    });

    const transcript = 'Test transcript';
    const numPairs = 5;
    
    await generateQAPairs(transcript, numPairs);

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('fan engagement')
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining(transcript)
        })
      ]),
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000
    });
  });

  test('should include segments in prompt when provided', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ qa_pairs: [] })
        }
      }]
    });

    const transcript = 'Test transcript';
    const segments = [
      { id: 0, text: 'First segment' },
      { id: 1, text: 'Second segment' }
    ];
    
    await generateQAPairs(transcript, 5, segments);

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find(m => m.role === 'user');
    expect(userMessage.content).toContain('Transcript Segments:');
    expect(userMessage.content).toContain('[0] First segment');
    expect(userMessage.content).toContain('[1] Second segment');
  });

  test('should handle alternative response key names', async () => {
    const mockQAPairs = [
      {
        question: 'Test question?',
        answer: 'Test answer',
        relevantSnippets: [{ segment_id: 0, text: 'Snippet' }]
      }
    ];

    // Test with qaPairs (camelCase) instead of qa_pairs
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ qaPairs: mockQAPairs })
        }
      }]
    });

    const result = await generateQAPairs('Test');

    expect(result).toEqual(mockQAPairs);
  });

  test('should return fallback QA pair with relevantSnippets on API error', async () => {
    mockCreate.mockRejectedValue(new Error('API Error'));

    const result = await generateQAPairs('Test transcript');

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('question');
    expect(result[0]).toHaveProperty('answer');
    expect(result[0]).toHaveProperty('relevantSnippets');
    expect(Array.isArray(result[0].relevantSnippets)).toBe(true);
    expect(result[0].relevantSnippets[0]).toHaveProperty('segment_id');
    expect(result[0].question).toContain('Error');
  });

  test('should use default number of pairs if not specified', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ qaPairs: [] })
        }
      }]
    });

    await generateQAPairs('Test');

    // Check that prompt mentions 10 pairs (the default)
    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find(m => m.role === 'user');
    expect(userMessage.content).toContain('10');
  });

  test('should respect custom number of pairs', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ qaPairs: [] })
        }
      }]
    });

    await generateQAPairs('Test', 15);

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages.find(m => m.role === 'user');
    expect(userMessage.content).toContain('15');
  });
});

