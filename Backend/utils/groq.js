import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// ✅ Create Groq client via OpenAI SDK
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ✅ Models
export const MODELS = {
  fast: "llama-3.1-8b-instant",
  smart: "llama-3.3-70b-versatile",
  balanced: "gemma2-9b-it",
};

// ✅ Personas
export const PERSONAS = {
  general: {
    name: "SigmaGPT",
    prompt: `You are SigmaGPT, a highly intelligent and helpful AI assistant.`,
  },
  coder: {
    name: "Sigma Coder",
    prompt: `You are an expert software engineer.`,
  },
  writer: {
    name: "Sigma Writer",
    prompt: `You are a professional content writer.`,
  },
  explainer: {
    name: "Sigma Simplified",
    prompt: `Explain things in simple terms.`,
  },
  mentor: {
    name: "Sigma Mentor",
    prompt: `Give practical advice and guidance.`,
  },
};

// ✅ Clean messages
const cleanMessages = (messages = []) =>
  messages
    .filter(m => m && typeof m.content === "string")
    .map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

// ✅ Normalize title
const normalizeTitle = (title) => {
  return String(title || "")
    .replace(/[`*_#>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ") || "New chat";
};

// ✅ Chat response
export const getChatResponse = async (messages, persona = "general", model = "smart") => {
  try {
    const selectedPersona = PERSONAS[persona] || PERSONAS.general;
    const selectedModel = MODELS[model] || MODELS.smart;

    const response = await client.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: "system", content: selectedPersona.prompt },
        ...cleanMessages(messages),
      ],
      temperature: 0.7,
    });

    return {
      content: response.choices[0]?.message?.content || "",
      persona: selectedPersona.name,
      model: selectedModel,
    };

  } catch (error) {
    console.error("❌ Groq Error:", error.message);
    throw new Error("AI response failed");
  }
};

// ✅ Title generation
export const generateChatTitle = async (message) => {
  try {
    const res = await client.chat.completions.create({
      model: MODELS.fast,
      messages: [
        { role: "system", content: "Generate a 3-4 word title." },
        { role: "user", content: message },
      ],
      max_tokens: 20,
    });

    return normalizeTitle(res.choices[0]?.message?.content);

  } catch {
    return "New chat";
  }
};

// ✅ Debug
console.log("GROQ KEY:", process.env.GROQ_API_KEY ? "Loaded ✅" : "Missing ❌");

export default client;