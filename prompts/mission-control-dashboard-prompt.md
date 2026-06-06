# Prompt — "Mission Control" Dashboard (reusable)

Paste everything below into an AI coding assistant. Replace the **[BRACKETS]** with your own info. It will generate a single self-contained HTML dashboard in the same style as the HK23 Vice OS mission control.

---

## THE PROMPT

You are a senior frontend engineer. Build me a **single self-contained HTML file** called `dashboard.html` — a personal "Mission Control" dashboard for my projects. No build step, no frameworks, no external JS libraries. Vanilla HTML + CSS + JS only. It must open by double-clicking the file.

### Aesthetic
- **Dark, cinematic, premium.** Near-black background (`#0c0c12` / `#06060a`).
- Fonts from Google Fonts: **Space Grotesk** (900/700 for headings, big numbers) and **Space Mono** (400/700 for labels, mono detail). Load via `<link>`.
- **Neon accent palette**, one color per project: green `#AAFF00`, cyan `#00F0FF`, yellow `#FFD200`, purple `#B84DFF`, orange `#FF6600`, red `#FF3A1F`, indigo `#6366F1`, emerald `#10B981`, off-white `#F0EDE8`.
- A subtle animated **starfield** on a full-screen `<canvas>` behind everything (slow-twinkling dots).
- Generous spacing, thin `1px` borders (`#16161e`), letter-spaced uppercase mono labels.

### Layout (top to bottom)
1. **Header** — left: `[YOUR BRAND] — MISSION CONTROL` (bold) + a subline `YYYY-MM-DD · [N] VERTICALS · ACTIVE BUILD`. Right: one big stat showing the core/flagship project's completion `%` (computed from the data, not hardcoded) with a small pulsing dot.
2. **SNAPSHOT** — a row of stat cards: count of **LIVE**, **BUILDING**, **SPEC/CONCEPT**, **TOTAL PROJECTS**, and **BLOCKED**. Each card = big colored number + tiny label.
3. **TIMELINE** — a horizontal row of milestones. Each has a colored dot, a badge (`DONE` / `TODAY` / `NEXT` / `AHEAD`), a short two-line label, and a date. The `TODAY` one is highlighted.
4. **VERTICALS** — a responsive grid of project cards (click a card to expand its task list). Each card: colored top border + dot, project name, one-line subtitle, a status badge (`LIVE`/`BUILDING`/`SPEC`), a progress bar with `%`, and an expandable list of **done** (✓) and **todo** items.
5. **CHECKLIST** — two tabs: **TO DO** and **DONE**. Items are grouped by section header, each with a small colored tag (`urgent`/`build`/`next`). TO DO and DONE are separate arrays.

### Behavior
- The header `%` is **computed in JS** from the projects array (use the flagship project's `pct`, or the average) — never hardcode it, so it never goes stale.
- Project cards expand/collapse on click to reveal their done/todo lists.
- Checklist tabs switch between the TO DO and DONE arrays.
- Everything renders from the JS data objects below — to update the dashboard, I only edit the data, never the markup.

### MY DATA (fill this in)

```js
const META = {
  brand: "[YOUR BRAND NAME]",
  date: "[YYYY-MM-DD]",
};

// One object per project/vertical. color = its neon accent.
// status: 'live' | 'build' | 'spec'. pct: 0-100.
const projects = [
  {
    id: "[flagship-id]", name: "[FLAGSHIP PROJECT]", sub: "[one-line description]",
    color: "#AAFF00", pct: 90, status: "live",
    tasks: {
      done: ["[shipped thing 1]", "[shipped thing 2]"],
      todo: ["[next thing 1]", "[next thing 2]"]
    }
  },
  {
    id: "[project-2]", name: "[PROJECT 2]", sub: "[description]",
    color: "#00F0FF", pct: 40, status: "build",
    tasks: { done: ["[...]"], todo: ["[...]"] }
  }
  // ...add the rest of your projects
];

// Horizontal timeline. status: 'done' | 'today' | 'next' | 'ahead'.
const milestones = [
  { label: "[Milestone 1]", date: "[MON DD]", status: "done" },
  { label: "[What you shipped today]", date: "[MON DD]", status: "today" },
  { label: "[Next milestone]", date: "[MON DD]", status: "next" },
  { label: "[Future]", date: "PHASE 2", status: "ahead" }
];

// Flat checklist. tag: 'urgent' | 'build' | 'next'. section groups them.
const todoItems = [
  { text: "[task]", meta: "[short detail]", tag: "urgent", section: "[SECTION]" }
];
const doneItems = [
  { text: "[completed task]", meta: "[detail]", section: "[SECTION]" }
];
```

### Output
Return the complete `dashboard.html` in one code block, ready to save and open. Make it look polished and intentional — this is my command center, it should feel like a premium product, not a prototype.

---

## Tips for the new user
- **Pick ONE flagship project** — its `%` becomes the big header number, so it should reflect real momentum.
- **Update only the data objects**, never the HTML — that's the whole point.
- Add a milestone with `status: "today"` each working session so the timeline always shows current progress.
- Keep each project's color unique so the dashboard reads at a glance.
