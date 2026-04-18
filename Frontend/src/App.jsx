import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Toaster } from "react-hot-toast";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import { MyContext } from "./context/MyContext.jsx";
import "./App.css";

function App() {
  // ✅ Core states
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(null);
  const [currThreadId, setCurrThreadId] = useState(uuidv4());
  const [prevChats, setPrevChats] = useState([]);
  const [allThreads, setAllThreads] = useState([]);
  const [isNewChat, setIsNewChat] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true); // Dark by default
  const [searchQuery, setSearchQuery] = useState("");

  // ✅ AI settings
  const [selectedPersona, setSelectedPersona] = useState("general");
  const [selectedModel, setSelectedModel] = useState("smart");

  // ✅ Voice states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ✅ Online/Offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ✅ Detect online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ✅ Apply dark/light mode to entire app
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
  }, [isDarkMode]);

  // ✅ Start a brand new chat
  const startNewChat = () => {
    setCurrThreadId(uuidv4());
    setPrevChats([]);
    setReply(null);
    setPrompt("");
    setIsNewChat(true);
  };

  // ✅ Switch to existing thread
  const switchThread = (threadId) => {
    setCurrThreadId(threadId);
    setIsNewChat(false);
    setPrompt("");
    setReply(null);
  };

  const providerValues = {
    // Chat
    prompt, setPrompt,
    reply, setReply,
    currThreadId, setCurrThreadId,
    prevChats, setPrevChats,
    allThreads, setAllThreads,
    isNewChat, setIsNewChat,
    isLoading, setIsLoading,

    // UI
    isSidebarOpen, setIsSidebarOpen,
    isDarkMode, setIsDarkMode,
    searchQuery, setSearchQuery,

    // AI
    selectedPersona, setSelectedPersona,
    selectedModel, setSelectedModel,

    // Voice
    isListening, setIsListening,
    isSpeaking, setIsSpeaking,

    // Network
    isOnline,

    // Functions
    startNewChat,
    switchThread,
  };

  return (
    <MyContext.Provider value={providerValues}>
      <div className={`app ${isDarkMode ? "dark" : "light"} ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>

        {/* ✅ Online/Offline banner */}
        {!isOnline && (
          <div className="offline-banner">
            ⚡ You're offline — SigmaGPT needs internet to respond
          </div>
        )}

        {/* ✅ Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: isDarkMode ? "#1e1e2e" : "#ffffff",
              color: isDarkMode ? "#ffffff" : "#000000",
              border: "1px solid #7c3aed",
            },
          }}
        />

        <Sidebar />
        <ChatWindow />
      </div>
    </MyContext.Provider>
  );
}

export default App;