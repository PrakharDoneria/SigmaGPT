import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "../context/MyContext.jsx";
import { useContext, useState, useRef, useEffect } from "react";
import { ScaleLoader } from "react-spinners";
import toast from "react-hot-toast";
import {
  Send, Mic, MicOff, Download, FileText, FileDown,
  MoreVertical, Trash2, RefreshCw, Menu
} from "lucide-react";
import { jsPDF } from "jspdf";

// ✅ BASE URL — no trailing slash
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

// ✅ All endpoints in one place — easy to update!
const CHAT_URL    = `${API_BASE}/api/chat/chat`;
const THREADS_URL = `${API_BASE}/api/chat/threads`;

function ChatWindow() {
  const {
    prompt, setPrompt,
    setReply,
    currThreadId,
    prevChats, setPrevChats,
    setIsNewChat,
    isLoading, setIsLoading,
    selectedPersona, selectedModel,
    isListening, setIsListening,
    isOnline,
    startNewChat,
    isSidebarOpen, setIsSidebarOpen,
    allThreads, setAllThreads,
  } = useContext(MyContext);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu]     = useState(false);
  const chatBodyRef    = useRef(null);
  const inputRef       = useRef(null);
  const recognitionRef = useRef(null);

  // ✅ Auto scroll to bottom
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [prevChats]);

  // ✅ Send message with streaming
  const getReply = async (overridePrompt) => {
    const text = (overridePrompt || prompt).trim();
    if (!text || isLoading) return;
    if (!isOnline) { toast.error("You're offline! SigmaGPT needs internet."); return; }

    setIsLoading(true);
    setIsNewChat(false);
    setPrompt("");

    // Add user message immediately
    const userMsg = { role: "user", content: text, timestamp: new Date().toISOString() };
    setPrevChats(prev => [...prev, userMsg]);

    // Add empty assistant placeholder for streaming
    setPrevChats(prev => [...prev, {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      persona: selectedPersona,
    }]);

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          message: text,
          threadId: currThreadId,
          persona: selectedPersona,
          model: selectedModel,
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      // Read stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.chunk) {
              setPrevChats(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: last.content + data.chunk };
                return updated;
              });
            }

            if (data.done) {
              // Refresh thread list
              try {
                const res = await fetch(THREADS_URL);
                if (res.ok) {
                  const threads = await res.json();
                  setAllThreads(Array.isArray(threads) ? threads : []);
                }
              } catch {}
            }
          } catch { /* skip malformed JSON */ }
        }
      }

    } catch (err) {
      console.error("Chat error:", err.message);
      toast.error("Failed to get response. Try again!");
      setPrevChats(prev => prev.slice(0, -1));
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  // ✅ Voice input
  const toggleVoice = () => {
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      toast.error("Voice input not supported in this browser!");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (e) => {
      setPrompt(e.results[0][0].transcript);
      setIsListening(false);
      toast.success("Voice captured!");
    };

    recognition.onerror = () => { setIsListening(false); toast.error("Voice input failed!"); };
    recognition.onend   = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // ✅ Export as TXT
  const exportTXT = () => {
    if (!prevChats.length) { toast.error("No chat to export!"); return; }
    const lines = prevChats.map(c => {
      const who  = c.role === "user" ? "You" : "SigmaGPT";
      const time = c.timestamp ? new Date(c.timestamp).toLocaleString() : "";
      return `[${time}] ${who}:\n${c.content}\n`;
    });
    const text = `SigmaGPT Chat Export\nExported: ${new Date().toLocaleString()}\n${"─".repeat(40)}\n\n${lines.join("\n")}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sigmagpt-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as TXT!");
    setShowExportMenu(false);
  };

  // ✅ Export as PDF
  const exportPDF = () => {
    if (!prevChats.length) { toast.error("No chat to export!"); return; }
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(18);
      doc.setTextColor(124, 58, 237);
      doc.text("ΣigmaGPT", 20, y);
      y += 8;

      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Exported: ${new Date().toLocaleString()}`, 20, y);
      y += 10;

      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, pageW - 20, y);
      y += 10;

      prevChats.forEach(chat => {
        const who  = chat.role === "user" ? "You" : "SigmaGPT";
        const time = chat.timestamp
          ? new Date(chat.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
          : "";

        doc.setFontSize(9);
        doc.setTextColor(124, 58, 237);
        doc.text(`${who}  ${time}`, 20, y);
        y += 6;

        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        const clean = chat.content.replace(/[#*`_~]/g, "");
        const lines = doc.splitTextToSize(clean, pageW - 40);
        if (y + lines.length * 5 > 275) { doc.addPage(); y = 20; }
        doc.text(lines, 20, y);
        y += lines.length * 5 + 8;
      });

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Powered by SigmaGPT + Groq", 20, 290);
      doc.save(`sigmagpt-chat-${Date.now()}.pdf`);
      toast.success("Exported as PDF!");
    } catch { toast.error("PDF export failed!"); }
    setShowExportMenu(false);
  };

  // ✅ Clear all chats
  const clearChat = async () => {
    setShowMoreMenu(false);
    if (!window.confirm("Clear all chats? This cannot be undone.")) return;
    try {
      await fetch(THREADS_URL, { method: "DELETE" });
      startNewChat();
      setAllThreads([]);
      toast.success("All chats cleared!");
    } catch { toast.error("Failed to clear chats!"); }
  };

  const handleQuickPrompt = (text) => {
    setPrompt(text);
    inputRef.current?.focus();
  };

  const currentPersonaName = {
    general: "SigmaGPT", coder: "Sigma Coder",
    writer: "Sigma Writer", explainer: "Sigma Simplified", mentor: "Sigma Mentor",
  }[selectedPersona] || "SigmaGPT";

  const currentModelLabel = { smart: "Smart", fast: "Fast", balanced: "Balanced" }[selectedModel] || "Smart";

  return (
    <div className="chatWindow">
      {/* ── Navbar ── */}
      <div className="navbar">
        <div className="navLeft">
          {!isSidebarOpen && (
            <button className="navIconBtn" onClick={() => setIsSidebarOpen(true)} title="Open sidebar">
              <Menu size={18} />
            </button>
          )}
          <div className="navTitle">
            <span className="navName">{currentPersonaName}</span>
            <span className="navModel">{currentModelLabel} · Groq</span>
          </div>
        </div>

        <div className="navRight">
          <div className="navDropdownWrap">
            <button className="navIconBtn" title="Export chat"
              onClick={() => { setShowExportMenu(!showExportMenu); setShowMoreMenu(false); }}>
              <Download size={17} />
            </button>
            {showExportMenu && (
              <div className="navDropdown">
                <button onClick={exportTXT}><FileText size={14} /> Export as TXT</button>
                <button onClick={exportPDF}><FileDown size={14} /> Export as PDF</button>
              </div>
            )}
          </div>

          <div className="navDropdownWrap">
            <button className="navIconBtn" title="More options"
              onClick={() => { setShowMoreMenu(!showMoreMenu); setShowExportMenu(false); }}>
              <MoreVertical size={17} />
            </button>
            {showMoreMenu && (
              <div className="navDropdown">
                <button onClick={() => { startNewChat(); setShowMoreMenu(false); }}>
                  <RefreshCw size={14} /> New Chat
                </button>
                <button className="danger" onClick={clearChat}>
                  <Trash2 size={14} /> Clear All Chats
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Chat body ── */}
      <div className="chatBody" ref={chatBodyRef}
        onClick={() => { setShowExportMenu(false); setShowMoreMenu(false); }}>
        <Chat onQuickPrompt={handleQuickPrompt} />
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="loadingBar">
          <ScaleLoader color="var(--accent)" height={18} width={2} radius={2} margin={2} />
          <span>SigmaGPT is thinking...</span>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="inputArea">
        <div className="inputBox">
          <button className={`inputIconBtn ${isListening ? "listening" : ""}`}
            onClick={toggleVoice} title={isListening ? "Stop listening" : "Voice input"}>
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <textarea
            ref={inputRef}
            className="chatTextarea"
            placeholder={isListening ? "🎙 Listening..." : "Ask SigmaGPT anything..."}
            value={prompt}
            rows={1}
            onChange={e => {
              setPrompt(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); getReply(); }
            }}
          />

          <button
            className={`sendBtn ${prompt.trim() && !isLoading ? "active" : ""}`}
            onClick={() => getReply()}
            disabled={!prompt.trim() || isLoading}
            title="Send (Enter)"
          >
            <Send size={17} />
          </button>
        </div>

        <p className="inputHint">
          Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line · SigmaGPT can make mistakes
        </p>
      </div>
    </div>
  );
}

export default ChatWindow;