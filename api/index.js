require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;
let redisClient = null;
let fallbackViews = 0;

try {
  const { Redis } = require('@upstash/redis');
  redisClient = Redis.fromEnv();
} catch (error) {
  console.warn('Upstash Redis not configured, using local fallback counter:', error.message);
}

// Middleware
app.use(express.json({ limit: '10mb' }));

// Serve static files from /public (works on localhost)
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Create Gemini client
 */
function createAI(apiKey) {
  return new GoogleGenAI({ apiKey });
}

/**
 * Extract JSON from model response
 */
function extractJSON(text) {
  if (!text) return null;
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const braceMatch = cleaned.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch (_) {}
    }
    return null;
  }
}

/**
 * POST /api/process-canvas
 */
app.post('/api/process-canvas', async (req, res) => {
  try {
    const { image, action, width = 800, height = 500, apiKey } = req.body;

    const key = apiKey || process.env.GEMINI_API_KEY;

    if (!key) {
      return res.status(401).json({
        error: 'No Gemini API key provided. Please enter your key in the app.'
      });
    }

    if (!image || !action) {
      return res.status(400).json({ error: 'Missing image or action' });
    }

    const ai = createAI(key);

    // Extract pure base64
    let base64Data = image;
    let mimeType = 'image/png';
    if (image.startsWith('data:')) {
      const matches = image.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    let prompt = '';
    switch (action) {
      case 'clean-text':
        prompt = `You are an expert handwriting recognition and layout system.
The image is a drawing board of size ${width}x${height} pixels (origin top-left).

Task:
1. Read ALL handwritten text in the image.
2. Produce a cleaned, correctly spelled, well-formatted version of that text.
3. Estimate the approximate bounding box of the original handwritten text.

Return ONLY a valid JSON object (no markdown, no extra text) with this exact schema:
{
  "cleanedText": "the neat cleaned text here (preserve line breaks with \\n)",
  "left": number,
  "top": number,
  "width": number
}

If no text is found, return: { "cleanedText": "", "left": 20, "top": 20, "width": 400 }`;
        break;

      case 'detect-shape':
        prompt = `You are an expert geometric shape recognition system.
The image is a drawing board of size ${width}x${height} pixels (origin top-left, y increases downward).

Task:
1. Identify every freehand geometric shape drawn by the user (circles, ellipses, rectangles, squares, triangles, lines, arrows).
2. For each shape, output the parameters needed to draw a *perfect* version of it.

Return ONLY a valid JSON object (no markdown, no extra text) with this exact schema:
{
  "shapes": [
    {
      "type": "circle" | "ellipse" | "rect" | "triangle" | "line",
      "left": number,
      "top": number,
      "width": number,
      "height": number,
      "radius": number,
      "x1": number, "y1": number, "x2": number, "y2": number,
      "stroke": "#1e293b",
      "strokeWidth": 3,
      "fill": "transparent"
    }
  ],
  "summary": "short human description of what was detected"
}

Rules:
- Coordinates must be inside the ${width}x${height} canvas.
- Prefer simple clean shapes.
- If nothing recognizable, return { "shapes": [], "summary": "No clear shapes detected" }`;
        break;

      case 'solve':
        prompt = `You are a helpful tutor and problem solver.
The image is a drawing board of size ${width}x${height} pixels containing a handwritten or drawn question/problem.

Task:
1. Identify the question or problem.
2. Solve it step-by-step with clear reasoning.
3. Extract only the final answer (short and clean).

Return ONLY a valid JSON object (no markdown, no extra text) with this exact schema:
{
  "solution": "Full step-by-step solution text here.\\nUse \\n for new lines.",
  "finalAnswer": "Only the final answer, short and clean (e.g. 42 or x = 5)",
  "left": number,
  "top": number
}

Estimate "top" so the final answer appears under the question.
If the board is mostly empty, use top = ${Math.round(height * 0.55)}.`;
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]
    });

    const rawText = response.text || '';
    const parsed = extractJSON(rawText);

    res.json({
      success: true,
      action,
      data: parsed,
      result: rawText
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Failed to process canvas',
      details: error.message || String(error)
    });
  }
});

// Simple public view counter
app.get('/api/view-count', async (req, res) => {
  try {
    if (redisClient) {
      const views = await redisClient.incr('pageviews');
      return res.json({ views });
    }

    fallbackViews += 1;
    return res.json({ views: fallbackViews, fallback: true });
  } catch (error) {
    fallbackViews += 1;
    return res.json({ views: fallbackViews, fallback: true });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: 'gemini-2.5-flash' });
});

// Fallback for local development – serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Export for Vercel
module.exports = app;

// Start server only when running locally
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AI Writing & Drawing Board running at http://localhost:${PORT}`);
  });
}
