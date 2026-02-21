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
      tagline: "One intent. Two environments. Zero drift.",
      topLinks: [
        { label: "Alignment", href: "#structural-alignment-title" },
        { label: "Intent", href: "#intent-preservation-title" },
        { label: "Workflow", href: "#how-to-use" },
        { label: "Proof", href: "#proof" },
        { label: "Docs", href: "#docs" },
        { label: "Repo", href: "./README.md" }
      ],
      hero: {
        announcement: "INTENT PRESERVATION WORKFLOW",
        kicker: "StudioFlow / Code -> Canvas -> Code",
        heading: "Preserve one intent from code to design.",
        valueStatement: "StudioFlow keeps semantic identity stable across code and design through deterministic contracts and naming parity.",
        supportingParagraph:
          "Production teams use one operational language for tokens, modes, screens, and sfids, then verify each transition with explicit gates before release.",
        commandLine: "$ npm run setup:project",
        commandHint: "Then run npm run demo:website:capture to generate proof/latest/index.html and summary-card evidence.",
        primaryActionLabel: "Start First Verified Loop",
        secondaryActionLabel: "Inspect Proof + Guarantees"
      },
      structuralAlignment: {
        title: "Structural Alignment",
        body: "Shared schema keeps token vocabulary, breakpoint modes, screen definitions, and stable identifiers aligned across every environment.",
        matrix: [
          {
            label: "Token frame coverage",
            guarantee: "Required token frames are present and complete.",
            verification: "npm run loop:verify-canvas",
            evidence: "handoff/canvas-to-code.json -> tokenFrames"
          },
          {
            label: "Breakpoint mode coverage",
            guarantee: "mobile/tablet/laptop/desktop modes are validated with expected widths.",
            verification: "npm run loop:verify-canvas",
            evidence: "handoff/canvas-to-code.json -> variableModes"
          },
          {
            label: "Screen parity",
            guarantee: "All four breakpoint screens are required for apply.",
            verification: "npm run loop:verify-canvas",
            evidence: "handoff/canvas-to-code.json -> screens"
          },
          {
            label: "Stable identity parity",
            guarantee: "All required sfids remain aligned across code and payload.",
            verification: "npm run verify:id-sync",
            evidence: "snapshots/*.json and source data-sfid attributes"
          }
        ]
      },
      intentPreservation: {
        title: "Preserving Intent Across Environments",
        body: "Intent survives each transition when naming, token semantics, and screen coverage map to one contract model.",
        examples: [
          {
            title: "Code to canvas",
            state: "Source components emit canonical payload structure and sfid identity into handoff/code-to-canvas.json.",
            result: "Figma receives the same semantic map used in code review and release checks.",
            verification: "npm run loop:code-to-canvas"
          },
          {
            title: "Canvas to contract",
            state: "Approved edits return through handoff/canvas-to-code.json with complete token and mode coverage.",
            result: "Contract gates confirm parity before code changes are accepted.",
            verification: "npm run loop:verify-canvas"
          },
          {
            title: "Contract to source",
            state: "Verified payload updates token sources and generated artifacts in one deterministic apply step.",
            result: "Code and design remain synchronized through one intent model.",
            verification: "npm run loop:canvas-to-code"
          }
        ]
      },
      deterministicGeneration: {
        title: "Deterministic Code-to-Canvas Generation",
        body: "The workflow emits repeatable payloads, validates constraints, and records evidence for each approved loop.",
        steps: [
          {
            title: "Initialize operator baseline",
            detail: "Install dependencies, configure agent tooling, and run baseline checks before edits begin.",
            command: "npm run setup:project",
            verification: "Validation target: check + build pass in local environment."
          },
          {
            title: "Generate canonical payload",
            detail: "Export code state into handoff/code-to-canvas.json for deterministic downstream processing.",
            command: "npm run loop:code-to-canvas",
            verification: "Evidence file: handoff/code-to-canvas.json."
          },
          {
            title: "Enforce contract gates",
            detail: "Validate frames, modes, screens, and sfids before any source mutation is accepted.",
            command: "npm run loop:verify-canvas",
            verification: "Evidence file: studioflow.manifest.json gate status."
          },
          {
            title: "Apply and record proof",
            detail: "Apply verified payloads and publish review artifacts tied to the current loop state.",
            command: "npm run loop:canvas-to-code && npm run loop:proof && npm run manifest:update",
            verification: "Evidence files: proof/latest/index.html and studioflow.manifest.json."
          }
        ]
      },
      identityParity: {
        title: "Naming and Component Identity Parity",
        body: "Stable naming controls preserve component identity and semantic meaning across generated payloads and source assets.",
        rules: [
          {
            title: "sfid continuity",
            control: "Every required sfid from source must appear in contract payloads and verification snapshots.",
            verification: "npm run verify:id-sync"
          },
          {
            title: "Token source authority",
            control: "Token names originate from tokens/figma-variables.json and remain canonical across generation outputs.",
            verification: "npm run verify:tokens-sync"
          },
          {
            title: "Mode naming lock",
            control: "Mode names remain mobile/tablet/laptop/desktop with fixed width semantics.",
            verification: "npm run loop:verify-canvas"
          },
          {
            title: "Deterministic apply gate",
            control: "Source updates occur only after contract verification reports complete coverage.",
            verification: "npm run loop:verify-canvas && npm run loop:canvas-to-code"
          }
        ]
      },
      teamOutcomes: {
        title: "Team-Level Outcomes",
        body: "Operational outcomes are tracked as modeled signals until measured production baselines are established for each team.",
        outcomes: [
          {
            signal: "Design-to-merge loop time",
            range: "Modeled 28-46% faster",
            measurement: "Track elapsed time from payload generation to manifest update across comparable releases."
          },
          {
            signal: "Breakpoint drift rate",
            range: "Modeled 70-90% lower",
            measurement: "Count breakpoint-specific visual or semantic regressions after loop verification."
          },
          {
            signal: "Token consistency pass rate",
            range: "Modeled 95%+",
            measurement: "Capture pass/fail rates from npm run verify:tokens-sync in CI and local loops."
          },
          {
            signal: "Post-handoff rework cycles",
            range: "Modeled 25-40% lower",
            measurement: "Track code review rounds linked to design interpretation defects."
          },
          {
            signal: "Operational confidence",
            range: "Modeled +1.2 to +1.8 rubric points",
            measurement: "Use internal readiness rubric tied to proof artifacts and gate coverage."
          }
        ]
      },
      technicalFoundations: {
        title: "Technical Foundations",
        body: "StudioFlow relies on explicit contracts, verification scripts, and manifest evidence to keep intent alignment inspectable at scale.",
        foundations: [
          {
            title: "Workflow specification",
            detail: "Runtime entry paths, gate policy, and promotion logic for code-first and design-first operation.",
            referenceLabel: "Open STUDIOFLOW_WORKFLOW.md",
            referenceHref: "./docs/STUDIOFLOW_WORKFLOW.md"
          },
          {
            title: "Canvas exchange contract",
            detail: "Canonical payload schema and validation rules for deterministic canvas-to-code synchronization.",
            referenceLabel: "Open CANVAS_EXCHANGE_CONTRACT.md",
            referenceHref: "./docs/CANVAS_EXCHANGE_CONTRACT.md"
          },
          {
            title: "Demo roundtrip implementation",
            detail: "Executable example that maps intent preservation claims to commands and output artifacts.",
            referenceLabel: "Open DEMO_WEBSITE_ROUNDTRIP.md",
            referenceHref: "./docs/DEMO_WEBSITE_ROUNDTRIP.md"
          },
          {
            title: "Project operator manual",
            detail: "Installation flow, glossary, naming conventions, and roadmap for system operators.",
            referenceLabel: "Open Project README",
            referenceHref: "./README.md"
          }
        ]
      },
      footerGroups: [
        {
          title: "Workflow",
          links: [
            { label: "Operational Guide", href: "./docs/STUDIOFLOW_WORKFLOW.md" },
            { label: "Canvas Contract", href: "./docs/CANVAS_EXCHANGE_CONTRACT.md" }
          ]
        },
        {
          title: "Implementation",
          links: [
            { label: "Project README", href: "./README.md" },
            { label: "Manifest", href: "./studioflow.manifest.json" }
          ]
        },
        {
          title: "Integrations",
          links: [
            { label: "Demo Roundtrip", href: "./docs/DEMO_WEBSITE_ROUNDTRIP.md" },
            { label: "Claude Setup", href: "./docs/CLAUDE_CODE_SETUP.md" }
          ]
        }
      ],
      legalLine: "StudioFlow Workflow // Intent Preservation System // 2026"
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
