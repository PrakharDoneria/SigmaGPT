import express from "express";
import { getChatResponse, generateChatTitle } from "../utils/groq.js";

const router = express.Router();

router.post("/respond", async (req, res) => {
  try {
    const { messages, persona = "general", model = "smart" } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages are required" });
    }

    const response = await getChatResponse(messages, persona, model);
    res.json(response);
  } catch (error) {
    console.error("Chat response error:", error.message);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

router.post("/title", async (req, res) => {
  try {
    const { message } = req.body ?? {};

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const title = await generateChatTitle(message);
    res.json({ title });
  } catch (error) {
    console.error("Title generation error:", error.message);
    res.status(500).json({ error: "Failed to generate title" });
  }
});

export default router;