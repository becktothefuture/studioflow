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
      announcement: "LATEST // Website baseline remap live",
      kicker: "StudioFlow Workflow / Prism Channel",
      heading: "Design signal stays coherent from canvas idea to merged code.",
      body: "StudioFlow packages intent, identifiers, tokens, and verification into one rhythm your team can repeat under pressure.",
      commandLine: "$ npm run loop:run",
      commandHint: "Runs handoff, verification, sync, check, build, and manifest refresh.",
      primaryActionLabel: "Start Workflow Sequence",
      secondaryActionLabel: "Open Proof Layer",
      topLinks: [
        { label: "Proof", href: "#proof" },
        { label: "Workflow", href: "#how-to-use" },
        { label: "Docs", href: "#docs" },
        { label: "Repo", href: "./README.md" }
      ],
      whyTitle: "Why teams keep this loop in production",
      whyBody: "Drift creeps in through tiny decisions. StudioFlow captures those moments and turns them into visible checks your team can trust.",
      supportTitle: "Support Matrix",
      supportMatrix: [
        { label: "Code to Canvas", status: "LIVE" },
        { label: "Canvas Verification", status: "LIVE" },
        { label: "Token Sync", status: "LIVE" },
        { label: "Proof Strip", status: "LIVE" }
      ],
      offerTitle: "What the workflow offers",
      offerCards: [
        { icon: "◉", title: "Semantic handoff payloads", body: "Each run exports intent-rich payloads agents can act on immediately." },
        { icon: "◎", title: "Stable sfid anchoring", body: "Meaningful nodes keep their identity across screen variants and sync rounds." },
        { icon: "◍", title: "Token-first rendering", body: "Design tokens drive every surface and keep style decisions auditable." },
        { icon: "◌", title: "Manifest lineage", body: "Loop history stays local in git with timestamped proof entries." },
        { icon: "◐", title: "Multi-agent alignment", body: "Claude, Codex, and editor agents share the same operational contract." },
        { icon: "◑", title: "Breakpoint fidelity", body: "Mobile through desktop mode values travel with the same canonical schema." },
        { icon: "◒", title: "Fast confidence gates", body: "Verification scripts fail loudly before fragile changes reach release branches." },
        { icon: "◓", title: "Creative control", body: "Brand expression evolves while structural integrity stays measurable." }
      ],
      howToTitle: "How to use StudioFlow",
      howToSteps: [
        {
          title: "Generate the handoff",
          detail: "Produce canonical canvas instructions and the response template.",
          command: "npm run loop:code-to-canvas"
        },
        {
          title: "Verify the returned payload",
          detail: "Check frame coverage, token usage, and sfid parity before apply.",
          command: "npm run loop:verify-canvas"
        },
        {
          title: "Apply and lock proof",
          detail: "Sync approved values into tokens, then refresh manifest and proof strip.",
          command: "npm run loop:canvas-to-code && npm run manifest:update"
        }
      ],
      agentTitle: "Agent support",
      agentSupport: [
        { name: "Claude Code", instruction: "Add workflow prompts in CLAUDE.md" },
        { name: "OpenAI Codex", instruction: "Keep AGENTS.md aligned with command gates" },
        { name: "Cursor", instruction: "Pin token and sfid guardrails in project rules" },
        { name: "GitHub Copilot", instruction: "Mirror enforcement notes in copilot instructions" }
      ],
      useCaseTitle: "Use cases",
      useCases: [
        {
          id: "coding-agents",
          label: "Coding Agents",
          title: "Agent-generated UI stays on-policy",
          body: "Teams run fast patch cycles while the workflow keeps style, IDs, and payload shape coherent."
        },
        {
          id: "design-systems",
          label: "Design Systems",
          title: "Token programs stay stable through growth",
          body: "Design system stewards push updates once and get traceable propagation across breakpoints and docs."
        },
        {
          id: "product-teams",
          label: "Product Teams",
          title: "Roadmap pressure keeps velocity and craft",
          body: "Feature squads move with confidence because each release carries proof artifacts with the code changes."
        }
      ],
      tierTitle: "Adoption tiers",
      tierCards: [
        {
          name: "Local Loop",
          subtitle: "Solo or pair workflows",
          bullets: ["Local command loop", "Proof strip in README", "Token and sfid validation"],
          ctaLabel: "Run Local",
          ctaHref: "#how-to-use"
        },
        {
          name: "Team Flow",
          subtitle: "Cross-functional product squads",
          bullets: ["Shared handoff contracts", "Canvas verification gate", "Manifest lineage for reviews"],
          ctaLabel: "View Workflow",
          ctaHref: "./docs/STUDIOFLOW_WORKFLOW.md",
          featured: true
        },
        {
          name: "Enterprise Workflow",
          subtitle: "Platform and governance programs",
          bullets: ["Policy-driven release checks", "Audit-ready snapshots", "Multi-repo rollout patterns"],
          ctaLabel: "Read Contract",
          ctaHref: "./docs/CANVAS_EXCHANGE_CONTRACT.md"
        }
      ],
      faqTitle: "FAQ",
      faqItems: [
        {
          question: "What keeps IDs stable during redesign passes?",
          answer: "Every meaningful node keeps an sfid anchor and verification scripts compare code against the latest snapshot set."
        },
        {
          question: "How does the loop handle fast brand experiments?",
          answer: "The workflow permits visual exploration through tokens while validation gates keep contract structure and sync artifacts intact."
        },
        {
          question: "Where does proof live for reviewers?",
          answer: "Proof lives in manifest metadata, snapshots, and the README strip, all committed beside source updates."
        },
        {
          question: "Can this fit CI pipelines?",
          answer: "Yes. The same loop commands run in automation and expose pass or fail outcomes before merge."
        }
      ],
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
      legalLine: "StudioFlow Workflow // Alexander Beck Studio // 2026"
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
