import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import { MyContext } from "./context/MyContext.jsx";
import {
  createChat,
  createSessionChat,
  createFallbackTitle,
  exportSnapshot,
  getChat,
  getLatestChatId,
  getSettings,
  importSnapshot,
  listChats,
  renameChat,
  renameSessionChat,
  replaceChatMessages,
  replaceSessionChatMessages,
  clearSessionChats,
  deleteChat,
  togglePinned,
  toggleSessionPinned,
  updateChat,
  updateSessionChat,
  updateSettings,
  isSessionChat,
} from "./utils/chatManager.js";
import "./App.css";

const DEFAULT_THEME = import.meta.env.VITE_DEFAULT_THEME || "dark";

const parseChatId = (pathname) => {
  const match = pathname.match(/^\/c\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

const isMobileViewport = () =>
  typeof window !== "undefined" ? window.innerWidth < 840 : false;

const buildAnchorDownload = (filename, content) => {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeChatId = parseChatId(location.pathname);
  const fileInputRef = useRef(null);
  const themeRippleTimerRef = useRef(null);

  const storedSettings = useMemo(() => getSettings(), []);
  const [allThreads, setAllThreads] = useState(() => listChats());
  const [currThreadId, setCurrThreadIdState] = useState(routeChatId || getLatestChatId());
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(null);
  const [prevChats, setPrevChatsState] = useState([]);
  const [isNewChat, setIsNewChat] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    storedSettings.sidebarOpen ?? !isMobileViewport()
  );
  const [isDarkMode, setIsDarkMode] = useState((storedSettings.theme || DEFAULT_THEME) === "dark");
  const [searchQuery, setSearchQuery] = useState(storedSettings.searchQuery || "");
  const [selectedPersona, setSelectedPersona] = useState(storedSettings.selectedPersona || "general");
  const [selectedModel, setSelectedModel] = useState(storedSettings.selectedModel || "smart");
  const [isIncognito, setIsIncognito] = useState(Boolean(storedSettings.isIncognito));
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [themeRipple, setThemeRipple] = useState(null);
  const [isMobile, setIsMobile] = useState(isMobileViewport());

  const syncThreads = useCallback(() => {
    setAllThreads(listChats());
  }, []);

  const getCurrentChat = () => (currThreadId ? getChat(currThreadId) : null);

  const getCurrentChatTitle = () => getCurrentChat()?.title || "Untitled chat";

  const setPrevChats = useCallback((updater) => {
    setPrevChatsState((current) => {
      const nextValue = typeof updater === "function" ? updater(current) : updater;
      if (currThreadId) {
        if (isSessionChat(currThreadId)) {
          replaceSessionChatMessages(currThreadId, nextValue);
        } else {
          replaceChatMessages(currThreadId, nextValue);
        }
        syncThreads();
      }
      return nextValue;
    });
  }, [currThreadId, syncThreads]);

  const openChat = (chatId) => {
    if (!chatId) return;
    navigate(`/c/${chatId}`);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const setCurrThreadId = (chatId) => {
    openChat(chatId);
  };

  const startNewChat = () => {
    const createFn = isIncognito ? createSessionChat : createChat;
    const chat = createFn({
      title: "Untitled chat",
      persona: selectedPersona,
      model: selectedModel,
      incognito: isIncognito,
    });
    syncThreads();
    setPrompt("");
    setReply(null);
    setPrevChatsState([]);
    setIsNewChat(true);
    openChat(chat.id);
    return chat.id;
  };

  const switchThread = (chatId) => {
    if (chatId && chatId !== currThreadId) {
      openChat(chatId);
    }
  };

  const removeChat = (chatId) => {
    if (!chatId) return;

    deleteChat(chatId);
    syncThreads();

    if (chatId === currThreadId) {
      startNewChat();
    }
  };

  const updateCurrentChatTitle = (chatId, title) => {
    if (!chatId) return;
    if (isSessionChat(chatId)) {
      renameSessionChat(chatId, title);
    } else {
      renameChat(chatId, title);
    }
    syncThreads();
  };

  const toggleCurrentPin = (chatId) => {
    if (!chatId) return;
    if (isSessionChat(chatId)) {
      toggleSessionPinned(chatId);
    } else {
      togglePinned(chatId);
    }
    syncThreads();
  };

  const toggleIncognito = () => {
    if (!currThreadId) {
      setIsIncognito((current) => !current);
      return;
    }

    const currentChat = getCurrentChat();

    if (!isIncognito) {
      createSessionChat({
        id: currThreadId,
        title: currentChat?.title || "Untitled chat",
        persona: currentChat?.persona || selectedPersona,
        model: currentChat?.model || selectedModel,
        messages: currentChat?.messages || prevChats,
        pinned: currentChat?.pinned || false,
      });
      setIsIncognito(true);
    } else {
      const sessionSnapshot = getChat(currThreadId);
      if (sessionSnapshot) {
        const persistentChat = createChat({
          id: currThreadId,
          title: sessionSnapshot.title,
          persona: sessionSnapshot.persona,
          model: sessionSnapshot.model,
          messages: sessionSnapshot.messages,
          pinned: sessionSnapshot.pinned,
        });
        updateChat(persistentChat.id, {
          title: sessionSnapshot.title,
          persona: sessionSnapshot.persona,
          model: sessionSnapshot.model,
          messages: sessionSnapshot.messages,
          pinned: sessionSnapshot.pinned,
        });
      }
      deleteChat(currThreadId);
      setIsIncognito(false);
      syncThreads();
    }
  };

  const backupData = () => {
    buildAnchorDownload(
      `sigmagpt-backup-${new Date().toISOString().slice(0, 10)}.json`,
      exportSnapshot()
    );
  };

  const restoreData = async (file) => {
    const text = await file.text();
    clearSessionChats();
    importSnapshot(text);
    syncThreads();

    const restoredId = getLatestChatId() || createChat({ title: "Untitled chat" }).id;
    syncThreads();
    navigate(`/c/${restoredId}`, { replace: true });
  };

  const requestRestore = () => fileInputRef.current?.click();

  const triggerThemeRipple = (originRect) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const x = originRect ? originRect.left + originRect.width / 2 : viewportWidth - 44;
    const y = originRect ? originRect.top + originRect.height / 2 : 44;
    const radius = Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y)) + 40;
    const nextTheme = isDarkMode ? "light" : "dark";

    document.documentElement.style.setProperty("--theme-ripple-x", `${x}px`);
    document.documentElement.style.setProperty("--theme-ripple-y", `${y}px`);
    document.documentElement.style.setProperty("--theme-ripple-size", `${radius}px`);

    setThemeRipple({ x, y, radius, nextTheme });

    if (themeRippleTimerRef.current) {
      window.clearTimeout(themeRippleTimerRef.current);
    }

    requestAnimationFrame(() => {
      setIsDarkMode((current) => !current);
      themeRippleTimerRef.current = window.setTimeout(() => setThemeRipple(null), 650);
    });
  };

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onResize = () => setIsMobile(isMobileViewport());

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    updateSettings({
      theme: isDarkMode ? "dark" : "light",
      sidebarOpen: isSidebarOpen,
      selectedPersona,
      selectedModel,
      searchQuery,
      isIncognito,
    });
  }, [isDarkMode, isSidebarOpen, selectedPersona, selectedModel, searchQuery, isIncognito]);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!routeChatId) {
      const firstChatId = getLatestChatId() || (isIncognito
        ? createSessionChat({ title: "Untitled chat", persona: selectedPersona, model: selectedModel }).id
        : createChat({ title: "Untitled chat", persona: selectedPersona, model: selectedModel }).id);
      syncThreads();
      navigate(`/c/${firstChatId}`, { replace: true });
      return;
    }

    const chat = getChat(routeChatId) || (isIncognito
      ? createSessionChat({
        id: routeChatId,
        title: createFallbackTitle(routeChatId),
        persona: selectedPersona,
        model: selectedModel,
      })
      : createChat({
      id: routeChatId,
      title: createFallbackTitle(routeChatId),
      persona: selectedPersona,
      model: selectedModel,
    }));

    setCurrThreadIdState(chat.id);
    setPrevChatsState(chat.messages);
    setPrompt("");
    setReply(null);
    setIsNewChat(chat.messages.length === 0);
    setIsLoadingConversation(true);
    setIsIncognito(Boolean(chat.incognito));
    syncThreads();

    const frame = window.requestAnimationFrame(() => setIsLoadingConversation(false));
    return () => window.cancelAnimationFrame(frame);
  }, [routeChatId, navigate]);

  useEffect(() => {
    if (!currThreadId) return;
    updateChat(currThreadId, {
      persona: selectedPersona,
      model: selectedModel,
    });
    syncThreads();
  }, [selectedPersona, selectedModel, currThreadId]);

  const providerValues = {
    prompt,
    setPrompt,
    reply,
    setReply,
    currThreadId,
    setCurrThreadId,
    currentChatTitle: getCurrentChatTitle(),
    prevChats,
    setPrevChats,
    allThreads,
    setAllThreads: syncThreads,
    isNewChat,
    setIsNewChat,
    isLoading,
    setIsLoading,
    isLoadingConversation,
    setIsLoadingConversation,
    isSidebarOpen,
    setIsSidebarOpen,
    isDarkMode,
    setIsDarkMode,
    isIncognito,
    setIsIncognito,
    searchQuery,
    setSearchQuery,
    selectedPersona,
    setSelectedPersona,
    selectedModel,
    setSelectedModel,
    isListening,
    setIsListening,
    isSpeaking,
    setIsSpeaking,
    isOnline,
    isMobile,
    themeRipple,
    triggerThemeRipple,
    startNewChat,
    switchThread,
    removeChat,
    updateCurrentChatTitle,
    toggleCurrentPin,
    toggleIncognito,
    backupData,
    requestRestore,
    restoreData,
    syncThreads,
  };

  return (
    <MyContext.Provider value={providerValues}>
      <div className={`appShell ${isDarkMode ? "theme-dark" : "theme-light"} ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        {themeRipple && (
          <div
            className={`themeRipple ${themeRipple.nextTheme}`}
            style={{
              left: "var(--theme-ripple-x)",
              top: "var(--theme-ripple-y)",
              width: "var(--theme-ripple-size)",
              height: "var(--theme-ripple-size)",
            }}
            aria-hidden="true"
          />
        )}

        {!isOnline && (
          <div className="offlineBanner">You are offline. Chat history is still available locally.</div>
        )}

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: isDarkMode ? "#111827" : "#ffffff",
              color: isDarkMode ? "#f8fafc" : "#111827",
              border: isDarkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.08)",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
            },
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) {
              await restoreData(file);
            }
            event.target.value = "";
          }}
        />

        {isMobile && isSidebarOpen && (
          <button
            className="sidebarBackdrop"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        <Sidebar />
        <ChatWindow />
      </div>
    </MyContext.Provider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="/c/:chatId" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;