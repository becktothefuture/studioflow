# StudioFlow: Verify Loop Integrity

Run all gates and stop on first failure.

```bash
npm run test:contracts
npm run loop:verify-canvas
npm run verify:tokens-sync
npm run verify:no-hardcoded
npm run verify:id-sync
npm run build
```

If a step fails, report:
- failing command,
- exact error,
- minimal safe fix.
