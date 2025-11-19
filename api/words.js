import { callOpenAI } from "./_openai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const text = req.body.text || "";

    if (!text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const prompt = `
You are an English vocabulary coach.

The learner asks:
"${text}"

Return JSON:
{
  "informal": ["...", "..."],
  "formal": ["...", "..."],
  "notes": "..."
}
    `;

    const result = await callOpenAI(prompt, 0.4);
    res.status(200).json(result);
  } catch (err) {
    console.error("WORDS ERROR:", err.message);
    res.status(500).json({ error: "Word helper failed: " + err.message });
  }
}
