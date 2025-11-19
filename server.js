// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");

// Polyfill fetch for Node (works on Node 14+)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = 3000;

// 🔐 Put your OpenAI API key here (KEEP IT SECRET, on server only)
const OPENAI_API_KEY = ""; // <-- REPLACE WITH REAL KEY

if (!OPENAI_API_KEY || OPENAI_API_KEY === "process.env.OPENAI_API_KEY") {
  console.warn("⚠️ OPENAI_API_KEY is not set. Please update server.js");
}

app.use(cors());
app.use(express.json());

// Serve frontend files (index.html, app.js, style.css)
app.use(express.static(__dirname));

/**
 * Helper to call OpenAI Chat Completions and parse JSON content
 */
async function callOpenAI(prompt, temperature = 0.2) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "process.env.OPENAI_API_KEY") {
    throw new Error("Missing OpenAI API key in server.js");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("🔴 OpenAI HTTP error:", res.status, body);
    throw new Error("OpenAI HTTP error " + res.status);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error("🔴 No content in OpenAI response:", JSON.stringify(data, null, 2));
    throw new Error("No content from OpenAI");
  }

  let parsed;
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch (err) {
    console.error("🔴 JSON parse error from OpenAI:", err, "CONTENT:", content);
    throw new Error("Bad JSON from OpenAI");
  }

  return parsed;
}

/**
 * /api/grammar  → grammar checker
 */
app.post("/api/grammar", async (req, res) => {
  try {
    const text = req.body.text || "";

    if (!text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const prompt = `
Analyze this English sentence:
"${text}"

Return a JSON object with this shape:

{
  "corrected": "corrected sentence here",
  "issues": ["issue 1", "issue 2"],
  "correctPercent": 0-100,
  "wrongPercent": 100 - correctPercent
}

Respond with ONLY valid JSON, no explanation text.
`;

    const result = await callOpenAI(prompt, 0.2);
    res.json(result);
  } catch (err) {
    console.error("GRAMMAR ERROR:", err.message);
    res.status(500).json({ error: "Grammar check failed: " + err.message });
  }
});

/**
 * /api/words  → “Know your word” helper
 */
app.post("/api/words", async (req, res) => {
  try {
    const text = req.body.text || "";

    if (!text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const prompt = `
You are an English vocabulary coach.

The learner asks this question:
"${text}"

1. First, understand what kind of meaning, word, or expression they are looking for.
2. Then propose UP TO 4 informal options and UP TO 4 formal options that match.

Return ONLY a JSON object with this exact structure:

{
  "informal": ["word or short phrase", "..."],
  "formal": ["word or short phrase", "..."],
  "notes": "short explanation in simple English (max 3 sentences)."
}

Rules:
- "informal": everyday, casual words/phrases students might use with friends.
- "formal": more academic, professional or precise terms.
- Each item should be 1-3 words long.
- If you have fewer than 4 good options, include fewer, but still use an array.
- Do NOT add any extra fields or text outside of this JSON.
`;

    const result = await callOpenAI(prompt, 0.4);
    res.json(result);
  } catch (err) {
    console.error("WORDS ERROR:", err.message);
    res.status(500).json({ error: "Word helper failed: " + err.message });
  }
});

// Wildcard route – serve SPA
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}`);
});
