export type MotionMode = "full" | "reduced";

export interface TopLink {
  label: string;
  href: string;
}

export interface AlignmentMatrixItem {
  label: string;
  guarantee: string;
  verification: string;
  evidence: string;
}

export interface IntentExample {
  title: string;
  state: string;
  result: string;
  verification: string;
}

export interface GenerationStep {
  title: string;
  detail: string;
  command?: string;
  verification: string;
}

export interface IdentityRule {
  title: string;
  control: string;
  verification: string;
}

export interface OutcomeItem {
  signal: string;
  range: string;
  measurement: string;
}

export interface FoundationItem {
  title: string;
  detail: string;
  referenceLabel: string;
  referenceHref: string;
}

export interface HeroSection {
  announcement: string;
  kicker: string;
  heading: string;
  valueStatement: string;
  supportingParagraph: string;
  commandLine: string;
  commandHint: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
}

export interface StructuralAlignmentSection {
  title: string;
  body: string;
  matrix: AlignmentMatrixItem[];
}

export interface IntentPreservationSection {
  title: string;
  body: string;
  examples: IntentExample[];
}

export interface DeterministicGenerationSection {
  title: string;
  body: string;
  steps: GenerationStep[];
}

export interface IdentityParitySection {
  title: string;
  body: string;
  rules: IdentityRule[];
}

export interface TeamOutcomesSection {
  title: string;
  body: string;
  outcomes: OutcomeItem[];
}

export interface TechnicalFoundationsSection {
  title: string;
  body: string;
  foundations: FoundationItem[];
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
  tagline: string;
  topLinks: TopLink[];
  hero: HeroSection;
  structuralAlignment: StructuralAlignmentSection;
  intentPreservation: IntentPreservationSection;
  deterministicGeneration: DeterministicGenerationSection;
  identityParity: IdentityParitySection;
  teamOutcomes: TeamOutcomesSection;
  technicalFoundations: TechnicalFoundationsSection;
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
