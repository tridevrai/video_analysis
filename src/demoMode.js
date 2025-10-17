/**
 * Demo Mode - Simulates video processing without making real API calls
 * Perfect for testing the UI and workflow without spending API credits
 * Updated for new business schema format
 */

export function generateDemoResults(videoFile) {
  const demoTranscript = `Welcome to this demonstration video. In this video, we'll be exploring various concepts and discussing important topics. The content covers educational material presented in a clear and engaging manner. Throughout this presentation, you'll notice various visual elements and spoken explanations that work together to convey the message effectively. This is a sample transcript that demonstrates what a real transcription would look like.`;

  const demoSegments = [
    {
      id: 0,
      start: 0.0,
      end: 5.2,
      text: "Welcome to this demonstration video. In this video, we'll be exploring various concepts and discussing important topics.",
      speaker: "creator",
      sentiment: "positive",
      mood_keywords: ["welcoming", "engaging"]
    },
    {
      id: 1,
      start: 5.2,
      end: 10.4,
      text: "The content covers educational material presented in a clear and engaging manner.",
      speaker: "creator",
      sentiment: "positive",
      mood_keywords: ["educational", "clear"]
    },
    {
      id: 2,
      start: 10.4,
      end: 17.8,
      text: "Throughout this presentation, you'll notice various visual elements and spoken explanations that work together to convey the message effectively.",
      speaker: "creator",
      sentiment: "neutral",
      mood_keywords: ["informative", "descriptive"]
    },
    {
      id: 3,
      start: 17.8,
      end: 22.5,
      text: "This is a sample transcript that demonstrates what a real transcription would look like.",
      speaker: "creator",
      sentiment: "neutral",
      mood_keywords: ["demonstrative", "explanatory"]
    }
  ];

  const demoObjectsDetected = [
    {
      name: 'person',
      appearance_percentage: 100.0,
      avg_confidence: 0.97,
      frames: [
        { frame_id: 1, timestamp: 0.0, confidence: 0.98, context: "creator in center frame speaking to camera" },
        { frame_id: 5, timestamp: 4.0, confidence: 0.97, context: "creator gesturing while explaining" },
        { frame_id: 10, timestamp: 9.0, confidence: 0.96, context: "creator sitting at desk" }
      ]
    },
    {
      name: 'laptop',
      appearance_percentage: 53.3,
      avg_confidence: 0.94,
      frames: [
        { frame_id: 1, timestamp: 0.0, confidence: 0.95, context: "on desk in front of creator" },
        { frame_id: 5, timestamp: 4.0, confidence: 0.93, context: "visible on desk" },
        { frame_id: 10, timestamp: 9.0, confidence: 0.94, context: "open laptop on desk" }
      ]
    },
    {
      name: 'desk',
      appearance_percentage: 66.7,
      avg_confidence: 0.91,
      frames: [
        { frame_id: 1, timestamp: 0.0, confidence: 0.92, context: "wooden desk in foreground" },
        { frame_id: 5, timestamp: 4.0, confidence: 0.90, context: "desk surface visible" }
      ]
    },
    {
      name: 'coffee cup',
      appearance_percentage: 20.0,
      avg_confidence: 0.86,
      frames: [
        { frame_id: 10, timestamp: 9.0, confidence: 0.86, context: "next to laptop on desk" }
      ]
    }
  ];

  const demoSentiment = {
    overall_sentiment: 'positive',
    mood_keywords: ['educational', 'engaging', 'informative'],
    confidence: 0.88,
    short_summary: 'The creator speaks in an educational and engaging tone, presenting information clearly with a positive and welcoming attitude.'
  };

  const demoQAPairs = [
    {
      question: 'What is the main topic of the video?',
      answer: 'The video explores various educational concepts and discusses important topics in a clear and engaging manner.',
      relevantSnippets: [
        { segment_id: 0, text: "In this video, we'll be exploring various concepts and discussing important topics." },
        { segment_id: 1, text: "The content covers educational material presented in a clear and engaging manner." }
      ]
    },
    {
      question: 'How is the content presented?',
      answer: 'The content is presented through visual elements and spoken explanations that work together effectively.',
      relevantSnippets: [
        { segment_id: 2, text: "you'll notice various visual elements and spoken explanations that work together to convey the message effectively." }
      ]
    },
    {
      question: 'What is the purpose of this video?',
      answer: 'The purpose is to demonstrate what a real video analysis would produce, showing how educational content can be effectively conveyed.',
      relevantSnippets: [
        { segment_id: 0, text: "In this video, we'll be exploring various concepts and discussing important topics." },
        { segment_id: 3, text: "This is a sample transcript that demonstrates what a real transcription would look like." }
      ]
    }
  ];

  return {
    metadata: {
      videoFile: videoFile,
      videoDuration: 30,
      processedAt: new Date().toISOString(),
      processingTime: '2.5s',
      demoMode: true,
      note: 'This is simulated data - no API calls were made'
    },
    transcript: {
      full_text: demoTranscript,
      language: 'en',
      segments: demoSegments
    },
    sentiment: demoSentiment,
    objects_detected: demoObjectsDetected,
    qa_pairs: demoQAPairs
  };
}

