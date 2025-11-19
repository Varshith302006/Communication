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
Analyze this English sentence:
"${text}"

Return JSON:
{
  "corrected": "...",
  "issues": ["..."],
  "correctPercent": 0-100,
  "wrongPercent": 100 - correctPercent
}
    `;

    const result = await callOpenAI(prompt, 0.2);
    res.status(200).json(result);
  } catch (err) {
    console.error("GRAMMAR ERROR:", err.message);
    res.status(500).json({ error: "Grammar check failed: " + err.message });
  }
}
