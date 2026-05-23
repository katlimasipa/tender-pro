import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Check if the service worker exists before registering (Vite PWA handles auto-register, but this is a fallback)
    // Actually vite-plugin-pwa automatically injects it in index.html when injectRegister is 'auto'.
  });
}

createRoot(document.getElementById("root")!).render(<App />);

// Remove splash screen after render
window.addEventListener('load', () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.remove();
    }, 500);
  }
});
