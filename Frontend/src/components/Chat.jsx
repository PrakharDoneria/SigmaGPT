import "./Chat.css";
import { useContext, useState } from "react";
import { MyContext } from "../context/MyContext.jsx";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";
import { Copy, Check, Volume2, VolumeX, User, Bot, Zap, Code2, PenLine, Lightbulb, GraduationCap } from "lucide-react";
import toast from "react-hot-toast";

/* ── Persona icons ── */
const PERSONA_ICONS = {
  general:   <Bot size={16} />,
  coder:     <Code2 size={16} />,
  writer:    <PenLine size={16} />,
  explainer: <Lightbulb size={16} />,
  mentor:    <GraduationCap size={16} />,
};

/* ── Format timestamp ── */
function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}

/* ── Code block with copy button ── */
function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="codeBlock">
      <div className="codeHeader">
        <span className="codeLang">{className?.replace("language-", "") || "code"}</span>
        <button className="copyCodeBtn" onClick={handleCopy}>
          {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <code className={className}>{children}</code>
    </div>
  );
}

/* ── Single message ── */
function Message({ chat, isStreaming }) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const isUser = chat.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(chat.content);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!window.speechSynthesis) { toast.error("Voice not supported!"); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const clean = chat.content.replace(/[#*`_~\[\]]/g, "").replace(/\n+/g, " ");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`messageRow ${isUser ? "userRow" : "assistantRow"}`}>
      {!isUser && (
        <div className="avatar assistantAvatar">
          {PERSONA_ICONS[chat.persona] || <Bot size={16} />}
        </div>
      )}

      <div className={`bubble ${isUser ? "userBubble" : "assistantBubble"}`}>
        {isUser ? (
          <p className="userText">{chat.content}</p>
        ) : (
          <div className="markdownBody">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  if (inline) return <code className="inlineCode" {...props}>{children}</code>;
                  return <CodeBlock className={className}>{children}</CodeBlock>;
                },
              }}
            >
              {chat.content}
            </ReactMarkdown>
            {isStreaming && <span className="cursor" />}
          </div>
        )}

        {/* Message footer */}
        <div className="messageFooter">
          <span className="msgTime">{formatTime(chat.timestamp)}</span>
          {!isStreaming && (
            <div className="msgActions">
              <button className="msgActionBtn" title="Copy" onClick={handleCopy}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              {!isUser && (
                <button className="msgActionBtn" title="Read aloud" onClick={handleSpeak}>
                  {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="avatar userAvatar">
          <User size={16} />
        </div>
      )}
    </div>
  );
}

/* ── Quick prompt cards ── */
const QUICK_PROMPTS = [
  { icon: <Code2 size={18} />, title: "Write code", desc: "Write a Python function that..." },
  { icon: <Lightbulb size={18} />, title: "Explain simply", desc: "Explain quantum computing simply" },
  { icon: <PenLine size={18} />, title: "Write for me", desc: "Help me draft an email to..." },
  { icon: <Bot size={18} />, title: "Solve a problem", desc: "How do I debug this error..." },
];

/* ── Main Chat component ── */
function Chat({ onQuickPrompt }) {
  const { isNewChat, prevChats, isLoading } = useContext(MyContext);

  /* Empty state */
  if (isNewChat && prevChats.length === 0) {
    return (
      <div className="emptyState">
        <div className="emptyLogo">
          <span className="emptySigma">Σ</span>
          <span className="emptyName">igmaGPT</span>
        </div>
        <p className="emptyTagline">Your intelligent AI assistant — fast, free, powerful.</p>
        <div className="quickPrompts">
          {QUICK_PROMPTS.map((q, i) => (
            <button key={i} className="quickCard" onClick={() => onQuickPrompt && onQuickPrompt(q.desc)}>
              <span className="quickIcon">{q.icon}</span>
              <span className="quickTitle">{q.title}</span>
              <span className="quickDesc">{q.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="chatMessages">
      {prevChats.map((chat, idx) => {
        const isLast = idx === prevChats.length - 1;
        const isStreaming = isLast && chat.role === "assistant" && isLoading;
        return <Message key={idx} chat={chat} isStreaming={isStreaming} />;
      })}
    </div>
  );
}

export default Chat;