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
import { getIdToken } from "../utils/firebase"; // ✅ FIX

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

const CHAT_URL = `${API_BASE}/api/chat/chat`;
const THREADS_URL = `${API_BASE}/api/chat/threads`;

function ChatWindow() {
  const {
    prompt, setPrompt,
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const chatBodyRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // ✅ Auto scroll
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [prevChats]);

  // ✅ MAIN CHAT FUNCTION (FULL FIXED)
  const getReply = async (overridePrompt) => {
    const text = (overridePrompt || prompt).trim();
    if (!text || isLoading) return;

    if (!isOnline) {
      toast.error("You're offline!");
      return;
    }

    setIsLoading(true);
    setIsNewChat(false);
    setPrompt("");

    const userMsg = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    // ✅ FIXED STATE UPDATE
    setPrevChats(prev => [
      ...prev,
      userMsg,
      {
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        persona: selectedPersona,
      }
    ]);

    try {
      const token = await getIdToken();

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          Authorization: `Bearer ${token}`, // ✅ CRITICAL FIX
        },
        body: JSON.stringify({
          message: text,
          threadId: currThreadId,
          persona: selectedPersona,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Chat API Error:", response.status, errText);
        throw new Error(`API Error: ${response.status}`);
      }

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
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + data.chunk,
                };
                return updated;
              });
            }

            if (data.done) {
              try {
                const token = await getIdToken();

                const res = await fetch(THREADS_URL, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });

                if (res.ok) {
                  const threads = await res.json();
                  setAllThreads(Array.isArray(threads) ? threads : []);
                }
              } catch (e) {
                console.error("Thread refresh failed:", e);
              }
            }
          } catch {}
        }
      }

    } catch (err) {
      console.error("Chat error:", err);
      toast.error("Failed to get response");
      setPrevChats(prev => prev.slice(0, -1));
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  // ✅ VOICE INPUT (UNCHANGED)
  const toggleVoice = () => {
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      toast.error("Voice not supported");
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

    recognition.onresult = (e) => {
      setPrompt(e.results[0][0].transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // ✅ EXPORT TXT
  const exportTXT = () => {
    if (!prevChats.length) return;

    const text = prevChats.map(c => `${c.role}: ${c.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chat.txt";
    a.click();
  };

  // ✅ EXPORT PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    prevChats.forEach(chat => {
      const lines = doc.splitTextToSize(chat.content, 170);
      doc.text(lines, 20, y);
      y += lines.length * 6;
    });

    doc.save("chat.pdf");
  };

  // ✅ CLEAR CHAT FIXED
  const clearChat = async () => {
    if (!window.confirm("Clear all chats?")) return;

    try {
      const token = await getIdToken();

      await fetch(THREADS_URL, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      startNewChat();
      setAllThreads([]);
      toast.success("Chats cleared");
    } catch {
      toast.error("Failed to clear chats");
    }
  };

  return (
    <div className="chatWindow">

      {/* NAVBAR */}
      <div className="navbar">
        <div className="navLeft">
          {!isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(true)}>
              <Menu size={18} />
            </button>
          )}
        </div>

        <div className="navRight">
          <button onClick={() => setShowExportMenu(!showExportMenu)}>
            <Download />
          </button>

          {showExportMenu && (
            <div>
              <button onClick={exportTXT}>TXT</button>
              <button onClick={exportPDF}>PDF</button>
            </div>
          )}

          <button onClick={() => setShowMoreMenu(!showMoreMenu)}>
            <MoreVertical />
          </button>

          {showMoreMenu && (
            <div>
              <button onClick={startNewChat}>
                <RefreshCw /> New
              </button>
              <button onClick={clearChat}>
                <Trash2 /> Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CHAT */}
      <div className="chatBody" ref={chatBodyRef}>
        <Chat />
      </div>

      {/* LOADING */}
      {isLoading && <ScaleLoader />}

      {/* INPUT */}
      <div className="inputArea">
        <button onClick={toggleVoice}>
          {isListening ? <MicOff /> : <Mic />}
        </button>

        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              getReply();
            }
          }}
        />

        <button onClick={getReply}>
          <Send />
        </button>
      </div>

    </div>
  );
}

export default ChatWindow;