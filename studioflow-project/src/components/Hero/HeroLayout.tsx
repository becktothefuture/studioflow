import { useState } from "react";
import logoMark from "../../../assets/studioflow-logo.png";
import { ShaderBackground } from "../Background/ShaderBackground";
import type { HeroContract } from "./Hero.contract";

export function HeroLayout(props: HeroContract) {
  const { content } = props;
  const [copied, setCopied] = useState(false);

  const onCopyCommand = async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (window.navigator.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(content.hero.commandLine.replace(/^\$\s*/, ""));
      } else {
        const textarea = window.document.createElement("textarea");
        textarea.value = content.hero.commandLine.replace(/^\$\s*/, "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        window.document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        window.document.execCommand("copy");
        textarea.remove();
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main data-sfid="sfid:hero-root" className={`landing-root motion-${props.motionMode}`}>
      <ShaderBackground config={props.shaderConfig} />

      {props.showIntro ? (
        <div className="intro-overlay" role="status" aria-live="polite" aria-label="StudioFlow intro sequence">
          <div className="intro-panel">
            <p className="intro-kicker">StudioFlow // Prism channel online</p>
            <h2 className="intro-title">Signal stable. Scene loaded. Workflow warm.</h2>
            <button type="button" className="button button-ghost" onClick={props.onSkipIntro}>
              Continue
            </button>
          </div>
        </div>
      ) : null}

      <div className="content-shell">
        <header className="top-nav">
          <a className="brand-lockup" href="./README.md">
            <img src={logoMark} alt="StudioFlow logo" className="brand-logo" />
            <span className="brand-name">{content.brandName}</span>
          </a>
          <nav className="nav-links" aria-label="Primary">
            {content.topLinks.map((link) => (
              <a key={link.href} href={link.href} className="nav-link">
                {link.label}
              </a>
            ))}
          </nav>
        </header>

        <section className="hero-block" aria-labelledby="hero-title">
          <div data-sfid="sfid:hero-content" className="hero-panel">
            <p className="announcement">{content.hero.announcement}</p>
            <p data-sfid="sfid:hero-kicker" className="hero-kicker">
              {content.hero.kicker}
            </p>
            <h1 id="hero-title" data-sfid="sfid:hero-title" className="hero-title">
              {content.hero.heading}
            </h1>
            <p data-sfid="sfid:hero-body" className="hero-body">
              {content.hero.valueStatement}
            </p>
            <p className="section-copy">{content.hero.supportingParagraph}</p>
            <div className="command-box" role="group" aria-label="Primary command">
              <code className="command-line">{content.hero.commandLine}</code>
              <button type="button" className="command-copy" onClick={() => void onCopyCommand()}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="command-hint">{content.hero.commandHint}</p>
            <div data-sfid="sfid:hero-actions" className="hero-actions">
              <button type="button" data-sfid="sfid:hero-primary-cta" className="button button-primary" onClick={props.onPrimaryAction}>
                {content.hero.primaryActionLabel}
              </button>
              <button
                type="button"
                data-sfid="sfid:hero-secondary-cta"
                className="button button-secondary"
                onClick={props.onSecondaryAction}
              >
                {content.hero.secondaryActionLabel}
              </button>
            </div>
          </div>
        </section>

        <section className="offers" aria-labelledby="structural-alignment-title">
          <h2 id="structural-alignment-title" className="section-title">
            {content.structuralAlignment.title}
          </h2>
          <p className="section-copy">{content.structuralAlignment.body}</p>
          <ul className="support-grid">
            {content.structuralAlignment.matrix.map((item) => (
              <li key={item.label} className="support-item">
                <span>{item.label}</span>
                <strong>{item.guarantee}</strong>
                <code>{item.verification}</code>
                <span>{item.evidence}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="offers" aria-labelledby="intent-preservation-title">
          <h2 id="intent-preservation-title" className="section-title">
            {content.intentPreservation.title}
          </h2>
          <p className="section-copy">{content.intentPreservation.body}</p>
          <div className="offers-grid">
            {content.intentPreservation.examples.map((example) => (
              <article key={example.title} className="offer-card">
                <h3>{example.title}</h3>
                <p>{example.state}</p>
                <p>{example.result}</p>
                <code>{example.verification}</code>
              </article>
            ))}
          </div>
        </section>

        <section className="execution-grid" id="how-to-use" aria-label="Deterministic workflow and identity parity">
          <article className="panel-card">
            <h2 className="section-title-small">{content.deterministicGeneration.title}</h2>
            <p className="section-copy">{content.deterministicGeneration.body}</p>
            <ol className="step-list">
              {content.deterministicGeneration.steps.map((step) => (
                <li key={step.title} className="step-item">
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                  {step.command ? <code>{step.command}</code> : null}
                  <span>{step.verification}</span>
                </li>
              ))}
            </ol>
          </article>
          <article className="panel-card">
            <h2 className="section-title-small">{content.identityParity.title}</h2>
            <p className="section-copy">{content.identityParity.body}</p>
            <ul className="agent-grid">
              {content.identityParity.rules.map((rule) => (
                <li key={rule.title} className="agent-item">
                  <strong>{rule.title}</strong>
                  <span>{rule.control}</span>
                  <code>{rule.verification}</code>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="tiers" id="proof" aria-labelledby="team-outcomes-title">
          <h2 id="team-outcomes-title" className="section-title">{content.teamOutcomes.title}</h2>
          <p className="section-copy">{content.teamOutcomes.body}</p>
          <div className="tier-grid">
            {content.teamOutcomes.outcomes.map((outcome) => (
              <article key={outcome.signal} className="tier-card">
                <h3>{outcome.signal}</h3>
                <p className="tier-subtitle">{outcome.range}</p>
                <p className="section-copy">{outcome.measurement}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="offers" aria-labelledby="technical-foundations-title">
          <h2 id="technical-foundations-title" className="section-title">
            {content.technicalFoundations.title}
          </h2>
          <p className="section-copy">{content.technicalFoundations.body}</p>
          <div className="offers-grid">
            {content.technicalFoundations.foundations.map((foundation) => (
              <article key={foundation.title} className="offer-card">
                <h3>{foundation.title}</h3>
                <p>{foundation.detail}</p>
                <a href={foundation.referenceHref} className="nav-link">
                  {foundation.referenceLabel}
                </a>
              </article>
            ))}
          </div>
        </section>

        <footer className="footer" id="docs">
          <div className="footer-columns">
            {content.footerGroups.map((group) => (
              <div key={group.title} className="footer-group">
                <h3>{group.title}</h3>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="footer-legal">{content.legalLine}</p>
        </footer>
      </div>
    </main>
  );
}
