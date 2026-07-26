# **For ease of use deployed in vercel**
Visit : smart-board-one.vercel.app
You would still need an Gemini API key to use it
Scroll down to check how to get Gemini API key


# AI Writing & Drawing Board

A clean AI-powered writing and drawing board using **Gemini 2.5 Flash**, **Express**, and **Fabric.js**.

Works on both **localhost** and **Vercel**.

## Features

- Freehand drawing + select mode
- **Clean Writing** – removes messy handwriting and places clean text
- **Perfect Shape** – replaces freehand shapes with perfect geometric shapes
- **Solve Question** – keeps the original question and places only the final answer on the board
- User enters their own Gemini API key (no server-side key required)

## Project Structure

```
├── api/
│   └── index.js          
├── public/
│   └── index.html        
├── package.json
├── vercel.json
├── .env.example
└── README.md
```

## Local Development

```bash
npm install
npm start
```

Open http://localhost:3000

Paste your Gemini API key in the top bar and click **Save Key**.

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the project in Vercel
3. Deploy (no environment variables needed)
4. Done

The user will enter their own Gemini API key in the browser.

## API Key

- The key is stored only in the user's browser (`localStorage`)
- It is sent with every request
- You do **not** need to set `GEMINI_API_KEY` in Vercel

Get a free key here: https://aistudio.google.com/apikey
