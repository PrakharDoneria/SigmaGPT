import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// ✅ App.css MUST be first — loads CSS variables for entire app
import "./App.css";

import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);