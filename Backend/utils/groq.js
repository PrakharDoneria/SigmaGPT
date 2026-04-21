import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ✅ Available FREE Groq models
export const MODELS = {
  fast: "llama-3.1-8b-instant",       // fastest responses
  smart: "llama-3.3-70b-versatile",   // best quality (default)
  balanced: "gemma2-9b-it",           // good middle ground
};

// ✅ AI Personas — SigmaGPT personalities
export const PERSONAS = {
  general: {
    name: "SigmaGPT",
    prompt: `You are SigmaGPT, a highly intelligent and helpful AI assistant.
You are professional, friendly, and concise.
Use markdown naturally, keep answers clear, and format code in fenced blocks.
Current date and time: ${new Date().toLocaleString()}`,
  },
  coder: {
    name: "Sigma Coder",
    prompt: `You are Sigma Coder, an expert software engineer and coding assistant.
You write clean, efficient code and explain tradeoffs clearly.
Use proper markdown code blocks with language labels.
Current date and time: ${new Date().toLocaleString()}`,
  },
  writer: {
    name: "Sigma Writer",
    prompt: `You are Sigma Writer, a professional content writer and editor.
You produce polished, structured prose for essays, emails, and drafts.
Ask about tone and audience only when it affects the answer.
Current date and time: ${new Date().toLocaleString()}`,
  },
  explainer: {
    name: "Sigma Simplified",
    prompt: `You are Sigma Simplified.
Explain things in plain language with helpful examples and short steps.
Break down complex ideas without losing accuracy.
Current date and time: ${new Date().toLocaleString()}`,
  },
  mentor: {
    name: "Sigma Mentor",
    prompt: `You are Sigma Mentor, a life coach and productivity expert.
You help with career advice, study tips, goal setting, and motivation.
Be direct, constructive, and end with one actionable next step.
Current date and time: ${new Date().toLocaleString()}`,
  },
};

const cleanMessages = (messages = []) =>
  messages
    .filter((message) => message && typeof message.content === "string")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));

const normalizeTitle = (title) => {
  const cleaned = String(title ?? "")
    .replace(/[`*_#>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean).slice(0, 4);
  return words.join(" ").replace(/[.,!?;:]+$/g, "") || "New chat";
};

export const getChatResponse = async (messages, persona = "general", model = "smart") => {
  try {
    const selectedPersona = PERSONAS[persona] || PERSONAS.general;
    const selectedModel = MODELS[model] || MODELS.smart;

    const systemMessage = {
      role: "system",
      content: selectedPersona.prompt,
    };

    const response = await client.chat.completions.create({
      model: selectedModel,
      messages: [systemMessage, ...cleanMessages(messages)],
      max_tokens: 2048,
      temperature: 0.7,
    });

    return {
      content: response.choices[0].message.content,
      persona: selectedPersona.name,
      model: selectedModel,
      tokens: response.usage?.total_tokens || 0,
    };

  } catch (error) {
    console.error("❌ Groq API Error:", error?.message || error);
    throw new Error("Failed to get response from Groq. Please try again.");
  }
};

export const generateChatTitle = async (firstMessage) => {
  try {
    const stream = await client.chat.completions.create({
      model: MODELS.fast,
      messages: [
        {
          role: "system",
          content:
            "Generate a concise 3 to 4 word title for this chat. Return only the title and nothing else.",
        },
        {
          role: "user",
          content: firstMessage,
        },
      ],
      max_tokens: 20,
      temperature: 0.5,
    });

    const rawTitle = stream.choices[0]?.message?.content || firstMessage;
    return normalizeTitle(rawTitle);
  } catch (error) {
    console.error("❌ Title generation error:", error?.message || error);
    return normalizeTitle(firstMessage);
  }
};

export default client;