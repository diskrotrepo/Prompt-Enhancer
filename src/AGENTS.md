# AGENT Instructions

The core shell code is consolidated into `script.js`, while optional app-specific modules can live in their own monolithic files under `src/apps/<app-name>/` and register via `window.PromptEnhancerAppModules`. Organize `script.js` into clear sections:

- pure, side-effect free utilities at the top
- UI helpers below them
- any remaining logic in a final section

Favor side-effect free helpers grouped together and keep UI logic separate. Document each function so its inputs and outputs are clear.

This monolithic style is intentional to simplify searching for issues when working alongside an LLM. Comments should be thorough so each file acts as an outline of program flow.
Add a short table of contents at the top of `script.js` and each app module file, and keep them updated. Follow the **50% Rule**—small, clear comments and improvements accumulate into dependable code.

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
order each cycle, and Full randomize shuffles the final chunk list.

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
Smallest**, **Fit to Largest**, and **Dropout**. Fit to Smallest stops as soon
as any child list runs out; Fit to Largest repeats shorter child lists until the
longest child list is exhausted. Dropout builds a full one-pass source list
first, then removes random chunks (with recounts) until total output is at or
below the limit.
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
specific descriptions so the help overlay stays informative.

### String Output

String boxes now include an Output panel that mirrors the generated chunk list
(including randomization and length mode). The header copy button copies this
output, not the raw input text.

### Box Colors

Mix and String boxes now support per-box color customization. The header color
button opens a panel with Auto/Custom modes, preset selection, and a Save Preset
flow. Custom presets are serialized with mix state so they can be reused across
boxes and sessions.

### File Naming

Prompt menu **Save** reuses the current file name (prompting if none exists),
while **Save As** always prompts for a new name. Loaded or saved names replace
the prompt window title so users can see the active file at a glance. The title
omits a trailing `.json` extension for cleaner window labels, and Save As
auto-appends `.json` to download names when users omit it. Save As prompts for
the bare title (no `.json` shown in the input).

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
