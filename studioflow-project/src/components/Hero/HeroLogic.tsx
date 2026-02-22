import { useCallback, useEffect, useMemo, useState } from "react";
import shaderLoopMp4 from "../../../assets/studioflow-shader-loop.mp4";
import shaderLoopWebm from "../../../assets/studioflow-shader-loop.webm";
import shaderStill from "../../../assets/studioflow-shader-still.png";
import { HeroLayout } from "./HeroLayout";
import type { LandingContent, MotionMode, ShaderBackgroundConfig } from "./Hero.contract";

const introStorageKey = "sf_intro_seen_v1";

function preferredBehavior(mode: MotionMode): ScrollBehavior {
  return mode === "full" ? "smooth" : "auto";
}

export function HeroLogic() {
  const [motionMode, setMotionMode] = useState<MotionMode>("full");
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotionMode = () => {
      setMotionMode(mediaQuery.matches ? "reduced" : "full");
    };

    applyMotionMode();
    mediaQuery.addEventListener("change", applyMotionMode);

    return () => {
      mediaQuery.removeEventListener("change", applyMotionMode);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (motionMode === "reduced") {
      setShowIntro(false);
      window.localStorage.setItem(introStorageKey, "1");
      return;
    }

    const hasSeenIntro = window.localStorage.getItem(introStorageKey) === "1";
    if (hasSeenIntro) {
      setShowIntro(false);
      return;
    }

    setShowIntro(true);
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(introStorageKey, "1");
      setShowIntro(false);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [motionMode]);

  const scrollTo = useCallback(
    (id: string) => {
      if (typeof window === "undefined") {
        return;
      }

      const section = window.document.getElementById(id);
      if (!section) {
        return;
      }

      section.scrollIntoView({ behavior: preferredBehavior(motionMode), block: "start" });
    },
    [motionMode]
  );

  const onPrimaryAction = useCallback(() => {
    scrollTo("how-to-use");
  }, [scrollTo]);

  const onSecondaryAction = useCallback(() => {
    scrollTo("proof");
  }, [scrollTo]);

  const onSkipIntro = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(introStorageKey, "1");
    }
    setShowIntro(false);
  }, []);

  const shaderConfig = useMemo<ShaderBackgroundConfig>(
    () => ({
      projectId: "03xzBn63FDhJWhV0iCYi",
      fallbackVideoWebm: shaderLoopWebm,
      fallbackVideoMp4: shaderLoopMp4,
      fallbackStill: shaderStill,
      motionMode
    }),
    [motionMode]
  );

  const content = useMemo<LandingContent>(
    () => ({
      brandName: "StudioFlow",
      tagline: "Design in Figma. Ship the same intent.",
      topLinks: [
        { label: "Why", href: "#structural-alignment-title" },
        { label: "Loop", href: "#how-to-use" },
        { label: "Anchors", href: "#intent-preservation-title" },
        { label: "Proof", href: "#proof" },
        { label: "Docs", href: "#docs" },
        { label: "Repo", href: "./README.md" }
      ],
      hero: {
        announcement: "DESIGNER ROUNDTRIP",
        kicker: "StudioFlow / Figma <-> Code",
        heading: "Approve once. Keep it true in code.",
        valueStatement:
          "StudioFlow keeps tokens and component anchors aligned so your approved design arrives in production the way you intended.",
        supportingParagraph:
          "Run one checklist, apply updates in Figma with Conduit, and send changes back to code through built-in safety checks.",
        commandLine: "$ npm run loop:figma-roundtrip",
        commandHint:
          "After you export handoff/canvas-to-code.json from Figma, run npm run loop:figma-roundtrip:apply.",
        primaryActionLabel: "See the Loop",
        secondaryActionLabel: "View Proof"
      },
      structuralAlignment: {
        title: "What Stays in Sync",
        body: "StudioFlow keeps naming, layout modes, and component anchors steady between Figma and code.",
        matrix: [
          {
            label: "Token styles",
            guarantee: "Named styles stay token-based across the full loop.",
            verification: "npm run verify:tokens-sync",
            evidence: "tokens/figma-variables.json + generated token files"
          },
          {
            label: "Breakpoints",
            guarantee: "Mobile, tablet, laptop, and desktop layouts are all checked.",
            verification: "npm run loop:verify-canvas",
            evidence: "handoff/canvas-to-code.json -> variableModes + screens"
          },
          {
            label: "Component anchors",
            guarantee: "Stable sfid anchors keep each screen part matched.",
            verification: "npm run verify:id-sync",
            evidence: "source data-sfid attributes + snapshots/*.json"
          },
          {
            label: "Safe apply",
            guarantee: "Code updates only run after payload checks pass.",
            verification: "npm run loop:verify-canvas",
            evidence: "verification gate before loop:canvas-to-code"
          }
        ]
      },
      intentPreservation: {
        title: "How the Roundtrip Works",
        body: "You move through one clear loop from code to Figma and back to code.",
        examples: [
          {
            title: "1) Send code to Figma",
            state: "Generate handoff/code-to-canvas.json from the current app state.",
            result: "Figma gets the same token and anchor map used in code.",
            verification: "npm run loop:code-to-canvas"
          },
          {
            title: "2) Edit in Figma",
            state: "Use Conduit in Figma and export handoff/canvas-to-code.json.",
            result: "Your approved edits are packaged for a safe apply step.",
            verification: "npm run loop:verify-canvas"
          },
          {
            title: "3) Apply back to code",
            state: "Run the apply wrapper to verify, apply, check, build, and create proof output.",
            result: "Code and Figma remain aligned with a review trail.",
            verification: "npm run loop:figma-roundtrip:apply"
          }
        ]
      },
      deterministicGeneration: {
        title: "Your Daily Loop",
        body: "These are the only steps most designers need each day.",
        steps: [
          {
            title: "Set up once",
            detail: "Install the project and finish MCP + Conduit setup.",
            command: "npm run setup:project",
            verification: "Use docs/MCP_SETUP.md and docs/CONDUIT_SETUP.md."
          },
          {
            title: "Prepare payload",
            detail: "Build tokens and generate the code-to-Figma payload.",
            command: "npm run build:tokens && npm run loop:code-to-canvas",
            verification: "Output file: handoff/code-to-canvas.json"
          },
          {
            title: "Run checklist",
            detail: "Print the operator checklist before editing in Figma.",
            command: "npm run loop:figma-roundtrip",
            verification: "The checklist shows steps 1 through 9."
          },
          {
            title: "Apply safely",
            detail: "After Figma export, run one command to apply and generate proof output.",
            command: "npm run loop:figma-roundtrip:apply",
            verification: "Output files: proof/latest/index.html + studioflow.manifest.json"
          }
        ]
      },
      identityParity: {
        title: "Stable Anchors",
        body: "`data-sfid` anchors keep the same UI parts connected between Figma and code.",
        rules: [
          {
            title: "Anchor continuity",
            control: "Every required sfid appears in source, payloads, and snapshots.",
            verification: "npm run verify:id-sync"
          },
          {
            title: "Token authority",
            control: "tokens/figma-variables.json remains the source for token names and values.",
            verification: "npm run verify:tokens-sync"
          },
          {
            title: "Mode coverage",
            control: "All four breakpoint modes are required in the payload.",
            verification: "npm run loop:verify-canvas"
          },
          {
            title: "Apply guard",
            control: "Code updates stop automatically if verification fails.",
            verification: "npm run loop:figma-roundtrip:apply"
          }
        ]
      },
      teamOutcomes: {
        title: "What Designers Get",
        body: "StudioFlow gives design teams a predictable handoff rhythm.",
        outcomes: [
          {
            signal: "Clear handoff steps",
            range: "One checklist",
            measurement: "The wrapper command prints exactly what to do next."
          },
          {
            signal: "Consistent breakpoints",
            range: "All 4 required",
            measurement: "Verification blocks partial payloads before apply."
          },
          {
            signal: "Token-first styling",
            range: "No random style values",
            measurement: "Token and hardcoded-style checks run before release."
          },
          {
            signal: "Review-ready proof",
            range: "Every apply",
            measurement: "Proof pages and manifest updates capture each loop."
          },
          {
            signal: "Fallback path",
            range: "Always available",
            measurement: "Use the StudioFlow Figma plugin when Conduit is unavailable."
          }
        ]
      },
      technicalFoundations: {
        title: "Helpful Docs",
        body: "Open these guides when you need setup details or deeper workflow rules.",
        foundations: [
          {
            title: "MCP setup",
            detail: "Connect Figma Dev Mode MCP (read) and Conduit (write) in your MCP client.",
            referenceLabel: "Open MCP_SETUP.md",
            referenceHref: "./docs/MCP_SETUP.md"
          },
          {
            title: "Conduit setup",
            detail: "Install and pair the Conduit MCP server and Figma plugin.",
            referenceLabel: "Open CONDUIT_SETUP.md",
            referenceHref: "./docs/CONDUIT_SETUP.md"
          },
          {
            title: "Roundtrip walkthrough",
            detail: "Follow the full demo flow from code to Figma and back.",
            referenceLabel: "Open DEMO_WEBSITE_ROUNDTRIP.md",
            referenceHref: "./docs/DEMO_WEBSITE_ROUNDTRIP.md"
          },
          {
            title: "Workflow rules",
            detail: "See the full system model and required quality gates.",
            referenceLabel: "Open STUDIOFLOW_WORKFLOW.md",
            referenceHref: "./docs/STUDIOFLOW_WORKFLOW.md"
          }
        ]
      },
      footerGroups: [
        {
          title: "Setup",
          links: [
            { label: "MCP Setup", href: "./docs/MCP_SETUP.md" },
            { label: "Conduit Setup", href: "./docs/CONDUIT_SETUP.md" }
          ]
        },
        {
          title: "Workflow",
          links: [
            { label: "Workflow Guide", href: "./docs/STUDIOFLOW_WORKFLOW.md" },
            { label: "Demo Walkthrough", href: "./docs/DEMO_WEBSITE_ROUNDTRIP.md" }
          ]
        },
        {
          title: "Evidence",
          links: [
            { label: "Manifest", href: "./studioflow.manifest.json" },
            { label: "Project README", href: "./README.md" }
          ]
        }
      ],
      legalLine: "StudioFlow // Designer roundtrip workflow // 2026"
    }),
    []
  );

  return (
    <HeroLayout
      content={content}
      motionMode={motionMode}
      showIntro={showIntro}
      shaderConfig={shaderConfig}
      onPrimaryAction={onPrimaryAction}
      onSecondaryAction={onSecondaryAction}
      onSkipIntro={onSkipIntro}
    />
  );
}
