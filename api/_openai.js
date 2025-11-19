import fetch from "node-fetch";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function callOpenAI(prompt, temperature = 0.2) {
  if (!OPENAI_API_KEY) {
    throw new Error("❌ Missing OPENAI_API_KEY in Vercel environment variables.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("🔴 OpenAI Error:", res.status, errText);
    throw new Error("OpenAI API error " + res.status);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  return JSON.parse(content);
}
