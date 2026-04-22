import { useState } from "react";
import { signInWithGoogle, signInWithEmail, registerWithEmail } from "../utils/firebase.js";
import "./Login.css";

function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError("Google sign-in failed. Try again.");
    }
    setLoading(false);
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      if (isRegister) {
        await registerWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      const messages = {
        "auth/user-not-found":     "No account found with this email.",
        "auth/wrong-password":     "Incorrect password.",
        "auth/email-already-in-use": "Email already in use.",
        "auth/invalid-email":      "Invalid email address.",
        "auth/too-many-requests":  "Too many attempts. Try again later.",
        "auth/invalid-credential": "Invalid email or password.",
      };
      setError(messages[err.code] || "Authentication failed. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="loginPage">
      <div className="loginCard">
        {/* Logo */}
        <div className="loginLogo">
          <span className="loginSigma">Σ</span>
          <span className="loginName">igmaGPT</span>
        </div>

        <p className="loginTagline">Your intelligent AI assistant</p>

        {/* Google button */}
        <button className="googleBtn" onClick={handleGoogle} disabled={loading}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Continue with Google
        </button>

        <div className="loginDivider">
          <span>or</span>
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className="loginForm">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="loginInput"
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="loginInput"
            disabled={loading}
          />

          {error && <p className="loginError">{error}</p>}

          <button type="submit" className="loginBtn" disabled={loading}>
            {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Toggle */}
        <p className="loginToggle">
          {isRegister ? "Already have an account?" : "Don't have an account?"}
          <button onClick={() => { setIsRegister(!isRegister); setError(""); }}>
            {isRegister ? "Sign In" : "Create Account"}
          </button>
        </p>

        <p className="loginFooter">Powered by Groq ⚡ · Free forever</p>
      </div>
    </div>
  );
}

export default Login;