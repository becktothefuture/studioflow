import { useEffect, useRef, useState } from "react";
import type { ShaderBackgroundConfig } from "../Hero/Hero.contract";

type ShaderMode = "scene" | "video" | "still";

declare global {
  interface Window {
    UnicornStudio?: {
      init?: () => void;
      isInitialized?: boolean;
    };
  }
}

const unicornScriptId = "studioflow-unicorn-sdk";
const unicornScriptUrl = "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js";

async function initializeUnicorn(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const initIfReady = () => {
    if (window.UnicornStudio?.init) {
      window.UnicornStudio.init();
      return true;
    }
    return false;
  };

  if (initIfReady()) {
    return true;
  }

  if (!window.UnicornStudio) {
    window.UnicornStudio = { isInitialized: false };
  }

  const existingScript = window.document.getElementById(unicornScriptId) as HTMLScriptElement | null;
  if (!existingScript) {
    const script = window.document.createElement("script");
    script.id = unicornScriptId;
    script.src = unicornScriptUrl;
    script.async = true;
    (window.document.head || window.document.body).appendChild(script);
  }

  await new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 80;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      if (initIfReady()) {
        window.clearInterval(intervalId);
        resolve();
        return;
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(intervalId);
        reject(new Error("Unicorn Studio init timeout"));
      }
    }, 100);
  });

  return true;
}

export function ShaderBackground({ config }: { config: ShaderBackgroundConfig }) {
  const sceneMountRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<ShaderMode>(config.motionMode === "reduced" ? "still" : "video");

  useEffect(() => {
    let active = true;

    const mountShader = async () => {
      if (config.motionMode === "reduced") {
        setMode("still");
        return;
      }

      if (!sceneMountRef.current) {
        setMode("video");
        return;
      }

      try {
        sceneMountRef.current.setAttribute("data-us-project", config.projectId);
        const initialized = await initializeUnicorn();

        if (!active || !sceneMountRef.current || !initialized) {
          return;
        }
        setMode("scene");
      } catch {
        setMode("video");
      }
    };

    void mountShader();

    return () => {
      active = false;
    };
  }, [config.motionMode, config.projectId]);

  return (
    <div className="shader-bg" aria-hidden="true">
      <div
        ref={sceneMountRef}
        className="shader-scene-layer"
        data-us-project={config.projectId}
        style={{ width: "100%", height: "100%" }}
      />
      {mode === "video" ? (
        <video className="shader-fallback-video" autoPlay muted loop playsInline preload="auto">
          <source src={config.fallbackVideoWebm} type="video/webm" />
          <source src={config.fallbackVideoMp4} type="video/mp4" />
        </video>
      ) : null}
      {mode === "still" ? <img className="shader-fallback-still" src={config.fallbackStill} alt="" /> : null}
    </div>
  );
}
