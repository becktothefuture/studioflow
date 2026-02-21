import { useMemo, useState } from "react";
import logoMark from "../../../assets/studioflow-logo.png";
import { ShaderBackground } from "../Background/ShaderBackground";
import type { HeroContract } from "./Hero.contract";

export function HeroLayout(props: HeroContract) {
  const { content } = props;
  const firstUseCase = content.useCases.find(() => true);
  const [copied, setCopied] = useState(false);
  const [activeUseCaseId, setActiveUseCaseId] = useState(firstUseCase?.id ?? "");
  const [activeFaq, setActiveFaq] = useState(0);

  const activeUseCase = useMemo(
    () => content.useCases.find((item) => item.id === activeUseCaseId) ?? firstUseCase,
    [activeUseCaseId, content.useCases, firstUseCase]
  );

  const onCopyCommand = async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (window.navigator.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(content.commandLine.replace(/^\$\s*/, ""));
      } else {
        const textarea = window.document.createElement("textarea");
        textarea.value = content.commandLine.replace(/^\$\s*/, "");
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
            <p className="announcement">{content.announcement}</p>
            <p data-sfid="sfid:hero-kicker" className="hero-kicker">
              {content.kicker}
            </p>
            <h1 id="hero-title" data-sfid="sfid:hero-title" className="hero-title">
              {content.heading}
            </h1>
            <p data-sfid="sfid:hero-body" className="hero-body">
              {content.body}
            </p>
            <div className="command-box" role="group" aria-label="Primary command">
              <code className="command-line">{content.commandLine}</code>
              <button type="button" className="command-copy" onClick={() => void onCopyCommand()}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="command-hint">{content.commandHint}</p>
            <div data-sfid="sfid:hero-actions" className="hero-actions">
              <button type="button" data-sfid="sfid:hero-primary-cta" className="button button-primary" onClick={props.onPrimaryAction}>
                {content.primaryActionLabel}
              </button>
              <button
                type="button"
                data-sfid="sfid:hero-secondary-cta"
                className="button button-secondary"
                onClick={props.onSecondaryAction}
              >
                {content.secondaryActionLabel}
              </button>
            </div>
          </div>
        </section>

        <section className="context-strip" aria-label="Context strip">
          <article className="context-card">
            <h2 className="section-title-small">{content.whyTitle}</h2>
            <p className="section-copy">{content.whyBody}</p>
          </article>
          <article className="context-card">
            <h2 className="section-title-small">{content.supportTitle}</h2>
            <ul className="support-grid">
              {content.supportMatrix.map((item) => (
                <li key={item.label} className="support-item">
                  <span>{item.label}</span>
                  <strong>{item.status}</strong>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="offers" aria-labelledby="offers-title">
          <h2 id="offers-title" className="section-title">{content.offerTitle}</h2>
          <div className="offers-grid">
            {content.offerCards.map((card) => (
              <article key={card.title} className="offer-card">
                <span className="offer-icon" aria-hidden="true">
                  {card.icon}
                </span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="execution-grid" id="how-to-use" aria-label="How to use and support">
          <article className="panel-card">
            <h2 className="section-title-small">{content.howToTitle}</h2>
            <ol className="step-list">
              {content.howToSteps.map((step) => (
                <li key={step.title} className="step-item">
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                  {step.command ? <code>{step.command}</code> : null}
                </li>
              ))}
            </ol>
          </article>
          <article className="panel-card">
            <h2 className="section-title-small">{content.agentTitle}</h2>
            <ul className="agent-grid">
              {content.agentSupport.map((agent) => (
                <li key={agent.name} className="agent-item">
                  <strong>{agent.name}</strong>
                  <span>{agent.instruction}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="use-cases" aria-labelledby="use-cases-title">
          <h2 id="use-cases-title" className="section-title">{content.useCaseTitle}</h2>
          <div className="use-cases-layout">
            <div className="use-case-buttons" role="tablist" aria-label="Use cases">
              {content.useCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeUseCaseId === item.id}
                  className={`use-case-button${activeUseCaseId === item.id ? " is-active" : ""}`}
                  onClick={() => setActiveUseCaseId(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {activeUseCase ? (
              <article className="use-case-panel">
                <h3>{activeUseCase.title}</h3>
                <p>{activeUseCase.body}</p>
              </article>
            ) : null}
          </div>
        </section>

        <section className="tiers" aria-labelledby="tiers-title">
          <h2 id="tiers-title" className="section-title">{content.tierTitle}</h2>
          <div className="tier-grid">
            {content.tierCards.map((tier) => (
              <article key={tier.name} className={`tier-card${tier.featured ? " is-featured" : ""}`}>
                <h3>{tier.name}</h3>
                <p className="tier-subtitle">{tier.subtitle}</p>
                <ul>
                  {tier.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                <a href={tier.ctaHref} className="button button-secondary tier-cta">
                  {tier.ctaLabel}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="faq" id="proof" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-title">{content.faqTitle}</h2>
          <div className="faq-list">
            {content.faqItems.map((item, index) => {
              const isOpen = activeFaq === index;
              return (
                <article key={item.question} className="faq-item">
                  <button
                    type="button"
                    className="faq-question"
                    aria-expanded={isOpen}
                    onClick={() => setActiveFaq(isOpen ? -1 : index)}
                  >
                    <span>{item.question}</span>
                    <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen ? <p className="faq-answer">{item.answer}</p> : null}
                </article>
              );
            })}
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
