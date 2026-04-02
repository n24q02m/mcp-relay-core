## 2024-05-24 - Accessible Dynamically Generated Inputs
**Learning:** For frontend UX and accessibility in the 'pages/' directory, dynamically generated inputs via JavaScript must always use proper `<label>` tags explicitly linked to the input's unique ID using the `htmlFor` property, rather than using generic text tags (like `<p>`).
**Action:** Always ensure that when generating form elements dynamically (e.g. `document.createElement`), `label` elements are appropriately tied to `input` elements using `htmlFor` and a matching `id`, and ensure labels have `display: block` if converting from paragraph tags to maintain original layout.
## 2026-04-02 - UI Polish via Linting Automation
**Learning:** Automated linting (e.g. Biome) can catch subtle code-quality issues like unused variables in catch blocks and improper arrow function returns in `forEach` callbacks that might otherwise be overlooked during manual cleanup. These non-functional improvements result in a more robust and maintainable codebase.
**Action:** Always run `bun x @biomejs/biome check --write` across all modified frontend and backend directories before submission to ensure consistent styling and code health.
