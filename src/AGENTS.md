# AGENT Instructions

The core shell code is consolidated into `script.js`, while optional app-specific modules can live in their own monolithic files under `src/apps/<app-name>/` and register via `window.PromptEnhancerAppModules`. Organize `script.js` into clear sections:

- pure, side-effect free utilities at the top
- UI helpers below them
- any remaining logic in a final section

Favor side-effect free helpers grouped together and keep UI logic separate. Document each function so its inputs and outputs are clear.

This monolithic style is intentional to simplify searching for issues when working alongside an LLM. Comments should be thorough so each file acts as an outline of program flow.
Add a short table of contents at the top of `script.js` and each app module file, and keep them updated. Follow the **50% Rule**—small, clear comments and improvements accumulate into dependable code.

### Completion and Terminal application contracts

`apps/openrouter-completions/app.js` now owns the multi-provider Completion API window despite its legacy folder name. Treat its body shape as a hard invariant: `prompt` is required, `messages` is forbidden, and `suffix` is provider/model-gated to DeepSeek FIM, Mistral FIM, or `gpt-3.5-turbo-instruct`. Only OpenRouter, DeepSeek, DeepInfra, Fireworks, Together, Mistral, OpenAI Legacy, and Hyperbolic's sunset base-completion route belong in this surface while their documented hosted protocols retain prompt/FIM `/completions` routes. DeepInfra uses `/v1/openai/completions`, limits this UI to its guide-level `max_tokens`/`temperature`/`top_p`/four-stop contract, reads `choices[].text`, and filters the authenticated `/v1/models` catalog to exact `metadata.tags` value `text-generation`; models still require their provider-documented raw prompt template. Hyperbolic is a deliberately narrow exception: expose only the documented `meta-llama/Meta-Llama-3.1-405B` base model, send only its conservative documented sampling fields, and never infer a model-catalog endpoint or replace it with a chat/instruct model. Provider option records are the single capability allowlist for absolute completion endpoints, request fields, stop/temperature/token limits, response shapes, catalog parsing/pagination, and pricing units. Catalog normalization must intersect DeepSeek's authenticated list with exact FIM model `deepseek-v4-pro`, honor DeepInfra's nested `metadata` tags/context/output/pricing fields, preserve all Fireworks `models` pages through `nextPageToken` plus camelCase serverless flags, keep Together's top-level language/code records and per-million pricing, require Mistral `capabilities.completion_fim`, retain OpenAI's exact three legacy completion IDs, and honor OpenRouter per-model `supported_parameters`/mandatory reasoning. Keep Mistral FIM temperature at or below 1.5 and DeepInfra/Fireworks/OpenAI/OpenRouter stop arrays at four entries or fewer. Successful zero-match catalogs stay empty instead of reviving a fallback. Provider switches must retain isolated key, endpoint, and model values. A non-chat endpoint does not by itself prove that a router preserves raw model input, so keep provider/model caveats visible. Completion and Terminal both delegate password-file cryptography to `apps/shared/encrypted-settings.js`; keep its versioned PBKDF2/AES-GCM envelope product-neutral, validate each app's product kind/version before mutation, and do not force a catalog call after a complete restored provider/model/key.

`apps/terminal/app.js` owns Chat Completions, OpenAI Responses, and native Anthropic Messages transport loops, `window.YolkToolRegistry`, built-in desktop/Prompt Enhancer adapters, `window.YolkTerminalKnowledge`, transcript rendering, model matching, encrypted settings application, and ASCII emotes. `script.js` exposes the data-only `window.YolkDesktop` manifest plus open/focus/close bridge; app tools must reuse that bridge instead of simulating menu clicks. Keep cross-origin iframe applications open/focus-only until they install an explicit adapter, cap tool loops, and serialize/truncate tool output. Provider keys stay in the cloned Terminal window's memory unless the user explicitly exports the password-encrypted File-menu artifact.

Terminal connection setup is part of the conversation, not a form beside it. Keep one terminal surface, one persistent single-line face, one transparent inline textarea, and one stage-swapped masked password input. Enter submits; there is no Send button or boxed composer. Required-key first runs follow provider → key → live model discovery → model; custom-compatible first runs follow provider → endpoint → model. The live query must use the just-entered provider key, list only models with tool support that can be established from provider metadata or conservative curated IDs, and prioritize economical choices (currently DeepSeek V4 Flash and GPT-5.6 Luna) over flagship models. Treat 401/403 as a rejected credential and return to the masked key stage; for network, CORS, malformed, or undocumented-catalog failures, keep the key and present the curated fallback. Provider choices accept numbers or forgiving names; the full active catalog remains searchable even when only eight choices are printed. Model resolution accepts numbers, exact ids/names/aliases, a unique typo confirmation, or a ranked shortlist with an explicit use-as-typed entry for models newer than the catalog. `/models` refreshes discovery and `/model [search]` re-enters the resolver. A task entered before setup remains queued and resumes after model selection. The key stage uses a conservative completeness guard: reject short values, whitespace, and menu-like numbers without echoing or storing them. `/providers` must switch `setupStage` back to `provider`, out-of-range provider numbers must stay in that stage, and a complete local configuration is **ready** rather than proven connected. Never offer consumer-session-token reuse. Add infrequent actions as slash commands (for example `/copy`, `/model`, or `/disconnect`) instead of permanent buttons. The only permanent Terminal app control is the standard gray File launcher for encrypted settings; do not restore the redundant Help button or app-brand strip. Visible copy must ask only necessary questions and report human-readable outcomes: do not print security rationale, prompt intent, registry/document counts, transport mechanics, provider notes, raw function names, or serialized tool results. Keep those contracts in code and documentation, and place detailed connection state behind `/status`.

The face is also Terminal's restrained speaking indicator. Preserve the readable seven-character ASCII state, but render visible brackets, eyes, and mouth as separate baseline-independent paths in the immutable `0 0 84 20` SVG viewBox. Both eye paths share the upper feature line and every mouth path stays on its lower anchor, so punctuation depth, cap height, fallback fonts, and bearings cannot reorder the face. Speech may replace only the mouth path; CSS animation remains paint-only (glow, opacity, or color) and must never transform the viewBox. Sample assistant copy into at most eighteen broad vowel poses, favor one held pose per word with only occasional second poses and phrase rests, while a low-volume filtered oscillator pair supplies a nonverbal murmur. Prime Web Audio only from Enter, treat failures as ornamental no-ops, never call speech synthesis or encode/read the answer as speech, and preserve `/sound on|off` plus reduced-motion behavior. A later answer or explicit `/face` command cancels the prior face/audio sequence so effects cannot accumulate.

These two modes must remain separate. Completion is for perspective-controlled continuation; Terminal is for role-structured conversation and function calls. When adding a provider, document which contract it supports and add a body-shape regression before exposing it in the UI.

## Applying the 50% Rule to LLM Collaboration

The 50% Rule in this context means diversifying token combinations to reinforce semantic meaning. When making changes, use multiple "attack angles" to document them:

- **Token Diversity**: Express changes via line-by-line comments, structural overviews, TOC updates, natural language explanations, and examples.
- **Reinforcement**: Each method adds redundancy; if one is unclear, others clarify the intent.
- **Permutation**: Reorder or rephrase documentation to activate different model pathways.

Directives for LLMs:
- For every change, update comments in code files using at least three methods (e.g., function purpose, line-by-line, section summary).
- Ensure AGENTS.md files reflect new structures.
- Use diverse phrasing to communicate changes to future LLM instances, increasing success probability.

Indentation is two spaces with no trailing whitespace.

### Button Grouping

Text-based toggles that appear alongside icon buttons should sit in a
separate `.text-button-group` container. This keeps icons clustered for
the right edge on mobile while text buttons center on their own line.

### Order Resolution Note

Mix and string boxes use an **Order** dropdown instead of a randomize toggle.
Mix modes are **Canonical order**, **Randomize interleave**, and **Full
randomize**. String modes are **Canonical order** and **Full randomize**.
Canonical keeps deterministic order, Randomize interleave shuffles source-list
order each cycle, and Full randomize shuffles the final chunk list. In
**Proportional Dropout**, canonical order merges chunks by relative source
progress, while Randomize interleave jitters each chunk only within its local
progress interval so source order remains intact.

### Delimiter Controls

Each box owns its own delimiter dropdown (`.delimiter-select`) plus optional
custom input (`.delimiter-custom`) and chunk size input (`.delimiter-size`).
Use `getDelimiterConfig`, `parseInput`, `buildChunkList`, and `mixChunkLists`
so new logic respects per-box delimiter modes and sizes. Chunking preserves the
delimiter at the end of each chunk, and recombination is a straight
concatenation pass (no new delimiters inserted).

Custom delimiter modes now include Match All (full-string delimiter; legacy
`custom` maps here) and Match Any (split on any character in the custom field).

Blank strings enter an **Empty chunk** lock mode: delimiter controls display
`empty-chunk` and are disabled, and generation emits one empty chunk (`['']`).
Once text is entered, controls unlock and delimiter settings resume normally.

Preset items are stored as strings only. Legacy array formats are no longer
normalized during load or import; update data sources to provide string items.

### Shared terminology

Use these words consistently in code and docs:

- **String**: a `chunk-box` with raw text input.
- **Chunk**: one delimiter-preserving text segment.
- **Chunk list**: ordered array of chunks.
- **Mix**: a `mix-box` that combines child chunk lists.
- **Source list**: chunk list before length mode is applied.
- **Output list**: chunk list after length mode is applied.

### Length Exactness

Mix length modes include **Split Final Chunk**, **Delete Final Chunk**, **Fit to
Smallest**, **Fit to Largest**, **Dropout**, and **Proportional Dropout**. Fit to Smallest stops as soon
as any child list runs out; Fit to Largest repeats shorter child lists until the
longest child list is exhausted. Dropout builds a full all-once source list
first, skipping child lists after they are exhausted, then removes random chunks
(with recounts) until total output is at or below the limit. Proportional
Dropout uses that same non-wrapping source data and removal pass, but schedules
chunks by relative progress so unequal child lists remain distributed from the
beginning through the end. It never rechunks or mutates a child's chunk list.
Only the fit modes disable the length limit input for mixes because they run a
single constrained pass. Chunk boxes support **Exactly Once** and **Dropout**:
Exactly Once ignores the limit and emits one pass, while Dropout builds one full
pass first and then removes random chunks to fit the limit.

### First Chunk Behavior

Use the **First Chunk Behavior** select to control how rechunking offsets are
created. **Size X** keeps fixed-size grouping, **Between 1 - X** randomizes the
first chunk size, and **Size X, random start location** rotates the prompt to
start at a random offset before grouping.
When a mix is set to **Preserve chunks**, the first-chunk select is locked to
**Size X** and disabled because no rechunking occurs in that mode.

### Help Mode

Help Mode uses `data-help` attributes or the `helpMap` in `script.js` to show
tooltips when users click elements. Lists and input boxes also need coverage;
avoid vague text. When new buttons or sections are added, provide concise,
specific descriptions so the help overlay stays informative. Every visible
button, input, select, textarea, menu item, output/status surface, title-bar
icon, and resize handle inside a Help-enabled window must have both a short
`data-help` label and an accurate `data-help-detail`. The overlay deliberately
intercepts title-bar icons too, explaining Minimize, Maximize/Restore, and Close
without performing the window action. When copy or randomization controls
re-evaluate data, say so explicitly rather than implying they copy stale text.

### String Output

String boxes now include an Output panel that mirrors the generated chunk list
(including randomization and length mode). The header copy button copies this
output, not the raw input text.

### Box Colors

Mix and String boxes now support per-box color customization. The header color
button opens a panel with Auto/Custom modes, preset selection, and a Save Preset
flow. Custom presets are serialized with mix state so they can be reused across
boxes and sessions. Custom colors render flat (solid header fill plus a
darkened border via `applyCustomBoxStyles`) and retint the box's procedural mat.
Keep controls on the shared opaque silver islands so a vivid user color cannot
reduce field, label, or output contrast.

### Procedural Box Mats

`applyBoxPattern` derives a stable visual identity from `data-box-id` without
consuming `Math.random`, which remains reserved for prompt behavior. The eight
families (`jazz`, `memphis`, `terrazzo`, `microchip`, `ribbons`, `checker`,
`orbit`, and `sprinkles`) are CSS gradients parameterized by JS custom
properties. Parent and previous-sibling families are avoided when possible.
`BOX_PATTERN_PROFILES` holds the contact-sheet-audited unit/span envelope for
each family; sample inside that profile rather than returning to one global
range, because chip patterns need tighter spacing than grids and rings.

Patterns belong only to the mat and nesting gutters. Direct functional groups
inside Mix, String, and Variable bodies must repaint `--w31-face`; preserve this
separation when adding controls. Saved ids make patterns deterministic across
load, while Custom/Presets change the derived palette rather than the motif.
Automatic headers use a moderate, pigment-like bridge palette: warm/cool Mix
colors and berry/water String colors. Maintain that cross-era balance and keep
the chartreuse-heavy and single-hue-purple extremes out of the automatic cycle.

### Windows 3.1 Theme

`style.css` implements a coherent retro theme: a sparse procedural field of
large 90s confetti over a gradually changing textured ground, silver
(`--w31-face`) window faces, beveled buttons, sunken white input fields, and
flat colored box headers (warm hues for mixes, pink/purple for strings, teal
for variables and Completion output). Key rules for future changes:

- All palette values and bevel recipes live as custom properties in `:root`
  (`--w31-*`, `--bevel-up`, `--bevel-down`, `--bevel-field`, `--etched`).
  Reuse them instead of hard-coding colors or shadows.
- `focusWindow` in `script.js` toggles an `is-focused` class on app windows;
  CSS uses it to paint the active title bar navy and inactive title bars
  muted silver. A capture-phase pointer listener activates the containing
  runtime window from any interior surface without cancelling the original
  control event. Hide/minimize paths must remove the class.
- Window geometry has one shared contract: `getWindowAreaMetrics`,
  `clampWindowGeometry`, `resizeWindowGeometry`, `getWindowSnapTarget`, and
  `getWindowSnapBounds` feed drag, eight-direction resize, viewport
  reconciliation, maximize/restore, the edge preview, and Snap Assist. During
  a title-bar drag the window may cross the desktop boundary and must preserve
  the original pointer offset; proximity only selects the preview, while
  release commits the snap. Browser resizing may still re-fit floating frames
  so a viewport change cannot strand them. Side drops tile halves, corner drops
  tile quarters, top-center maximizes, and bottom-center remains unsnapped.
- The mutable snap-layout ratios are the only authority for every tiled frame.
  Once a visible snapped neighbor exists, a later edge drop joins it directly
  without reopening Snap Assist. Visible neighbors expose keyboard-accessible
  shared separators with `ew-resize`/`ns-resize` cursors; dragging one must
  resize both sides from the same ratio so no gap or overlap can accumulate.
  Snap Assist remains the first-snap chooser. Mobile maximization is temporary
  and must restore or re-tile when a wider viewport returns.
- Floating app windows receive transparent resize hit zones on all four edges
  and all four corners. Keep these zones specific in Help Mode, hide them for
  snapped/maximized/mobile-managed windows, and avoid restoring the obsolete
  visible lower-right grip.
- The outer `.app-window` owns manual height. Its direct `.box-body` flex child
  must fill the remainder without a viewport-based cap; app-specific inner
  workspaces remain responsible for their own native scroll behavior. This
  prevents the silver dead band formerly exposed by tall window resizes.
- Scrolling policy is enforced by `tests/scrolling.test.js`: exactly three
  `overflow: auto;` declarations (the window body selectors plus
  `.prompt-body`). Any new inner scroll region must use `overflow-y: auto;`.
  The wallpaper simulates endless travel with a virtual world offset; it must
  not make the page or decorative layer into another native scroll region.
- Primary button actions (`.holo-generate`, `.openrouter-send`) share the beveled
  slab + pixel font + rainbow strip treatment; keep new CTAs consistent. Terminal
  is intentionally the exception: its inline prompt runs on Enter and carries a
  short rainbow cursor-mark instead of a button.
- Wallpaper accents start from the shared `--w31-confetti-*` palette, while
  procedural backdrop and shape colors stay scoped to `.desktop-confetti` so
  the yolk mark and CTA strips do not drift with the wallpaper. Keep shapes
  large, sparse, pointer-inert, and behind `#window-area`; prefer CSS geometry
  over image assets so the desktop stays crisp at every viewport.
- Prompt-box mats reuse the period vocabulary at a smaller, lower-contrast
  scale. Keep all eight families procedural, deterministic, family-profiled,
  and behind opaque silver work groups; their job is to expose nesting
  boundaries, not decorate fields themselves.
- Procedural wallpaper bands are deterministic by world index, recycle a
  bounded visible pool, and preserve spatial continuity when users reverse
  direction. Wheel input advances the wallpaper only from bare desktop space;
  app-window scrolling must remain native and isolated. Palette and texture
  samples should vary continuously rather than snapping at band boundaries.
  One-finger mobile panning samples velocity and continues with long-tail,
  time-based release momentum. A fast flick should remain active around 1.5
  seconds and coast roughly two mobile viewports before settling; new input,
  visibility loss, or reduced motion must cancel that glide, while multi-touch
  remains available for browser pinch zoom.
- Help mode uses the WinHelp-style yellow tooltip (`--w31-tooltip`).
- App file strips share `.prompt-menu`; Prompt and Completion retain a right-side Help control, while Terminal intentionally keeps only its File launcher. Workspace
  canvases meet that strip directly: keep the outer prompt `.box-body` at
  `gap: 0` so the generic box rhythm cannot create an artifact bar. Generated
  API output reuses the miniature box header and 26x24 `.copy-output` feedback
  contract from prompt boxes. `.prompt-menu-start` keeps the same flat text-menu
  treatment on desktop and mobile; do not add a mobile-only arrow, divided bay,
  bevel, size, or offset that makes File diverge from the neighboring Help item.
- Uniform control metrics: icon/header buttons are 26x24 (`min-height: 0`
  beats the global `.toggle-button` minimum), single-line selects and text /
  password / number inputs are exactly 32px tall with no default margins
  (rows and grids own spacing via `gap`), and primary CTA slabs are 44px.
  Emoji glyph buttons render monochrome ('Segoe UI Symbol' + grayscale).
  Taskbar app buttons share one identical footprint with no per-app accents.
  Responsive rules must not add blanket button margins because they displace
  taskbar tabs from the Start button. The start mark corrects slash ink
  separately from the `yolk` label so both retain balanced visible padding;
  mobile uses its own small rasterization correction while preserving the
  desktop mark.

### File Naming

Prompt menu **Save** reuses the current file name (prompting if none exists),
while **Save As** always prompts for a new name. Loaded or saved names replace
the prompt window title so users can see the active file at a glance. The title
omits a trailing `.json` extension for cleaner window labels, and Save As
auto-appends `.json` to download names when users omit it. Save As prompts for
the bare title (no `.json` shown in the input).

### Fresh Prompt Startup

Prompt Enhancer startup and every newly opened Prompt window must initialize
the canonical fresh state with `applyMixState(null, root)`. Do not restore or
autosave prompt state through `localStorage` or `beforeunload`; **File → Open**,
**Load Preset**, and **+ Add Save** are the only intentional restoration paths.

### Add Save Imports

Root and mix action rows include **+ Add Save** buttons. These buttons open a
JSON file picker and append the saved top-level `mixes` entries at the clicked
level instead of replacing the prompt window. Keep this path separate from the
file-menu **Open** action, seed hydration ids from the receiving prompt tree,
and remap imported variable targets when ids collide so repeated imports keep
their internal references local.

### Preset Menu

Prompt menu **Load Preset** populates from `src/presets/index.js` via
`window.PromptEnhancerPresetCatalog`. Catalog entries should include inline
`state` objects (plus optional `name/label/file`) so presets work in direct
file usage without network fetches.

### Box Collapse State

Mix and String collapse UI state is serialized (`collapsed`, plus compatibility
aliases `minimized`/`maximized`) and should roundtrip through
`applyMixState`/`exportMixState`. Keep this behavior intact when changing box
templates or collapse button wiring.

## Testing

Run the full suite with `npm test` whenever you modify code. Expand coverage whenever a bug is fixed or a new feature is added.

Sanity regression lives in `tests/sanity/` and runs the real UI flow via JSDOM.
When behavior changes, update both sanity JSON fixtures and the README Heuristic
rule index so test intent stays explicit for future LLM passes.
Treat heuristics as living specs: every new rule or behavior update needs a matching sanity fixture plus an entry in the README index.
