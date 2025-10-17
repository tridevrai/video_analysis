import { jest } from '@jest/globals';

// Mock fluent-ffmpeg before importing the module
const mockFfmpeg = jest.fn();
const mockFfprobe = jest.fn();

// Setup mock implementation
mockFfmpeg.mockImplementation(() => {
  const chain = {
    noVideo: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    audioFrequency: jest.fn().mockReturnThis(),
    audioChannels: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    save: jest.fn(function(outputPath) {
      // Simulate successful completion
      const endHandler = this.on.mock.calls.find(call => call[0] === 'end');
      if (endHandler) {
        setTimeout(() => endHandler[1](), 10);
      }
      return this;
    })
  };
  return chain;
});

mockFfmpeg.ffprobe = mockFfprobe;

jest.unstable_mockModule('fluent-ffmpeg', () => ({
  default: mockFfmpeg
}));

// Now import the module to test
const { extractAudio, extractFrames, getVideoDuration } = await import('../src/videoProcessor.js');

describe('Video Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractAudio', () => {
    test('should extract audio with correct settings', async () => {
      const videoPath = './test.mp4';
      const outputPath = './tmp/audio.wav';

      await extractAudio(videoPath, outputPath);

      expect(mockFfmpeg).toHaveBeenCalledWith(videoPath);
      
      // Verify the chain of calls
      const ffmpegInstance = mockFfmpeg.mock.results[0].value;
      expect(ffmpegInstance.noVideo).toHaveBeenCalled();
      expect(ffmpegInstance.audioCodec).toHaveBeenCalledWith('pcm_s16le');
      expect(ffmpegInstance.audioFrequency).toHaveBeenCalledWith(16000);
      expect(ffmpegInstance.audioChannels).toHaveBeenCalledWith(1);
      expect(ffmpegInstance.format).toHaveBeenCalledWith('wav');
      expect(ffmpegInstance.save).toHaveBeenCalledWith(outputPath);
    });

    test('should reject on ffmpeg error', async () => {
      const errorMessage = 'FFmpeg error';
      
      mockFfmpeg.mockImplementationOnce(() => {
        const chain = {
          noVideo: jest.fn().mockReturnThis(),
          audioCodec: jest.fn().mockReturnThis(),
          audioFrequency: jest.fn().mockReturnThis(),
          audioChannels: jest.fn().mockReturnThis(),
          format: jest.fn().mockReturnThis(),
          on: jest.fn().mockReturnThis(),
          save: jest.fn(function() {
            const errorHandler = this.on.mock.calls.find(call => call[0] === 'error');
            if (errorHandler) {
              setTimeout(() => errorHandler[1](new Error(errorMessage)), 10);
            }
            return this;
          })
        };
        return chain;
      });

      await expect(extractAudio('./test.mp4', './tmp/audio.wav'))
        .rejects.toThrow(errorMessage);
    });
  });

  describe('extractFrames', () => {
    test('should extract frames at specified FPS', async () => {
      // Mock fs for this test
      const mockReaddirSync = jest.fn().mockReturnValue(['frame-0001.jpg', 'frame-0002.jpg']);
      
      jest.unstable_mockModule('fs', () => ({
        default: {
          existsSync: jest.fn().mockReturnValue(true),
          mkdirSync: jest.fn(),
          readdirSync: mockReaddirSync
        },
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
        readdirSync: mockReaddirSync
      }));

      const videoPath = './test.mp4';
      const outputDir = './tmp/frames';
      const fps = 2;

      await extractFrames(videoPath, outputDir, fps);

      expect(mockFfmpeg).toHaveBeenCalledWith(videoPath);
      
      const ffmpegInstance = mockFfmpeg.mock.results[0].value;
      expect(ffmpegInstance.outputOptions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining(`fps=${fps}`)
        ])
      );
    });
  });

  describe('getVideoDuration', () => {
    test('should return video duration', async () => {
      const expectedDuration = 120.5;
      
      mockFfprobe.mockImplementation((path, callback) => {
        callback(null, {
          format: {
            duration: expectedDuration
          }
        });
      });

      const duration = await getVideoDuration('./test.mp4');
      
      expect(duration).toBe(expectedDuration);
      expect(mockFfprobe).toHaveBeenCalledWith(
        './test.mp4',
        expect.any(Function)
      );
    });

    test('should reject on error', async () => {
      const errorMessage = 'Probe error';
      
      mockFfprobe.mockImplementation((path, callback) => {
        callback(new Error(errorMessage), null);
      });

      await expect(getVideoDuration('./test.mp4'))
        .rejects.toThrow(errorMessage);
    });
  });
});

