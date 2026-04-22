import express from "express";
import { db } from "../config/firebase.js"; 
import {
  getChatResponse,
  //getChatResponseStream,
  generateChatTitle,
} from "../utils/groq.js";

const router = express.Router();

// ✅ All routes use req.user.uid (set by authMiddleware)

// ═══════════════════════════════════════
// GET /api/chat/threads — user's threads only
// ═══════════════════════════════════════
router.get("/threads", async (req, res) => {
  try {
    const userId = req.user.uid;

    const snapshot = await db
      .collection("threads")
      .where("userId", "==", userId) // ✅ Only this user's threads!
      .orderBy("updatedAt", "desc")
      .get();

    const threads = [];
    snapshot.forEach(doc => {
      threads.push({ threadId: doc.id, ...doc.data() });
    });

    res.json(threads);
  } catch (error) {
    console.error("❌ Fetch threads error:", error.message);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// ═══════════════════════════════════════
// GET /api/chat/threads/:threadId
// ═══════════════════════════════════════
router.get("/threads/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.uid;

    const threadDoc = await db.collection("threads").doc(threadId).get();

    if (!threadDoc.exists) {
      return res.status(404).json({ error: "Thread not found" });
    }

    // ✅ Make sure this thread belongs to this user!
    if (threadDoc.data().userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get messages subcollection
    const messagesSnapshot = await db
      .collection("threads").doc(threadId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .get();

    const messages = [];
    messagesSnapshot.forEach(doc => messages.push(doc.data()));

    res.json({ threadId, ...threadDoc.data(), messages });
  } catch (error) {
    console.error("❌ Fetch thread error:", error.message);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// ═══════════════════════════════════════
// POST /api/chat/chat — send message
// ═══════════════════════════════════════
router.post("/chat", async (req, res) => {
  try {
    const { message, threadId, persona = "general", model = "smart" } = req.body;
    const userId = req.user.uid;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // ✅ Streaming headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let currentThreadId = threadId;

    // ✅ Create new thread if needed
    if (!currentThreadId) {
      const newThreadRef = db.collection("threads").doc();
      currentThreadId = newThreadRef.id;
      const title = await generateChatTitle(message);
      await newThreadRef.set({
        title,
        userId,   // ✅ Tag with user ID
        persona,
        model,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      const threadDoc = await db.collection("threads").doc(currentThreadId).get();
      if (!threadDoc.exists) {
        const title = await generateChatTitle(message);
        await db.collection("threads").doc(currentThreadId).set({
          title,
          userId,   // ✅ Tag with user ID
          persona,
          model,
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (threadDoc.data().userId !== userId) {
        // ✅ Security check — can't post to someone else's thread!
        res.write(`data: ${JSON.stringify({ error: "Access denied" })}\n\n`);
        return res.end();
      }
    }

    // ✅ Save user message
    await db.collection("threads").doc(currentThreadId)
      .collection("messages").add({
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });

    // ✅ Get conversation history
    const messagesSnapshot = await db
      .collection("threads").doc(currentThreadId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .get();

    const history = [];
    messagesSnapshot.forEach(doc => {
      const data = doc.data();
      history.push({ role: data.role, content: data.content });
    });

   const result = await getChatResponse(history, persona, model);

const fullResponse = result.content;

// send full response once
res.write(`data: ${JSON.stringify({ chunk: fullResponse })}\n\n`);

    // ✅ Save assistant message
    await db.collection("threads").doc(currentThreadId)
      .collection("messages").add({
        role: "assistant",
        content: fullResponse,
        timestamp: new Date().toISOString(),
        persona,
      });

    // ✅ Update thread timestamp
    await db.collection("threads").doc(currentThreadId).update({
      updatedAt: new Date().toISOString(),
    });

    res.write(`data: ${JSON.stringify({ done: true, threadId: currentThreadId })}\n\n`);
    res.end();

  } catch (error) {
    console.error("❌ Chat error:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ═══════════════════════════════════════
// POST /api/chat/respond — non-streaming (for aiClient.js)
// ═══════════════════════════════════════
router.post("/respond", async (req, res) => {
  try {
    const { messages, persona = "general", model = "smart" } = req.body;
    const result = await getChatResponse(messages, persona, model);
    res.json({ content: result.content, model: result.model });
  } catch (error) {
    console.error("❌ Respond error:", error.message);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// ═══════════════════════════════════════
// POST /api/chat/title — generate title
// ═══════════════════════════════════════
router.post("/title", async (req, res) => {
  try {
    const { message } = req.body;
    const title = await generateChatTitle(message);
    res.json({ title });
  } catch (error) {
    res.json({ title: "New Chat" });
  }
});

// ═══════════════════════════════════════
// PUT /api/chat/threads/:threadId/rename
// ═══════════════════════════════════════
router.put("/threads/:threadId/rename", async (req, res) => {
  try {
    const { threadId } = req.params;
    const { title }    = req.body;
    const userId       = req.user.uid;

    const threadRef = db.collection("threads").doc(threadId);
    const threadDoc = await threadRef.get();

    if (!threadDoc.exists)                   return res.status(404).json({ error: "Thread not found" });
    if (threadDoc.data().userId !== userId)  return res.status(403).json({ error: "Access denied" });
    if (!title?.trim())                      return res.status(400).json({ error: "Title required" });

    await threadRef.update({ title: title.trim(), updatedAt: new Date().toISOString() });
    res.json({ success: true, title: title.trim() });
  } catch (error) {
    console.error("❌ Rename error:", error.message);
    res.status(500).json({ error: "Failed to rename thread" });
  }
});

// ═══════════════════════════════════════
// PUT /api/chat/threads/:threadId/pin
// ═══════════════════════════════════════
router.put("/threads/:threadId/pin", async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.uid;

    const threadRef = db.collection("threads").doc(threadId);
    const threadDoc = await threadRef.get();

    if (!threadDoc.exists)                  return res.status(404).json({ error: "Thread not found" });
    if (threadDoc.data().userId !== userId) return res.status(403).json({ error: "Access denied" });

    const newPinned = !threadDoc.data().pinned;
    await threadRef.update({ pinned: newPinned, updatedAt: new Date().toISOString() });
    res.json({ success: true, pinned: newPinned });
  } catch (error) {
    console.error("❌ Pin error:", error.message);
    res.status(500).json({ error: "Failed to pin thread" });
  }
});

// ═══════════════════════════════════════
// DELETE /api/chat/threads/:threadId
// ═══════════════════════════════════════
router.delete("/threads/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.uid;

    const threadRef = db.collection("threads").doc(threadId);
    const threadDoc = await threadRef.get();

    if (!threadDoc.exists)                  return res.status(404).json({ error: "Thread not found" });
    if (threadDoc.data().userId !== userId) return res.status(403).json({ error: "Access denied" });

    // Delete messages subcollection first
    const messagesRef = threadRef.collection("messages");
    const messagesSnapshot = await messagesRef.get();
    const batch = db.batch();
    messagesSnapshot.forEach(doc => batch.delete(doc.ref));
    batch.delete(threadRef);
    await batch.commit();

    res.json({ success: true, message: "Thread deleted" });
  } catch (error) {
    console.error("❌ Delete error:", error.message);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

// ═══════════════════════════════════════
// DELETE /api/chat/threads — clear ALL user's threads
// ═══════════════════════════════════════
router.delete("/threads", async (req, res) => {
  try {
    const userId = req.user.uid;

    // ✅ Only delete THIS user's threads!
    const snapshot = await db.collection("threads")
      .where("userId", "==", userId)
      .get();

    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.json({ success: true, message: "All your threads cleared" });
  } catch (error) {
    console.error("❌ Clear error:", error.message);
    res.status(500).json({ error: "Failed to clear threads" });
  }
});

export default router;