
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";

  // Protect window.ethereum from being redefined by other libraries
  // This prevents "Cannot redefine property: ethereum" errors
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const ethereum = (window as any).ethereum;
      Object.defineProperty(window, 'ethereum', {
        value: ethereum,
        writable: false,
        configurable: false,
      });
      console.log('✅ window.ethereum protected from redefinition');
    } catch (e) {
      // Already protected or cannot be protected
      console.log('ℹ️ window.ethereum already configured');
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
  