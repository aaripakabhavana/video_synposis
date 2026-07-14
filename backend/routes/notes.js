const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { OpenAI } = require('openai');
const { GoogleGenAI } = require('@google/genai');
const { YoutubeTranscript } = require('youtube-transcript');

// Helper function to extract video ID from URL
function extractVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  const bare = url.match(/^[A-Za-z0-9_-]{11}$/);
  return bare ? bare[0] : null;
}

// Fetch YouTube video title via oEmbed API
async function fetchYoutubeTitle(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return data.title;
    }
  } catch (err) {
    console.error('Failed to fetch YouTube title via oEmbed:', err.message);
  }
  return null;
}

// Fallback logic for AI generation
async function generateWithFallback(prompt) {
  let lastError = null;

  // 1. Try Groq (Llama 3 or similar)
  if (process.env.GROQ_API_KEY) {
    try {
      console.log('Attempting generation with Groq...');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant', // Updated from decommissioned llama3-8b-8192
        response_format: { type: 'json_object' }
      });
      return JSON.parse(completion.choices[0].message.content);
    } catch (err) {
      console.error('Groq generation failed:', err.message);
      lastError = err;
    }
  }

  // 2. Try OpenRouter (Fallback)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      console.log('Attempting generation with OpenRouter...');
      const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      
      const completion = await openai.chat.completions.create({
        model: 'openrouter/free', // Dynamically routes to an active free model
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      return JSON.parse(completion.choices[0].message.content);
    } catch (err) {
      console.error('OpenRouter generation failed:', err.message);
      lastError = err;
    }
  }

  // 3. Try Gemini (Final Fallback)
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('Attempting generation with Gemini...');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      return JSON.parse(response.text);
    } catch (err) {
      console.error('Gemini generation failed:', err.message);
      lastError = err;
    }
  }

  throw new Error('All AI providers failed. Last error: ' + (lastError ? lastError.message : 'No API keys configured'));
}

router.post('/generate', async (req, res) => {
  try {
    const { videoUrl, title } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    const videoId = extractVideoId(videoUrl);
    let resolvedTitle = title;

    // Fetch the real YouTube title if we have a video ID
    if (videoId) {
      const fetchedTitle = await fetchYoutubeTitle(videoId);
      if (fetchedTitle) {
        resolvedTitle = fetchedTitle;
      }
    }

    if (!resolvedTitle || resolvedTitle === videoId) {
      resolvedTitle = title || 'Video Analysis Study Guide';
    }

    let transcriptText = "";
    let videoDurationStr = "15 min";
    if (videoId) {
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        
        if (transcript && transcript.length > 0) {
          const lastSeg = transcript[transcript.length - 1];
          const startMs = lastSeg.offset !== undefined ? lastSeg.offset : (lastSeg.start ? lastSeg.start * 1000 : 0);
          const durationMs = lastSeg.duration !== undefined ? lastSeg.duration : 0;
          const totalSeconds = Math.round((startMs + durationMs) / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          if (hours > 0) {
            videoDurationStr = `${hours}h ${minutes}m`;
          } else {
            videoDurationStr = `${minutes} min`;
          }
        }

        const maxChars = 6000;
        let fullText = transcript.map(t => t.text).join(' ');
        
        if (fullText.length > maxChars) {
          console.log(`Transcript is too long (${fullText.length} chars). Downsampling to fit within model token limits...`);
          // Downsample transcript by taking evenly spaced segments to fit maxChars
          const avgSegmentLength = Math.max(1, fullText.length / transcript.length);
          const targetSegmentCount = Math.max(10, Math.min(Math.floor(maxChars / avgSegmentLength), transcript.length));
          const step = transcript.length / targetSegmentCount;
          const sampled = [];
          for (let i = 0; i < targetSegmentCount; i++) {
            const index = Math.floor(i * step);
            if (transcript[index]) {
              sampled.push(transcript[index].text);
            }
          }
          transcriptText = sampled.join(' ... ');
          console.log(`Downsampled transcript to ${transcriptText.length} characters.`);
        } else {
          transcriptText = fullText;
        }
      } catch (err) {
        console.warn('Could not fetch transcript for video ID', videoId, err.message);
      }
    }

    const prompt = `You are a professional educational assistant. Generate a highly detailed, comprehensive study guide, a structured PPT slide deck, and an interactive quiz based on the video/topic: "${resolvedTitle}".
URL of the video: "${videoUrl}".
${transcriptText ? `\nHere is the actual transcript of the video. You MUST base your summary, takeaways, and quiz entirely on this transcript content:\n\n"""\n${transcriptText}\n"""\n` : `\nNote: The video transcript is not available. Please generate the study guide, slides, and quiz using your own knowledge of the topic/title: "${resolvedTitle}".\n`}
Return your response in JSON format. Do not include markdown code block formatting (such as \`\`\`json ... \`\`\`). The JSON structure must match exactly:
{
  "title": "${resolvedTitle}",
  "summary": "An executive summary explaining key details of this video topic...",
  "keyTakeaways": [
    "First major takeaway with description",
    "Second major takeaway with description",
    "Third major takeaway with description",
    "Fourth major takeaway with description"
  ],
  "sections": [
    {
      "heading": "1. Detailed topic heading",
      "points": [
        "A highly detailed explanatory bullet point 1",
        "A highly detailed explanatory bullet point 2",
        "A highly detailed explanatory bullet point 3"
      ],
      "example": "A concrete real-world example explaining this section's topic"
    }
  ],
  "timeline": [
    { "time": "0:00 - 5:15", "heading": "Foundations", "detail": "Detailed explanation..." }
  ],
  "conclusion": "A detailed concluding summary.",
  "slides": [
    { "title": "1. Introduction to topic", "body": "• Key point 1\\n• Key point 2\\n• Key point 3", "theme": "dark" }
  ],
  "quizzes": {
    "mcq": [
      { "q": "Question 1?", "opts": ["Option A", "Option B", "Option C", "Option D"], "correct": 0, "feedback": "Detailed feedback for Question 1" }
    ],
    "tf": [
      { "q": "Statement 1?", "correct": true, "feedback": "Detailed feedback for Statement 1" }
    ],
    "qa": [
      { "q": "Question 1?", "answer": "Model answer for Question 1" }
    ]
  }
}

Important Instructions:
1. Make sure all MCQs have exactly 4 choices in 'opts', and 'correct' is the index (0, 1, 2, or 3) of the correct answer.
2. The quiz must contain exactly 10 MCQs, exactly 5 True/False (tf) questions, and exactly 5 Q&A (qa) questions.
3. Provide at least 3 sections, 4 slides, and 4 timeline items.
4. Make all the text rich, highly informative, and fully customized for: "${resolvedTitle}".`;

    const generatedData = await generateWithFallback(prompt);
    
    // Note: If you want to store this in Supabase, you can do it here using the Supabase client
    // provided you send an auth token from the client to identify the user.

    res.json({
      ...generatedData,
      duration: videoDurationStr
    });
  } catch (error) {
    console.error('Error generating notes:', error);
    res.status(500).json({ error: error.message || 'Failed to generate notes' });
  }
});

module.exports = router;
