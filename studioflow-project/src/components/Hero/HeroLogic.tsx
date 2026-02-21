import { useCallback } from "react";
import { HeroLayout } from "./HeroLayout";

export function HeroLogic() {
  const onPrimaryAction = useCallback(() => {
    console.info("StudioFlow: primary action clicked");
  }, []);

  const onSecondaryAction = useCallback(() => {
    console.info("StudioFlow: secondary action clicked");
  }, []);

  return (
    <HeroLayout
      heading="Build design-accurate UIs with confidence"
      body="StudioFlow enforces tokens, stable IDs, and contract-driven components so design and code never drift."
      primaryActionLabel="Start Workflow"
      secondaryActionLabel="Read Docs"
      onPrimaryAction={onPrimaryAction}
      onSecondaryAction={onSecondaryAction}
    />
  );
}
