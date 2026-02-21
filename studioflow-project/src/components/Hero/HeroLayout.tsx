import type { HeroContract } from "./Hero.contract";

export function HeroLayout(props: HeroContract) {
  return (
    <section data-sfid="sfid:hero-root" className="hero-root" aria-labelledby="hero-title">
      <div data-sfid="sfid:hero-content" className="hero-content">
        <p data-sfid="sfid:hero-kicker" className="hero-kicker">
          StudioFlow Workflow
        </p>
        <h1 id="hero-title" data-sfid="sfid:hero-title" className="hero-title">
          {props.heading}
        </h1>
        <p data-sfid="sfid:hero-body" className="hero-body">
          {props.body}
        </p>
        <div data-sfid="sfid:hero-actions" className="hero-actions">
          <button data-sfid="sfid:hero-primary-cta" className="button button-primary" onClick={props.onPrimaryAction}>
            {props.primaryActionLabel}
          </button>
          <button data-sfid="sfid:hero-secondary-cta" className="button button-secondary" onClick={props.onSecondaryAction}>
            {props.secondaryActionLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
