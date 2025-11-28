import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeFirebase } from "./lib/firebase";

// Initialize Firebase before rendering the app
initializeFirebase();

createRoot(document.getElementById("root")!).render(<App />);
