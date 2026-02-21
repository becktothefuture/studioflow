import React from "react";
import ReactDOM from "react-dom/client";
import { HeroLogic } from "./components/Hero/HeroLogic";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HeroLogic />
  </React.StrictMode>
);
