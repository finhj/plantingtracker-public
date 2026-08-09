import React, { useState } from "react";
import { supabase, usernameToEmail } from "./supabaseClient";

const PAPER = "#F1EEE2";
const INK = "#2B2A24";
const FIELD = "#4B6B3A";
const RUST = "#A0472E";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    setLoading(false);
    if (signInError) setError("That username or password isn't right. Check with whoever set up your account.");
  };

  return (
    <div style={{ background: PAPER, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif", padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 340, background: "#fff", border: `2px solid ${INK}`, borderRadius: 5, padding: 28 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: FIELD, marginBottom: 4 }}>
          Farm Map
        </div>
        <h1 style={{ fontFamily: "'Zilla Slab', serif", fontSize: 24, margin: "0 0 20px", color: INK }}>Planting Tracker</h1>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B6255", marginBottom: 4, textTransform: "uppercase" }}>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          style={{ width: "100%", padding: "10px 11px", borderRadius: 3, border: "1.5px solid #CFC7B0", fontSize: 15, marginBottom: 14, boxSizing: "border-box" }}
          placeholder="e.g. jon"
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B6255", marginBottom: 4, textTransform: "uppercase" }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "10px 11px", borderRadius: 3, border: "1.5px solid #CFC7B0", fontSize: 15, marginBottom: 16, boxSizing: "border-box" }}
        />

        {error && <div style={{ color: RUST, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", background: FIELD, color: "#fff", padding: "11px", borderRadius: 3, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ fontSize: 12, color: "#8a8272", marginTop: 14 }}>
          Accounts are set up by the farm admin — if you don't have a login yet, ask whoever manages the tracker.
        </div>
      </form>
    </div>
  );
}
