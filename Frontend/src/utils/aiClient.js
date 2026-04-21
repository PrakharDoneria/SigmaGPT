const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const postJson = async (path, body) => {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`Cannot reach backend at ${API_BASE}. Start Backend server and try again.`);
  }

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new Error(error || `Request failed with status ${response.status}`);
  }

  return response.json();
};

export const requestChatReply = (messages, persona, model) =>
  postJson("/api/chat/respond", { messages, persona, model });

export const requestChatTitle = (message) =>
  postJson("/api/chat/title", { message });
