const Anthropic = require("@anthropic-ai/sdk");

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

function isAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function generateText({ systemPrompt, userPrompt, model = "claude-opus-4-5", maxTokens = 8000 }) {
  const client = getClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY is not configured. Add it to your .env file.");
  }

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block) throw new Error("Anthropic returned an empty response.");
  return block.text.trim();
}

module.exports = { isAvailable, generateText };
