import "./Sidebar.css";
import { useContext, useEffect, useState, useRef } from "react";
import { MyContext } from "../context/MyContext.jsx";
import toast from "react-hot-toast";
import {
  Plus, Search, Pin, PinOff, Pencil, Trash2, Check, X,
  Bot, Code2, PenLine, Lightbulb, GraduationCap,
  Zap, Brain, Scale, Sun, Moon, ChevronLeft, ChevronRight,
  MessageSquare,
} from "lucide-react";

// ✅ BASE URL
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

// ✅ Try multiple possible endpoint patterns
const POSSIBLE_ENDPOINTS = {
  THREADS: [
    `${API_BASE}/api/chat/threads`,
    `${API_BASE}/threads`,
    `${API_BASE}/api/threads`,
  ],
};

const PERSONAS = [
  { id: "general", name: "SigmaGPT", icon: <Bot size={15} /> },
  { id: "coder", name: "Sigma Coder", icon: <Code2 size={15} /> },
  { id: "writer", name: "Sigma Writer", icon: <PenLine size={15} /> },
  { id: "explainer", name: "Sigma Simplified", icon: <Lightbulb size={15} /> },
  { id: "mentor", name: "Sigma Mentor", icon: <GraduationCap size={15} /> },
];

const MODELS = [
  { id: "smart", name: "Smart", desc: "Best quality", icon: <Brain size={14} /> },
  { id: "fast", name: "Fast", desc: "Quick replies", icon: <Zap size={14} /> },
  { id: "balanced", name: "Balanced", desc: "Middle ground", icon: <Scale size={14} /> },
];

function formatThreadDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Sidebar() {
  const {
    allThreads, setAllThreads,
    currThreadId, setCurrThreadId,
    setIsNewChat, setPrompt, setReply, setPrevChats,
    isDarkMode, setIsDarkMode,
    isSidebarOpen, setIsSidebarOpen,
    searchQuery, setSearchQuery,
    selectedPersona, setSelectedPersona,
    selectedModel, setSelectedModel,
    startNewChat, isOnline,
  } = useContext(MyContext);

  // ✅ STATE
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [workingEndpoint, setWorkingEndpoint] = useState(null);

  const renameInputRef = useRef(null);

  // ✅ FETCH THREADS WITH AUTO-DETECTION
  const getAllThreads = async () => {
    setIsLoadingThreads(true);
    
    // If we already found a working endpoint, use it
    if (workingEndpoint) {
      try {
        const res = await fetch(workingEndpoint);
        if (res.ok) {
          const data = await res.json();
          setAllThreads(Array.isArray(data) ? data : []);
          setIsLoadingThreads(false);
          return;
        }
      } catch (err) {
        console.error("Failed with saved endpoint:", err);
      }
    }

    // Try all possible endpoints
    for (const endpoint of POSSIBLE_ENDPOINTS.THREADS) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const res = await fetch(endpoint);
        
        if (res.ok) {
          const data = await res.json();
          console.log(`✅ Success with: ${endpoint}`);
          setWorkingEndpoint(endpoint);
          setAllThreads(Array.isArray(data) ? data : []);
          setIsLoadingThreads(false);
          return;
        } else {
          console.log(`❌ ${endpoint} returned ${res.status}`);
        }
      } catch (err) {
        console.log(`❌ ${endpoint} failed:`, err.message);
      }
    }
    
    // All endpoints failed
    console.error("All endpoints failed");
    setAllThreads([]);
    setIsLoadingThreads(false);
  };

  useEffect(() => {
    getAllThreads();
  }, []);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingId]);

  // ✅ Get base URL for a specific thread ID
  const getThreadUrl = (threadId) => {
    if (!workingEndpoint) return null;
    return `${workingEndpoint}/${threadId}`;
  };

  // ✅ LOAD SINGLE THREAD
  const handleThreadClick = async (threadId) => {
    if (threadId === currThreadId) return;

    setCurrThreadId(threadId);
    setIsNewChat(false);
    setPrompt("");
    setReply(null);

    const url = getThreadUrl(threadId);
    if (!url) {
      toast.error("API endpoint not configured");
      return;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const data = await res.json();
      setPrevChats(data.messages || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load chat!");
    }
  };

  // ✅ DELETE THREAD
  const handleDelete = async (e, threadId) => {
    e.stopPropagation();

    const url = getThreadUrl(threadId);
    if (!url) {
      toast.error("API endpoint not configured");
      return;
    }

    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");

      setAllThreads(prev => prev.filter(t => t.threadId !== threadId));

      if (threadId === currThreadId) {
        startNewChat();
      }

      toast.success("Chat deleted!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete!");
    }
  };

  // ✅ PIN / UNPIN
  const handlePin = async (e, threadId) => {
    e.stopPropagation();

    const url = getThreadUrl(threadId);
    if (!url) {
      toast.error("API endpoint not configured");
      return;
    }

    try {
      const res = await fetch(`${url}/pin`, { method: "PUT" });
      if (!res.ok) throw new Error("Pin failed");

      const data = await res.json();

      setAllThreads(prev =>
        prev.map(t =>
          t.threadId === threadId ? { ...t, pinned: data.pinned } : t
        )
      );

      toast.success(data.pinned ? "📌 Chat pinned!" : "Chat unpinned!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to pin!");
    }
  };

  // ✅ START RENAME
  const startRename = (e, thread) => {
    e.stopPropagation();
    setRenamingId(thread.threadId);
    setRenameValue(thread.title || "");
  };

  // ✅ RENAME THREAD
  const handleRename = async (threadId) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }

    const url = getThreadUrl(threadId);
    if (!url) {
      toast.error("API endpoint not configured");
      return;
    }

    try {
      const res = await fetch(`${url}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue.trim() }),
      });

      if (!res.ok) throw new Error("Rename failed");

      setAllThreads(prev =>
        prev.map(t =>
          t.threadId === threadId ? { ...t, title: renameValue.trim() } : t
        )
      );

      toast.success("Chat renamed!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to rename!");
    }

    setRenamingId(null);
  };

  // ✅ FILTERING
  const filtered = Array.isArray(allThreads)
    ? allThreads.filter(t =>
        t.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const pinned = filtered.filter(t => t.pinned);
  const recent = filtered.filter(t => !t.pinned);

  // ✅ THREAD ITEM
  const ThreadItem = ({ thread }) => (
    <li
      className={`threadItem ${thread.threadId === currThreadId ? "active" : ""}`}
      onClick={() => handleThreadClick(thread.threadId)}
    >
      {renamingId === thread.threadId ? (
        <div className="renameRow" onClick={e => e.stopPropagation()}>
          <input
            ref={renameInputRef}
            className="renameInput"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleRename(thread.threadId);
              if (e.key === "Escape") setRenamingId(null);
            }}
          />
          <button className="iconBtn green" onClick={() => handleRename(thread.threadId)}>
            <Check size={13} />
          </button>
          <button className="iconBtn red" onClick={() => setRenamingId(null)}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <div className="threadInfo">
            <span className="threadTitle">{thread.title || "New Chat"}</span>
            <span className="threadDate">
              {formatThreadDate(thread.updatedAt)}
            </span>
          </div>

          <div className="threadActions">
            <button
              className="iconBtn"
              title={thread.pinned ? "Unpin" : "Pin"}
              onClick={e => handlePin(e, thread.threadId)}
            >
              {thread.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>

            <button
              className="iconBtn"
              title="Rename"
              onClick={e => startRename(e, thread)}
            >
              <Pencil size={13} />
            </button>

            <button
              className="iconBtn danger"
              title="Delete"
              onClick={e => handleDelete(e, thread.threadId)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </li>
  );

  // ✅ COLLAPSED STATE
  if (!isSidebarOpen) {
    return (
      <aside className="sidebar collapsed">
        <button className="collapseBtn" onClick={() => setIsSidebarOpen(true)}>
          <ChevronRight size={18} />
        </button>

        <button className="newChatIconBtn" onClick={startNewChat}>
          <Plus size={18} />
        </button>
      </aside>
    );
  }

  // ✅ MAIN RENDER
  return (
    <aside className="sidebar">
      {/* HEADER */}
      <div className="sidebarHeader">
        <div className="logoArea">
          <span className="sigmaSymbol">Σ</span>
          <span className="appName">igmaGPT</span>
        </div>

        <div className="headerActions">
          <button className="iconBtn" onClick={startNewChat}>
            <Plus size={18} />
          </button>

          <button className="iconBtn" onClick={() => setIsSidebarOpen(false)}>
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="searchRow">
        <Search size={14} className="searchIcon" />

        <input
          className="searchInput"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        {searchQuery && (
          <button className="iconBtn" onClick={() => setSearchQuery("")}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* THREAD LIST */}
      <div className="threadList">
        {/* LOADING STATE */}
        {isLoadingThreads && (
          <p className="emptyThreads">Loading chats...</p>
        )}

        {/* PINNED */}
        {!isLoadingThreads && pinned.length > 0 && (
          <>
            <p className="sectionLabel">
              <Pin size={11} /> Pinned
            </p>
            <ul>
              {pinned.map(t => (
                <ThreadItem key={t.threadId} thread={t} />
              ))}
            </ul>
          </>
        )}

        {/* RECENT */}
        {!isLoadingThreads && recent.length > 0 && (
          <>
            <p className="sectionLabel">
              <MessageSquare size={11} /> Recent
            </p>
            <ul>
              {recent.map(t => (
                <ThreadItem key={t.threadId} thread={t} />
              ))}
            </ul>
          </>
        )}

        {/* EMPTY STATE */}
        {!isLoadingThreads && filtered.length === 0 && (
          <p className="emptyThreads">
            {searchQuery ? "No chats found" : "No chats yet — start one!"}
          </p>
        )}
      </div>

      {/* FOOTER */}
      <div className="sidebarFooter">
        <div className={`onlineBadge ${isOnline ? "online" : "offline"}`}>
          <span className="dot" /> {isOnline ? "Online" : "Offline"}
        </div>

        <button
          className="iconBtn"
          onClick={() => setIsDarkMode(!isDarkMode)}
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <p className="poweredBy">Powered by Groq ⚡</p>
      </div>
    </aside>
  );
}

export default Sidebar;