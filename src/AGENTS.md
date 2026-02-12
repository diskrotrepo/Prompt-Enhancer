# AGENT Instructions

The client code is consolidated into a single file `script.js`. Organize that file into clear sections:

- pure, side-effect free utilities at the top
- UI helpers below them
- any remaining logic in a final section

Favor side-effect free helpers grouped together and keep UI logic separate. Document each function so its inputs and outputs are clear.

This monolithic style is intentional to simplify searching for issues when working alongside an LLM. Comments should be thorough so the file acts as an outline of program flow.
Add a short table of contents at the top of `script.js` and keep it updated. Follow the **50% Rule**—small, clear comments and improvements accumulate into dependable code.

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

### Depth Control Note

Depth is always randomized at generation time. There are no depth selectors in
the UI; depth arrays are computed during `collectInputs` based on ordered stacks
and base word counts. When adding new modifier stacks, ensure the generation-time
helpers (`computeDepthCountsFrom`, `buildDepthValues`) receive the new stacks so
negatives remain aligned with positives.

### Order Resolution Note

Order modes now resolve by shuffling list copies at generation time (see
`resolveListOrder` and `resolveStackOrders`). Index-based order arrays are still
supported for explicit mappings in `buildVersions`, but avoid reapplying the
same base order twice—pass ordered lists or an order array, not both.

### Delimiter Controls

Each list now owns its own delimiter dropdown (e.g., `base-delimiter-select`,
`pos-delimiter-select`, `neg-delimiter-select`, `divider-delimiter-select`) plus
optional custom inputs and a chunk size input (`*-delimiter-size`). Use
`getDelimiterConfigFor`, `parseBaseInput`, `parseListInput`, and
`collectStackInputs` so new logic respects per-list and per-stack delimiters and
sizes. Chunking preserves the delimiter at the end of each chunk, and prompt
recombination is a straight concatenation pass (no new delimiters inserted).

Custom delimiter modes now include Match All (full-string delimiter; legacy
`custom` maps here) and Match Any (split on any character in the custom field).

Preset items are stored as strings only. Legacy array formats are no longer
normalized during load or import; update data sources to provide string items.

`computeDepthCounts` now sums words from earlier stacks for both positive and
negative sections. Random depth calculations therefore consider all preceding
modifiers when multiple stacks are active.

### Length Exactness

Mix length modes include **Split Final Chunk**, **Delete Final Chunk**, **Fit to
Smallest**, and **Fit to Largest**. Fit to Smallest stops as soon as any child
list runs out; Fit to Largest repeats shorter child lists until the longest
child list is exhausted. Both fit modes disable the length limit input for mixes
because they run a single constrained pass. Chunk boxes still use **Exactly
Once** for single-pass chunk output.

### First Chunk Behavior

Use the **First Chunk Behavior** select to control how rechunking offsets are
created. **Size X** keeps fixed-size grouping, **Between 1 - X** randomizes the
first chunk size, and **Size X, random start location** rotates the prompt to
start at a random offset before grouping.
When a mix is set to **Preserve chunks**, the first-chunk select is locked to
**Size X** and disabled because no rechunking occurs in that mode.

### Lyrics Insertions

Lyrics processing includes an optional *Insertions* list. Terms from this list
are injected at word intervals and can stack multiple items inside brackets.
Intervals may be randomized so the chosen frequency acts as a mean with
positions selected uniformly across the lyrics. When adding new controls to
this subsystem, ensure related selectors are included in presets and state
persistence.

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

## Testing

Run the full suite with `npm test` whenever you modify code. Expand coverage whenever a bug is fixed or a new feature is added.

Sanity regression lives in `tests/sanity/` and runs the real UI flow via JSDOM.
When behavior changes, update both sanity JSON fixtures and the README Heuristic
rule index so test intent stays explicit for future LLM passes.
Treat heuristics as living specs: every new rule or behavior update needs a matching sanity fixture plus an entry in the README index.
