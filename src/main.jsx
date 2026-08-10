import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registers the offline cache. Only runs on a built site (npm run build /
// deployed), not during `npm run dev`, so the dev server keeps hot-reloading
// normally instead of serving you a cached copy.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // No offline support if this fails; the app still works online.
    });
  });
}
