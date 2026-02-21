export type MotionMode = "full" | "reduced";

export interface TopLink {
  label: string;
  href: string;
}

export interface SupportMatrixItem {
  label: string;
  status: string;
}

export interface OfferCard {
  icon: string;
  title: string;
  body: string;
}

export interface HowToStep {
  title: string;
  detail: string;
  command?: string;
}

export interface AgentSupportItem {
  name: string;
  instruction: string;
}

export interface UseCase {
  id: string;
  label: string;
  title: string;
  body: string;
}

export interface TierCard {
  name: string;
  subtitle: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterGroup {
  title: string;
  links: FooterLink[];
}

export interface ShaderBackgroundConfig {
  projectId: string;
  fallbackVideoWebm: string;
  fallbackVideoMp4: string;
  fallbackStill: string;
  motionMode: MotionMode;
}

export interface LandingContent {
  brandName: string;
  announcement: string;
  kicker: string;
  heading: string;
  body: string;
  commandLine: string;
  commandHint: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  topLinks: TopLink[];
  whyTitle: string;
  whyBody: string;
  supportTitle: string;
  supportMatrix: SupportMatrixItem[];
  offerTitle: string;
  offerCards: OfferCard[];
  howToTitle: string;
  howToSteps: HowToStep[];
  agentTitle: string;
  agentSupport: AgentSupportItem[];
  useCaseTitle: string;
  useCases: UseCase[];
  tierTitle: string;
  tierCards: TierCard[];
  faqTitle: string;
  faqItems: FaqItem[];
  footerGroups: FooterGroup[];
  legalLine: string;
}

export interface HeroContract {
  content: LandingContent;
  motionMode: MotionMode;
  showIntro: boolean;
  shaderConfig: ShaderBackgroundConfig;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  onSkipIntro: () => void;
}
