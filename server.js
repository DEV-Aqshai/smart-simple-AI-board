require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/**
 * Helper: try to extract JSON from model response (handles markdown fences)
 */
function extractJSON(text) {
  if (!text) return null;
  // Remove markdown code fences if present
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Fallback: try to find the first { ... } block
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
 * Body: {
 *   image: string (data URL or pure base64),
 *   action: 'clean-text' | 'detect-shape' | 'solve',
 *   width?: number,
 *   height?: number
 * }
 */
app.post('/api/process-canvas', async (req, res) => {
  try {
    const { image, action, width = 800, height = 500 } = req.body;

    if (!image || !action) {
      return res.status(400).json({ error: 'Missing image or action' });
    }

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
  "left": number,   // approximate left position of the text block
  "top": number,    // approximate top position of the text block
  "width": number   // approximate width of the text block
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
      "width": number,      // for rect / ellipse / triangle
      "height": number,     // for rect / ellipse / triangle
      "radius": number,     // for circle
      "x1": number, "y1": number, "x2": number, "y2": number,  // for line
      "stroke": "#1e293b",
      "strokeWidth": 3,
      "fill": "transparent"
    }
  ],
  "summary": "short human description of what was detected"
}

Rules:
- Coordinates must be inside the ${width}x${height} canvas.
- Prefer simple clean shapes. Convert rough freehand drawings into ideal geometry.
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
  "finalAnswer": "Only the final answer, short and clean (e.g. 42 or x = 5 or The capital is Paris)",
  "left": number,   // recommended left position to place the answer (usually 20)
  "top": number     // recommended top position — place it BELOW the original question
}

Estimate "top" so the final answer appears under the question (use the bottom of the content + ~30px padding).
If the board is mostly empty, use top = ${Math.round(height * 0.55)}.`;
        break;

      default:
        return res.status(400).json({ error: 'Invalid action. Use clean-text, detect-shape, or solve.' });
    }

    // Call Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]
    });

    const rawText = response.text || '';
    const parsed = extractJSON(rawText);

    // Always return both the structured data and a readable fallback
    res.json({
      success: true,
      action,
      data: parsed,               // structured object (or null)
      result: rawText,            // original text for the side panel
      fallbackText: parsed ? null : rawText
    });
  } catch (error) {
    console.error('Error processing canvas:', error);
    res.status(500).json({
      error: 'Failed to process canvas',
      details: error.message || String(error)
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: 'gemini-2.5-flash' });
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AI Writing & Drawing Board running at http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not set. Create a .env file from .env.example');
  }
});


module.exports = app;
