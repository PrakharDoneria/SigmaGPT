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
             You are professional, friendly, and give clear concise answers.
             Always format code in proper markdown code blocks.
             Current date and time: ${new Date().toLocaleString()}`,
  },
  coder: {
    name: "Sigma Coder",
    prompt: `You are Sigma Coder, an expert software engineer and coding assistant.
             You specialize in writing clean, efficient, well-commented code.
             Always provide code in proper markdown code blocks with language specified.
             Explain your code clearly. Suggest best practices and optimizations.
             Current date and time: ${new Date().toLocaleString()}`,
  },
  writer: {
    name: "Sigma Writer",
    prompt: `You are Sigma Writer, a professional content writer and editor.
             You excel at essays, articles, emails, stories, and creative writing.
             Your writing is engaging, clear, and well-structured.
             Always ask about tone and audience if not specified.
             Current date and time: ${new Date().toLocaleString()}`,
  },
  explainer: {
    name: "Sigma Simplified",
    prompt: `You are Sigma Simplified, you explain everything in the simplest way possible.
             Use analogies, examples, and simple language a 10 year old could understand.
             Break down complex topics into easy digestible points.
             Use emojis occasionally to make explanations fun and engaging.
             Current date and time: ${new Date().toLocaleString()}`,
  },
  mentor: {
    name: "Sigma Mentor",
    prompt: `You are Sigma Mentor, a life coach and productivity expert.
             You help with career advice, study tips, goal setting, and motivation.
             You are encouraging, honest, and solution-focused.
             Always end responses with an actionable next step.
             Current date and time: ${new Date().toLocaleString()}`,
  },
};

// ✅ Normal response
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
      messages: [systemMessage, ...messages],
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

// ✅ Streaming response — text appears word by word like ChatGPT
export const getChatResponseStream = async (messages, persona = "general", model = "smart", onChunk) => {
  try {
    const selectedPersona = PERSONAS[persona] || PERSONAS.general;
    const selectedModel = MODELS[model] || MODELS.smart;

    const systemMessage = {
      role: "system",
      content: selectedPersona.prompt,
    };

    const stream = await client.chat.completions.create({
      model: selectedModel,
      messages: [systemMessage, ...messages],
      max_tokens: 2048,
      temperature: 0.7,
      stream: true, // 🔥 Enable streaming
    });

    let fullContent = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        fullContent += delta;
        onChunk(delta); // Send each word/chunk to frontend
      }
    }

    return {
      content: fullContent,
      persona: selectedPersona.name,
      model: selectedModel,
    };

  } catch (error) {
    console.error("❌ Groq Stream Error:", error?.message || error);
    throw new Error("Streaming failed. Please try again.");
  }
};

// ✅ Generate a smart chat title from first message
export const generateChatTitle = async (firstMessage) => {
  try {
    const response = await client.chat.completions.create({
      model: MODELS.fast, // Use fast model for title generation
      messages: [
        {
          role: "system",
          content: "Generate a short, catchy 4-6 word title for this chat. Return ONLY the title, nothing else.",
        },
        {
          role: "user",
          content: firstMessage,
        },
      ],
      max_tokens: 20,
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();

  } catch (error) {
    // Fallback title if generation fails
    return firstMessage.slice(0, 30) + "...";
  }
};

export default client;