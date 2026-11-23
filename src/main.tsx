import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import App from "./App";
import { isAndroid, isLinux } from "./lib/platform";
import { langOf } from "./lib/i18n";
import "./styles.css";

if (isAndroid) document.documentElement.classList.add("android");
if (isLinux) document.documentElement.classList.add("linux");
document.documentElement.lang = langOf();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
