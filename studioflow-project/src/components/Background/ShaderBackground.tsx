import { useEffect, useRef, useState } from "react";
import type { ShaderBackgroundConfig } from "../Hero/Hero.contract";

type ShaderMode = "scene" | "video" | "still";

interface UnicornScene {
  destroy?: () => void;
}

interface UnicornStudioRuntime {
  addScene: (config: Record<string, unknown>) => Promise<UnicornScene | undefined>;
}

declare global {
  interface Window {
    UnicornStudio?: UnicornStudioRuntime;
  }
}

const unicornScriptId = "studioflow-unicorn-sdk";
const unicornScriptUrl = "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.1/dist/unicornStudio.umd.js";

async function ensureUnicornRuntime(): Promise<UnicornStudioRuntime> {
  if (typeof window === "undefined") {
    throw new Error("Window is unavailable");
  }

  if (window.UnicornStudio?.addScene) {
    return window.UnicornStudio;
  }

  const existingScript = window.document.getElementById(unicornScriptId) as HTMLScriptElement | null;
  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      const onLoad = () => {
        existingScript.removeEventListener("load", onLoad);
        existingScript.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        existingScript.removeEventListener("load", onLoad);
        existingScript.removeEventListener("error", onError);
        reject(new Error("Shader runtime failed to load"));
      };
      existingScript.addEventListener("load", onLoad);
      existingScript.addEventListener("error", onError);
      window.setTimeout(() => {
        existingScript.removeEventListener("load", onLoad);
        existingScript.removeEventListener("error", onError);
        if (window.UnicornStudio?.addScene) {
          resolve();
          return;
        }
        reject(new Error("Shader runtime timeout"));
      }, 9000);
    });
  } else {
    await new Promise<void>((resolve, reject) => {
      const script = window.document.createElement("script");
      script.id = unicornScriptId;
      script.src = unicornScriptUrl;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Shader runtime failed to load"));
      window.document.head.appendChild(script);
    });
  }

  if (!window.UnicornStudio?.addScene) {
    throw new Error("Shader runtime unavailable");
  }

  return window.UnicornStudio;
}

export function ShaderBackground({ config }: { config: ShaderBackgroundConfig }) {
  const sceneMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<UnicornScene | null>(null);
  const [mode, setMode] = useState<ShaderMode>(config.motionMode === "reduced" ? "still" : "video");

  useEffect(() => {
    let active = true;

    const mountScene = async () => {
      if (config.motionMode === "reduced") {
        setMode("still");
        return;
      }

      if (!sceneMountRef.current) {
        setMode("video");
        return;
      }

      try {
        const runtime = await ensureUnicornRuntime();
        if (!active || !sceneMountRef.current) {
          return;
        }

        if (!sceneMountRef.current.id) {
          sceneMountRef.current.id = "studioflow-unicorn-background";
        }

        const scene = await runtime.addScene({
          elementId: sceneMountRef.current.id,
          projectId: config.projectId,
          scale: 1,
          dpi: 1.5,
          fps: 60,
          lazyLoad: false,
          production: true,
          altText: "StudioFlow shader background",
          ariaLabel: "StudioFlow shader background"
        });

        if (!active) {
          scene?.destroy?.();
          return;
        }

        if (scene) {
          sceneRef.current = scene;
          setMode("scene");
          return;
        }

        setMode("video");
      } catch {
        setMode("video");
      }
    };

    void mountScene();

    return () => {
      active = false;
      if (sceneRef.current?.destroy) {
        sceneRef.current.destroy();
      }
      sceneRef.current = null;
    };
  }, [config]);

  return (
    <div className="shader-bg" aria-hidden="true">
      <div ref={sceneMountRef} className="shader-scene-layer" />
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
