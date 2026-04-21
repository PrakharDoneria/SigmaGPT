import "./Sidebar.css";
import { useContext, useEffect, useRef, useState } from "react";
import { MyContext } from "../context/MyContext.jsx";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Check,
  X,
  Bot,
  Code2,
  PenLine,
  Lightbulb,
  GraduationCap,
  Zap,
  Brain,
  Scale,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Upload,
  Download,
  EyeOff,
} from "lucide-react";
import {
  renameChat,
  togglePinned,
  deleteChat,
  searchChats,
} from "../utils/chatManager.js";

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
    allThreads,
    setAllThreads,
    currThreadId,
    setCurrThreadId,
    setIsNewChat,
    setPrompt,
    setReply,
    setPrevChats,
    isDarkMode,
    setIsDarkMode,
    isSidebarOpen,
    setIsSidebarOpen,
    searchQuery,
    setSearchQuery,
    selectedPersona,
    setSelectedPersona,
    selectedModel,
    setSelectedModel,
    startNewChat,
    isOnline,
    isMobile,
    triggerThemeRipple,
    syncThreads,
    updateCurrentChatTitle,
    requestRestore,
    backupData,
    isIncognito,
    toggleIncognito,
  } = useContext(MyContext);

  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [showPersonas, setShowPersonas] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const renameInputRef = useRef(null);

  // ✅ Fetch all threads
  const getAllThreads = async () => {
    setIsLoadingThreads(true);
    try {
      const res = await fetch(THREADS_URL, {
        headers: { "x-user-id": "demo-user-123" }
      });
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const data = await res.json();
      setAllThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch threads:", err.message);
      setAllThreads([]);
    }
    setIsLoadingThreads(false);
  };

  useEffect(() => { getAllThreads(); }, [currThreadId]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingId]);

  const handleThreadClick = (threadId) => {
    if (threadId === currThreadId) return;
    setCurrThreadId(threadId);
    setIsNewChat(false);
    setPrompt("");
    setReply(null);

    const thread = allThreads.find((item) => item.id === threadId);
    setPrevChats(thread?.messages || []);

    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleDelete = (event, threadId) => {
    event.stopPropagation();
    if (!window.confirm("Delete this chat?")) return;
    deleteChat(threadId);
    syncThreads();
    if (threadId === currThreadId) {
      startNewChat();
    }
    toast.success("Chat deleted.");
  };

  const handlePin = (event, threadId) => {
    event.stopPropagation();
    togglePinned(threadId);
    syncThreads();
    toast.success("Chat updated.");
    try {
      const res = await fetch(THREAD_URL(threadId), {
        headers: { "x-user-id": "demo-user-123" }
      });
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const data = await res.json();
      setPrevChats(data.messages || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load chat!");
    }
  };

  // ✅ Delete thread
  const handleDelete = async (e, threadId) => {
    e.stopPropagation();
    try {
      await fetch(THREAD_URL(threadId), { 
        method: "DELETE",
        headers: { "x-user-id": "demo-user-123" }
      });
      setAllThreads(prev => prev.filter(t => t.threadId !== threadId));
      if (threadId === currThreadId) startNewChat();
      toast.success("Chat deleted!");
    } catch { toast.error("Failed to delete!"); }
  };

  // ✅ Pin/Unpin thread
  const handlePin = async (e, threadId) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${THREAD_URL(threadId)}/pin`, { 
        method: "PUT",
        headers: { "x-user-id": "demo-user-123" }
      });
      const data = await res.json();
      setAllThreads(prev => prev.map(t =>
        t.threadId === threadId ? { ...t, pinned: data.pinned } : t
      ));
      toast.success(data.pinned ? "📌 Chat pinned!" : "Chat unpinned!");
    } catch { toast.error("Failed to pin!"); }
  };

  const startRename = (event, thread) => {
    event.stopPropagation();
    setRenamingId(thread.id);
    setRenameValue(thread.title || "");
  };

  const handleRename = (threadId) => {
    const nextTitle = renameValue.trim();
    if (!nextTitle) {
      setRenamingId(null);
      return;
    }

    renameChat(threadId, nextTitle);
    updateCurrentChatTitle(threadId, nextTitle);
    syncThreads();
  const handleRename = async (threadId) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try {
      await fetch(`${THREAD_URL(threadId)}/rename`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": "demo-user-123" 
        },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      setAllThreads(prev => prev.map(t =>
        t.threadId === threadId ? { ...t, title: renameValue.trim() } : t
      ));
      toast.success("Chat renamed!");
    } catch { toast.error("Failed to rename!"); }
    setRenamingId(null);
    toast.success("Chat renamed.");
  };

  const filtered = searchChats(searchQuery);
  const pinned = filtered.filter((thread) => thread.pinned);
  const recent = filtered.filter((thread) => !thread.pinned);

  const currentPersona = PERSONAS.find((persona) => persona.id === selectedPersona) || PERSONAS[0];
  const currentModel = MODELS.find((model) => model.id === selectedModel) || MODELS[0];

  const ThreadItem = ({ thread }) => (
    <li className={`threadItem ${thread.id === currThreadId ? "active" : ""}`} onClick={() => handleThreadClick(thread.id)}>
      {renamingId === thread.id ? (
        <div className="renameRow" onClick={(event) => event.stopPropagation()}>
          <input
            ref={renameInputRef}
            className="renameInput"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleRename(thread.id);
              if (event.key === "Escape") setRenamingId(null);
            }}
          />
          <button className="iconBtn green" onClick={() => handleRename(thread.id)}>
            <Check size={13} />
          </button>
          <button className="iconBtn red" onClick={() => setRenamingId(null)}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <div className="threadInfo">
            <span className="threadTitle">{thread.title || "New chat"}</span>
            <span className="threadDate">{formatThreadDate(thread.updatedAt)}</span>
          </div>
          <div className="threadActions">
            <button className="iconBtn" title={thread.pinned ? "Unpin" : "Pin"} onClick={(event) => handlePin(event, thread.id)}>
              {thread.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
            <button className="iconBtn" title="Rename" onClick={(event) => startRename(event, thread)}>
              <Pencil size={13} />
            </button>
            <button className="iconBtn danger" title="Delete" onClick={(event) => handleDelete(event, thread.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </li>
  );

  if (!isSidebarOpen) {
    if (isMobile) {
      return null;
    }

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

  return (
    <aside className="sidebar">
      <div className="sidebarHeader">
        <div className="logoArea">
          <span className="sigmaSymbol">Σ</span>
          <span className="appName">igmaGPT</span>
        </div>
        <div className="headerActions">
          <button className="iconBtn" title="Backup data" onClick={backupData}>
            <Download size={18} />
          </button>
          <button className="iconBtn" title="Restore data" onClick={requestRestore}>
            <Upload size={18} />
          </button>
          <button className="iconBtn" title="New Chat" onClick={startNewChat}>
            <Plus size={18} />
          </button>
          <button className="iconBtn" title="Collapse" onClick={() => setIsSidebarOpen(false)}>
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      <div className="searchRow">
        <Search size={14} className="searchIcon" />
        <input
          className="searchInput"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        {searchQuery && (
          <button className="iconBtn" onClick={() => setSearchQuery("")}>
            <X size={13} />
          </button>
        )}
      </div>

      <div className="threadList">
        {!filtered.length && <p className="emptyThreads">{searchQuery ? "No chats found" : "No chats yet — start one!"}</p>}

        {pinned.length > 0 && (
          <>
            <p className="sectionLabel"><Pin size={11} /> Pinned</p>
            <ul>{pinned.map((thread) => <ThreadItem key={thread.id} thread={thread} />)}</ul>
          </>
        )}

        {recent.length > 0 && (
          <>
            <p className="sectionLabel"><MessageSquare size={11} /> Recent</p>
            <ul>{recent.map((thread) => <ThreadItem key={thread.id} thread={thread} />)}</ul>
          </>
        )}
      </div>

      <div className="sidebarFooter">
        <div className="selectorRow">
          <button className="selectorBtn" onClick={() => { setShowPersonas(!showPersonas); setShowModels(false); }}>
            {currentPersona.icon}
            <span>{currentPersona.name}</span>
          </button>
          {showPersonas && (
            <div className="selectorMenu">
              {PERSONAS.map((persona) => (
                <button
                  key={persona.id}
                  className={`selectorItem ${selectedPersona === persona.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedPersona(persona.id);
                    setShowPersonas(false);
                    toast.success(`Switched to ${persona.name}`);
                  }}
                >
                  {persona.icon} {persona.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="selectorRow">
          <button className="selectorBtn" onClick={() => { setShowModels(!showModels); setShowPersonas(false); }}>
            {currentModel.icon}
            <span>{currentModel.name} — {currentModel.desc}</span>
          </button>
          {showModels && (
            <div className="selectorMenu">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  className={`selectorItem ${selectedModel === model.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedModel(model.id);
                    setShowModels(false);
                    toast.success(`Switched to ${model.name}`);
                  }}
                >
                  {model.icon} <span>{model.name}</span> <small>{model.desc}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="selectorRow">
          <button className="selectorBtn" onClick={(event) => triggerThemeRipple(event.currentTarget.getBoundingClientRect())}>
            {isDarkMode ? <Moon size={14} /> : <Sun size={14} />}
            <span>{isDarkMode ? "Dark" : "Light"} mode</span>
          </button>
        </div>

        <div className="selectorRow">
          <button className={`selectorBtn ${isIncognito ? "selected" : ""}`} onClick={toggleIncognito}>
            <EyeOff size={14} />
            <span>{isIncognito ? "Incognito on" : "Incognito off"}</span>
          </button>
        </div>

        <div className="footerBottom">
          <div className={`onlineBadge ${isOnline ? "online" : "offline"}`}>
            <span className="dot" /> {isOnline ? "Online" : "Offline"}
          </div>
          <button className="iconBtn" title="Theme ripple" onClick={(event) => triggerThemeRipple(event.currentTarget.getBoundingClientRect())}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <p className="poweredBy">Local-first storage · Cloud AI responses</p>
      </div>
    </aside>
  );
}

export default Sidebar;