const OpenAI = require("openai");

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  _client = new OpenAI({ apiKey });
  return _client;
}

function isAvailable() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function generateText({ systemPrompt, userPrompt, model = "gpt-4o", maxTokens = 8000 }) {
  const client = getClient();
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured. Add it to your .env file.");
  }

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned an empty response.");
  return text;
}

module.exports = { isAvailable, generateText };
