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
      announcement: "OPEN THE LOOP // from spark to shipped signal",
      kicker: "StudioFlow Workflow / Code -> Canvas -> Code",
      heading: "Turn rough intent into living interfaces.",
      body: "Run one command, capture proof, then move through a code-canvas-code rhythm that keeps intent and implementation aligned.",
      commandLine: "$ npm run setup:project",
      commandHint: "Then run npm run demo:website:capture to generate your first proof report.",
      primaryActionLabel: "Start the Flow",
      secondaryActionLabel: "Jump to Proof + FAQ",
      topLinks: [
        { label: "First Flow", href: "#how-to-use" },
        { label: "Workflow", href: "#how-to-use" },
        { label: "Proof", href: "#proof" },
        { label: "Docs", href: "#docs" },
        { label: "Repo", href: "./README.md" }
      ],
      whyTitle: "Why teams keep this loop close",
      whyBody: "StudioFlow keeps design intent, sfids, tokens, and verification inside one operating rhythm. Teams move quickly and keep control.",
      supportTitle: "First-run readiness",
      supportMatrix: [
        { label: "Guided local proof path", status: "READY" },
        { label: "4-breakpoint contract", status: "READY" },
        { label: "Token and sfid gates", status: "READY" },
        { label: "Proof artifacts per run", status: "READY" }
      ],
      offerTitle: "What this workflow gives you",
      offerCards: [
        { icon: "◉", title: "Rapid first proof", body: "Track A runs locally and writes before and after proof files in the opening pass." },
        { icon: "◎", title: "Modeled 28-46% faster loop time", body: "One payload contract and scripted gates reduce coordination overhead during iteration." },
        { icon: "◍", title: "Modeled 70-90% lower breakpoint drift", body: "Validation requires mobile, tablet, laptop, and desktop modes plus matching screens." },
        { icon: "◌", title: "Modeled 95%+ token consistency", body: "Token sync checks keep style values aligned with canonical token sources." },
        { icon: "◐", title: "Modeled 25-40% lower handoff rework", body: "Stable sfid anchors preserve identity through canvas and code sync passes." },
        { icon: "◑", title: "Proof by default", body: "Each serious loop can produce report artifacts reviewers can open immediately." },
        { icon: "◒", title: "Tooling alignment", body: "Claude, Codex, and editor agents operate with the same contract vocabulary." },
        { icon: "◓", title: "Future-ready operating model", body: "The same workflow supports code-first and design-first entry with shared gates." }
      ],
      howToTitle: "From first spark to full roundtrip",
      howToSteps: [
        {
          title: "Open the loop",
          detail: "Install dependencies, prepare Claude config, run checks, and produce initial proof output.",
          command: "npm run setup:project && npm run demo:website:capture"
        },
        {
          title: "Connect your workspace",
          detail: "Start Claude, run /mcp, and complete Figma auth for the active session.",
          command: "claude"
        },
        {
          title: "Create the canvas handoff",
          detail: "Create the payload that mirrors your current website structure for Figma.",
          command: "npm run loop:code-to-canvas"
        },
        {
          title: "Close the roundtrip with proof",
          detail: "Generate handoff, push in Figma, export canvas-to-code payload, verify, apply, and refresh manifest.",
          command: "npm run loop:verify-canvas && npm run loop:canvas-to-code && npm run check && npm run build && npm run manifest:update"
        }
      ],
      agentTitle: "Operator support",
      agentSupport: [
        { name: "Claude Code", instruction: "Use .claude/commands playbooks for repeatable loop actions." },
        { name: "OpenAI Codex", instruction: "Keep AGENTS.md aligned with token and sfid gate policy." },
        { name: "Cursor", instruction: "Pin contract and token guidance in project rules." },
        { name: "GitHub Copilot", instruction: "Mirror workflow command gates in instruction files." }
      ],
      useCaseTitle: "Use cases",
      useCases: [
        {
          id: "coding-agents",
          label: "Coding Agents",
          title: "Generated UI stays policy-aligned",
          body: "Teams ship quickly while the workflow keeps style values, IDs, and payload shape coherent."
        },
        {
          id: "design-systems",
          label: "Design Systems",
          title: "Token systems stay stable through growth",
          body: "Design system stewards push updates once and track propagation across breakpoints and docs."
        },
        {
          id: "product-teams",
          label: "Product Teams",
          title: "Roadmap pressure keeps quality visible",
          body: "Feature squads move with confidence since each release carries proof artifacts beside code changes."
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
      faqTitle: "Proof + FAQ",
      faqItems: [
        {
          question: "How quickly does this workflow click?",
          answer: "Run npm run setup:project and npm run demo:website:capture. The first local pass writes proof/latest/index.html and a share card you can review immediately."
        },
        {
          question: "What confirms roundtrip integrity?",
          answer: "loop:verify-canvas checks token frames, four variable modes, four screens, token coverage, and sfid parity before apply."
        },
        {
          question: "What if Claude says no MCP servers are configured?",
          answer: "Run claude mcp add --transport http figma https://mcp.figma.com/mcp --scope user, then run claude mcp list again."
        },
        {
          question: "Can this workflow run in CI pipelines?",
          answer: "Yes. Use the same loop commands in automation and gate merges on check, build, and verify outcomes."
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
