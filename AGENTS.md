# Project guidance

- Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.
- Build interactive components with the official shadcn/ui Base UI components. Do not reintroduce Radix primitives.
- Keep subscription URLs and tokens out of source, fixtures, screenshots, logs, and published artifacts. Use synthetic example domains in tests.
- Keep template generation in SubWeave-Rules; consume its versioned public catalog here.
- Preserve omitted conversion parameters separately from explicit true/false values.
- Verify changed behavior with focused tests, typecheck, a production build, and browser checks for UI changes.
- Publish only `dist/client`. Keep runtime features in the browser; do not add server routes or a Worker entry to the static deployment.
