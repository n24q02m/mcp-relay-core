## 2024-05-24 - Accessible Dynamically Generated Inputs
**Learning:** For frontend UX and accessibility in the 'pages/' directory, dynamically generated inputs via JavaScript must always use proper `<label>` tags explicitly linked to the input's unique ID using the `htmlFor` property, rather than using generic text tags (like `<p>`).
**Action:** Always ensure that when generating form elements dynamically (e.g. `document.createElement`), `label` elements are appropriately tied to `input` elements using `htmlFor` and a matching `id`, and ensure labels have `display: block` if converting from paragraph tags to maintain original layout.
## 2025-04-01 - Required Indicators and Screen Readers
**Learning:** When adding visual 'required' indicators (e.g., an asterisk `*`) to form labels in the frontend, they are often read out loud by screen readers alongside the input's default required state announcement.
**Action:** Always set `aria-hidden="true"` on the visual indicator element (like a `<span>` wrapping the asterisk) to prevent redundant and confusing screen reader announcements, since the corresponding input element already communicates its required state natively.
