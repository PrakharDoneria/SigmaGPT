import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "../context/MyContext.jsx";
import { useContext, useEffect, useRef, useState } from "react";
import { ScaleLoader } from "react-spinners";
import toast from "react-hot-toast";
import {
  Send,
  Mic,
  MicOff,
  MoreVertical,
  Trash2,
  RefreshCw,
  Menu,
  Copy,
  EyeOff,
  Pencil,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { requestChatReply, requestChatTitle } from "../utils/aiClient.js";
import {
  appendMessage,
  clearChats,
  clearSessionChats,
  createChat,
  getChat,
  replaceChatMessages,
  replaceSessionChatMessages,
  renameChat,
  renameSessionChat,
  appendSessionMessage,
  isSessionChat,
} from "../utils/chatManager.js";
import { useNavigate } from "react-router-dom";

const TYPE_SPEED_MS = 12;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ChatWindow() {
  const {
    prompt,
    setPrompt,
    setReply,
    currThreadId,
    currentChatTitle,
    prevChats,
    setPrevChats,
    setIsNewChat,
    isLoading,
    setIsLoading,
    selectedPersona,
    selectedModel,
    isListening,
    setIsListening,
    isOnline,
    startNewChat,
    isSidebarOpen,
    setIsSidebarOpen,
    isLoadingConversation,
    backupData,
    removeChat,
    updateCurrentChatTitle,
    toggleIncognito,
    isIncognito,
    syncThreads,
  } = useContext(MyContext);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const chatBodyRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const titleInputRef = useRef(null);
  const navigate = useNavigate();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(currentChatTitle);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [prevChats, isLoadingConversation]);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(currentChatTitle);
    }
  }, [currentChatTitle, isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const persistAssistantReply = async (chatId, response, userText, createdNewChat, assistantTempId) => {
    const chat = getChat(chatId);
    if (!chat) return;

    const assistantIndex = chat.messages.findIndex((message) => message.id === assistantTempId);

    let nextMessages = [...chat.messages];
    if (assistantIndex === -1) {
      nextMessages.push({
        id: assistantTempId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        persona: selectedPersona,
        model: response.model,
      });
    }

    setPrevChats(nextMessages);

    let streamed = "";
    for (const chunk of response.content) {
      streamed += chunk;
      setPrevChats((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((message) => message.id === assistantTempId);
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            content: streamed,
            persona: selectedPersona,
            model: response.model,
          };
        }
        return updated;
      });
      await delay(TYPE_SPEED_MS);
    }

    if (createdNewChat) {
      try {
        const { title } = await requestChatTitle(userText);
        if (title) {
          if (isSessionChat(chatId)) {
            renameSessionChat(chatId, title);
          } else {
            renameChat(chatId, title);
          }
          setTitleDraft(title);
          syncThreads();
        }
      } catch {
        const fallbackTitle = userText.split(/\s+/).slice(0, 4).join(" ");
        const title = fallbackTitle || "New chat";
        if (isSessionChat(chatId)) {
          renameSessionChat(chatId, title);
        } else {
          renameChat(chatId, title);
        }
        setTitleDraft(title);
        syncThreads();
      }
    }

    syncThreads();
    setReply(response.content);
    setIsNewChat(false);
  };

  const getReply = async (overridePrompt) => {
    const text = (overridePrompt || prompt).trim();
    if (!text || isLoading) return;
    if (!isOnline) {
      toast.error("You're offline. Reconnect to send messages.");
      return;
    }

    let chatId = currThreadId;
    let createdNewChat = false;

    if (!chatId) {
      chatId = startNewChat();
      createdNewChat = true;
    }

    const activeChat = getChat(chatId) || createChat({ id: chatId, title: "Untitled chat", persona: selectedPersona, model: selectedModel });
    if (!activeChat.messages.length) {
      createdNewChat = true;
    }

    setIsLoading(true);
    setPrompt("");

    const userMessage = {
      id: crypto?.randomUUID?.() || `${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const assistantTempId = crypto?.randomUUID?.() || `assistant_${Date.now()}`;

    if (isSessionChat(chatId)) {
      appendSessionMessage(chatId, userMessage);
    } else {
      appendMessage(chatId, userMessage);
    }
    const optimisticMessages = [...(activeChat.messages || []), userMessage, {
      id: assistantTempId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      persona: selectedPersona,
      model: selectedModel,
    }];
    setPrevChats(optimisticMessages);

    try {
      const history = optimisticMessages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .filter((message) => message.content)
        .map((message) => ({ role: message.role, content: message.content }));

      const response = await requestChatReply(history, selectedPersona, selectedModel);
      await persistAssistantReply(chatId, response, text, createdNewChat, assistantTempId);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error(error?.message || "Failed to get response. Try again.");
      const chat = getChat(chatId);
      if (chat) {
        const nextMessages = chat.messages.filter((message) => message.id !== assistantTempId);
        if (isSessionChat(chatId)) {
          replaceSessionChatMessages(chatId, nextMessages);
        } else {
          replaceChatMessages(chatId, nextMessages);
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "x-user-id": "demo-user-123", // Simulated User ID
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
        setPrevChats(nextMessages);
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const toggleVoice = () => {
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      toast.error("Voice input is not supported in this browser.");
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

    recognition.onresult = (event) => {
      setPrompt(event.results[0][0].transcript);
      setIsListening(false);
      toast.success("Voice captured");
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Voice input failed");
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const exportTXT = () => {
    if (!prevChats.length) {
      toast.error("No chat to export.");
      return;
    }

    const lines = prevChats.map((message) => {
      const who = message.role === "user" ? "You" : "SigmaGPT";
      const time = message.timestamp ? new Date(message.timestamp).toLocaleString() : "";
      return `[${time}] ${who}:\n${message.content}\n`;
    });

    const text = `SigmaGPT Chat Export\nExported: ${new Date().toLocaleString()}\n${"─".repeat(40)}\n\n${lines.join("\n")}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sigmagpt-chat-${Date.now()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as TXT.");
    setShowExportMenu(false);
  };

  const exportPDF = () => {
    if (!prevChats.length) {
      toast.error("No chat to export.");
      return;
    }

    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(18);
      doc.setTextColor(124, 58, 237);
      doc.text("SigmaGPT", 20, y);
      y += 8;

      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Exported: ${new Date().toLocaleString()}`, 20, y);
      y += 10;

      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, pageW - 20, y);
      y += 10;

      prevChats.forEach((message) => {
        const who = message.role === "user" ? "You" : "SigmaGPT";
        const time = message.timestamp
          ? new Date(message.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
          : "";

        doc.setFontSize(9);
        doc.setTextColor(124, 58, 237);
        doc.text(`${who}  ${time}`, 20, y);
        y += 6;

        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        const clean = message.content.replace(/[#*`_~]/g, "");
        const lines = doc.splitTextToSize(clean, pageW - 40);
        if (y + lines.length * 5 > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(lines, 20, y);
        y += lines.length * 5 + 8;
      });

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Powered by SigmaGPT", 20, 290);
      doc.save(`sigmagpt-chat-${Date.now()}.pdf`);
      toast.success("Exported as PDF.");
    } catch {
      toast.error("PDF export failed.");
    }

    setShowExportMenu(false);
  };

  const handleBackup = () => {
    backupData();
    toast.success("Backup downloaded.");
  };

  const clearChat = async () => {
    setShowMoreMenu(false);
    if (!window.confirm("Clear all chats? This cannot be undone.")) return;
    clearChats();
    clearSessionChats();
    const freshChatId = startNewChat();
    toast.success("All chats cleared.");
  };

  const handleDeleteCurrent = () => {
    if (!currThreadId) return;
    removeChat(currThreadId);
    toast.success("Chat deleted.");
    try {
      await fetch(THREADS_URL, { 
        method: "DELETE",
        headers: { "x-user-id": "demo-user-123" }
      });
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
    general: "SigmaGPT",
    coder: "Sigma Coder",
    writer: "Sigma Writer",
    explainer: "Sigma Simplified",
    mentor: "Sigma Mentor",
  }[selectedPersona] || "SigmaGPT";

  const currentModelLabel = { smart: "Smart", fast: "Fast", balanced: "Balanced" }[selectedModel] || "Smart";

  const saveTitle = () => {
    const nextTitle = titleDraft.trim() || "Untitled chat";
    updateCurrentChatTitle(currThreadId, nextTitle);
    setIsEditingTitle(false);
  };

  return (
    <div className="chatWindow">
      <div className="navbar">
        <div className="navLeft">
          {!isSidebarOpen && (
            <button className="navIconBtn" onClick={() => setIsSidebarOpen(true)} title="Open sidebar">
              <Menu size={18} />
            </button>
          )}
          <div className="navTitle">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                className="chatTitleInput"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveTitle();
                  }
                  if (event.key === "Escape") {
                    setIsEditingTitle(false);
                    setTitleDraft(currentChatTitle);
                  }
                }}
              />
            ) : (
              <button className="chatTitleButton" onClick={() => setIsEditingTitle(true)} title="Edit chat title">
                {currentChatTitle || currentPersonaName}
                <Pencil size={12} />
              </button>
            )}
            <span className="navModel">{currentModelLabel} · Local first</span>
          </div>
        </div>

        <div className="navRight">
          <button
            className={`navIconBtn ${isIncognito ? "active" : ""}`}
            title={isIncognito ? "Incognito on" : "Turn on incognito"}
            onClick={toggleIncognito}
          >
            <EyeOff size={17} />
          </button>
          <div className="navDropdownWrap">
            <button className="navIconBtn" title="Backup data" onClick={handleBackup}>
              <Copy size={17} />
            </button>
          </div>

          <div className="navDropdownWrap">
            <button
              className="navIconBtn"
              title="More options"
              onClick={() => {
                setShowMoreMenu(!showMoreMenu);
                setShowExportMenu(false);
              }}
            >
              <MoreVertical size={17} />
            </button>
            {showMoreMenu && (
              <div className="navDropdown">
                <button onClick={() => { startNewChat(); setShowMoreMenu(false); }}>
                  <RefreshCw size={14} /> New Chat
                </button>
                <button onClick={() => { handleDeleteCurrent(); setShowMoreMenu(false); }}>
                  <Trash2 size={14} /> Delete Chat
                </button>
                <button className="danger" onClick={clearChat}>
                  <Trash2 size={14} /> Clear All Chats
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="chatBody" ref={chatBodyRef} onClick={() => { setShowExportMenu(false); setShowMoreMenu(false); }}>
        {isLoadingConversation ? (
          <div className="chatSkeleton">
            <div className="skeletonLine short" />
            <div className="skeletonBubble" />
            <div className="skeletonBubble right" />
            <div className="skeletonBubble" />
          </div>
        ) : (
          <Chat onQuickPrompt={handleQuickPrompt} />
        )}
      </div>

      {isLoading && (
        <div className="loadingBar">
          <ScaleLoader color="var(--accent)" height={18} width={2} radius={2} margin={2} />
          <span>SigmaGPT is thinking...</span>
        </div>
      )}

      <div className="inputArea">
        <div className="inputBox">
          <button
            className={`inputIconBtn ${isListening ? "listening" : ""}`}
            onClick={toggleVoice}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <textarea
            ref={inputRef}
            className="chatTextarea"
            placeholder={isListening ? "Listening..." : "Ask SigmaGPT anything..."}
            value={prompt}
            rows={1}
            onChange={(event) => {
              setPrompt(event.target.value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                getReply();
              }
            }}
          />

          <button
            className={`sendBtn ${prompt.trim() && !isLoading ? "active" : ""}`}
            onClick={() => getReply()}
            disabled={!prompt.trim() || isLoading}
            title="Send"
          >
            <Send size={17} />
          </button>
        </div>

        <p className="inputHint">
          Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for a new line
        </p>
      </div>
    </div>
  );
}

export default ChatWindow;