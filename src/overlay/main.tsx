import React from "react";
import ReactDOM from "react-dom/client";
import { Overlay } from "./Overlay";
import { installErrorForwarding } from "../shared/log";
import "../index.css";

installErrorForwarding();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>,
);
