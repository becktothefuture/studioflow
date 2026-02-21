import React from 'react';
import { HeroProps } from './Hero.contract';

export const HeroLayout: React.FC<HeroProps> = ({ title, subtitle, onCtaClick }) => {
  return (
    <div style={{ padding: '2rem', border: '1px solid var(--color-neutral-warm-grey)' }}>
      <h1 data-sfid="hero:title">{title}</h1>
      <p data-sfid="hero:subtitle">{subtitle}</p>
      <button data-sfid="hero:cta-button" onClick={onCtaClick} style={{ backgroundColor: 'var(--color-brand-primary-coral)', color: 'var(--color-neutral-white)', border: 'none', padding: '10px 20px', cursor: 'pointer' }}>
        Click Me
      </button>
    </div>
  );
};
