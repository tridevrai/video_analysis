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

// Mock utils
jest.unstable_mockModule('../src/utils.js', () => ({
  imageToBase64: jest.fn().mockReturnValue('mock-base64-image')
}));

// Import after mocks
const { detectObjectsInFrame, detectObjectsInFrames } = await import('../src/objectDetection.js');

describe('Object Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectObjectsInFrame', () => {
    test('should detect objects with confidence and context using GPT-4 Vision', async () => {
      const mockResponseData = {
        objects: [
          { name: 'person', confidence: 0.98, context: 'sitting at desk, center frame' },
          { name: 'laptop', confidence: 0.95, context: 'on desk in front of person' },
          { name: 'coffee cup', confidence: 0.87, context: 'next to laptop on desk' }
        ]
      };
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify(mockResponseData)
          }
        }]
      };
      mockCreate.mockResolvedValue(mockResponse);

      const objects = await detectObjectsInFrame('./frame-001.jpg');

      expect(objects).toEqual(mockResponseData.objects);
      expect(objects[0]).toHaveProperty('name');
      expect(objects[0]).toHaveProperty('confidence');
      expect(objects[0]).toHaveProperty('context');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('creator')
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({ 
                type: 'image_url',
                image_url: expect.objectContaining({
                  url: expect.stringContaining('data:image/jpeg;base64,'),
                  detail: 'low'
                })
              })
            ])
          })
        ]),
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.3
      });
    });

    test('should handle API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const objects = await detectObjectsInFrame('./frame-001.jpg');

      expect(objects).toEqual([]);
    });

    test('should return structured JSON objects', async () => {
      const mockResponseData = {
        objects: [
          { name: 'Person', confidence: 0.96, context: 'in center' }
        ]
      };
      
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponseData) } }]
      });

      const objects = await detectObjectsInFrame('./frame-001.jpg');

      expect(Array.isArray(objects)).toBe(true);
      expect(objects[0]).toMatchObject({
        name: expect.any(String),
        confidence: expect.any(Number),
        context: expect.any(String)
      });
    });
  });

  describe('detectObjectsInFrames', () => {
    test('should group objects by name with appearance_percentage and frames', async () => {
      const mockResponses = [
        { choices: [{ message: { content: JSON.stringify({
          objects: [
            { name: 'person', confidence: 0.98, context: 'center frame' },
            { name: 'laptop', confidence: 0.95, context: 'on desk' }
          ]
        }) } }] },
        { choices: [{ message: { content: JSON.stringify({
          objects: [
            { name: 'person', confidence: 0.97, context: 'sitting' },
            { name: 'desk', confidence: 0.92, context: 'visible' }
          ]
        }) } }] },
        { choices: [{ message: { content: JSON.stringify({
          objects: [
            { name: 'laptop', confidence: 0.94, context: 'open' },
            { name: 'coffee cup', confidence: 0.88, context: 'on desk' }
          ]
        }) } }] }
      ];

      mockCreate
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      const framePaths = ['./frame-001.jpg', './frame-002.jpg', './frame-003.jpg'];
      const result = await detectObjectsInFrames(framePaths, 1, 1);

      expect(Array.isArray(result)).toBe(true);
      
      // Find person object
      const personObj = result.find(obj => obj.name === 'person');
      expect(personObj).toBeDefined();
      expect(personObj).toHaveProperty('appearance_percentage');
      expect(personObj).toHaveProperty('avg_confidence');
      expect(personObj).toHaveProperty('frames');
      expect(Array.isArray(personObj.frames)).toBe(true);
      expect(personObj.frames.length).toBe(2); // appeared in 2 frames
      expect(personObj.frames[0]).toHaveProperty('frame_id');
      expect(personObj.frames[0]).toHaveProperty('timestamp');
      expect(personObj.frames[0]).toHaveProperty('confidence');
      expect(personObj.frames[0]).toHaveProperty('context');
    });

    test('should calculate appearance_percentage correctly', async () => {
      const mockResponse = { choices: [{ message: { content: JSON.stringify({
        objects: [{ name: 'person', confidence: 0.95, context: 'test' }]
      }) } }] };
      
      mockCreate.mockResolvedValue(mockResponse);

      const framePaths = ['./frame-001.jpg', './frame-002.jpg', './frame-003.jpg', './frame-004.jpg'];
      const result = await detectObjectsInFrames(framePaths, 1, 1);

      // Person appears in all 4 frames = 100%
      const personObj = result.find(obj => obj.name === 'person');
      expect(personObj.appearance_percentage).toBe(100.0);
    });

    test('should respect sample rate', async () => {
      const mockResponse = { choices: [{ message: { content: JSON.stringify({
        objects: [{ name: 'person', confidence: 0.95, context: 'test' }]
      }) } }] };
      
      mockCreate.mockResolvedValue(mockResponse);

      const framePaths = ['./frame-001.jpg', './frame-002.jpg', './frame-003.jpg', './frame-004.jpg'];
      await detectObjectsInFrames(framePaths, 2, 1);

      // Should only process frames 0 and 2 (every 2nd frame)
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    test('should sort objects by appearance_percentage', async () => {
      const mockResponses = [
        { choices: [{ message: { content: JSON.stringify({
          objects: [
            { name: 'person', confidence: 0.98, context: 'center' },
            { name: 'laptop', confidence: 0.95, context: 'desk' }
          ]
        }) } }] },
        { choices: [{ message: { content: JSON.stringify({
          objects: [
            { name: 'person', confidence: 0.97, context: 'center' }
          ]
        }) } }] },
        { choices: [{ message: { content: JSON.stringify({
          objects: [
            { name: 'person', confidence: 0.96, context: 'center' }
          ]
        }) } }] }
      ];

      mockCreate
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      const framePaths = ['./frame-001.jpg', './frame-002.jpg', './frame-003.jpg'];
      const result = await detectObjectsInFrames(framePaths, 1, 1);

      // 'person' appears in 3/3 frames (100%), 'laptop' in 1/3 (33.3%)
      // person should be first (highest appearance_percentage)
      expect(result[0].name).toBe('person');
      expect(result[0].appearance_percentage).toBe(100.0);
    });

    test('should calculate timestamps correctly', async () => {
      const mockResponse = { choices: [{ message: { content: JSON.stringify({
        objects: [{ name: 'person', confidence: 0.95, context: 'test' }]
      }) } }] };
      
      mockCreate.mockResolvedValue(mockResponse);

      const framePaths = ['./frame-001.jpg', './frame-002.jpg'];
      const fps = 2; // 2 frames per second
      const result = await detectObjectsInFrames(framePaths, 1, fps);

      const personObj = result.find(obj => obj.name === 'person');
      expect(personObj.frames[0].timestamp).toBe(0.0); // frame 1: (1-1)/2 = 0
      expect(personObj.frames[1].timestamp).toBe(0.5); // frame 2: (2-1)/2 = 0.5
    });
  });
});

