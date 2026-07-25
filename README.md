# AI Writing & Drawing Board

A basic single-folder Node.js + Express web app that lets you freehand draw or write on a canvas and process it with Google Gemini 2.5 Flash.

## Features

- Freehand drawing and object selection (Fabric.js)
- **Clean Writing** – Removes the messy freehand handwriting and replaces it with clean, correctly spelled text in roughly the same place
- **Perfect Shape** – Detects freehand shapes, deletes the rough drawings, and draws perfect geometric shapes (circle, rect, triangle, line, ellipse) on the canvas
- **Solve Question** – Keeps the original question drawings and writes the step-by-step solution + final answer *below* the question on the board
- Clear board

## Setup

1. Unzip this folder.
2. Copy `.env.example` to `.env` and add your Gemini API key:

   ```bash
   cp .env.example .env
   # Edit .env and set GEMINI_API_KEY=...
   ```

   Get a free key at: https://aistudio.google.com/apikey

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open http://localhost:3000 in your browser.

## How the AI actions work

| Button            | What happens on the canvas                                      |
|-------------------|-----------------------------------------------------------------|
| Clean Writing     | Deletes freehand ink → places cleaned Textbox                   |
| Perfect Shape     | Deletes freehand ink → draws perfect Fabric.js shapes           |
| Solve Question    | Keeps the original drawings → adds solution text below them     |

The side panel always shows the raw AI response for reference.

## Project Structure

```
.
├── package.json
├── server.js          # Express backend + Gemini integration (structured JSON prompts)
├── .env.example
├── public/
│   └── index.html     # Frontend (Fabric.js canvas + UI)
└── README.md
```

## API

`POST /api/process-canvas`

```json
{
  "image": "data:image/png;base64,...",
  "action": "clean-text" | "detect-shape" | "solve",
  "width": 800,
  "height": 500
}
```

Returns structured data when possible:

```json
{
  "success": true,
  "action": "...",
  "data": { ... },   // parsed JSON from Gemini
  "result": "..."    // original model text
}
```

## Notes

- Uses `@google/genai` SDK and the `gemini-2.5-flash` model.
- Canvas images are sent as base64; keep drawings reasonably sized.
- No database or authentication – intended for local / demo use.
- Shape detection works best with clear, large freehand shapes.


# Hi I am the owner of the project I used AI in the process to make the work easy. So be carefull of faults.
