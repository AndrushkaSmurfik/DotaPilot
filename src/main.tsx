import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { installErrorForwarding } from "./shared/log";
import "./index.css";

installErrorForwarding();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
