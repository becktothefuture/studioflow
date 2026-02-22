# StudioFlow: Verify

Run all quality gates. Stop on first failure.

```bash
npm run verify:tokens-sync
npm run verify:no-hardcoded
npm run verify:id-sync
npm run loop:verify-canvas
tsc --noEmit
npm run build
```

If a step fails, report:
- failing command,
- exact error,
- minimal safe fix.
