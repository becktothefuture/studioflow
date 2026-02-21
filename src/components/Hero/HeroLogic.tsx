import React from 'react';
import { HeroLayout } from './HeroLayout';
import { HeroProps } from './Hero.contract';

export const Hero: React.FC<Omit<HeroProps, 'onCtaClick'>> = ({ title, subtitle }) => {
  const handleCtaClick = () => {
    console.log('CTA Clicked!');
  };

  return <HeroLayout title={title} subtitle={subtitle} onCtaClick={handleCtaClick} />;
};
