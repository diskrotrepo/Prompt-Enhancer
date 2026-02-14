# Prompt Enhancer

Prompt Enhancer is a modular list-mixing tool. Chunking boxes turn raw text into delimiter-preserving chunks. Mixing boxes interleave those lists to produce an output string by concatenating chunks only — no delimiter injection. Variable nodes can reference any existing mix or string and forward its chunks unchanged. Everything runs in the browser with no build step.

Open `src/index.html` to use the tool. Add lists inside mixing boxes, set per-box limits, and press **Generate Mixes**. You can save your configuration to a file or reload it later. On narrow screens, button rows automatically wrap so text labels stay within their section.

The code is intentionally kept in a single `script.js` file so an LLM can search through the entire logic easily. Comments and a small table of contents guide navigation. Following the **50% Rule**, even small clarifications or tests compound into a much more reliable project.

## Testing (run first)

Install dependencies and run the full suite:

```bash
npm test
```

Tests live in the `tests/` directory and cover all functionality. There are two layers:

1. **Targeted Jest tests** (unit + integration) that exercise helpers and edge cases.
2. **Sanity regression** that drives the *real UI flow* to verify end-to-end behavior.

The sanity test loads `src/index.html`, evaluates `src/script.js` inside JSDOM, applies
the mix state from each case, clicks **Generate Mixes**, and compares outputs to a
curated golden file. This avoids calling mixing helpers directly and matches the real
browser flow.

## Sanity regression workflow

Canonical sanity fixtures live in `tests/sanity/`:

- `prompt_sanity_input.json` — the “raw” input cases (each case contains a `state` tree
  describing mixes and either a fixed `random` value or a `randomSequence` to stub Math.random).
- `prompt_sanity_expected.json` — the curated expected outputs for each case id.

When you add or change behavior:

1. Update the **Heuristic rule index** below to document the intent in plain English.
2. Add a new case (or extend an existing one) in `tests/sanity/prompt_sanity_input.json`.
3. Hand-author the matching output in `tests/sanity/prompt_sanity_expected.json`.
4. Run `npm test` so the sanity test exercises the *actual program flow* via JSDOM.
5. Commit the README + both sanity files together.

If you want a generated diff artifact to inspect:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, 'tests');
const html = fs.readFileSync(path.join(__dirname, 'src', 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'src', 'script.js'), 'utf8');
const input = JSON.parse(fs.readFileSync(path.join(root, 'sanity', 'prompt_sanity_input.json'), 'utf8'));

function runCase(testCase) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;
  window.localStorage.clear();
  window.alert = () => {};
  window.eval(script);
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  const rand = typeof testCase.random === 'number' ? testCase.random : 0;
  window.Math.random = () => rand;
  if (testCase.state) window.PromptMixer.applyMixState(testCase.state);
  window.document.getElementById('generate').click();
  return {
    id: testCase.id,
    output: window.document.querySelector('.mix-box .mix-output-text').textContent || ''
  };
}

const generated = { cases: input.cases.map(runCase) };
const outPath = path.join(root, 'sanity', 'prompt_sanity_expected.generated.json');
fs.writeFileSync(outPath, JSON.stringify(generated, null, 2));
console.log(`Wrote ${outPath}`);
NODE
```

## Heuristic rule index

### Sanity cases (fixtures)

Case ids refer to the entries in `tests/sanity/prompt_sanity_input.json` and
`tests/sanity/prompt_sanity_expected.json`. Update this list whenever behavior changes.

#### Core defaults + ordering

- **Basic mix ordering with preserved delimiters** — `basic_mix_divider`
- **Default UI state** — `default_ui_state`

#### Root-level strings

- **Root-level strings generate without a parent mix** — `root_string_global`
- **Root-level strings support dropout mode** — `root_string_dropout`

#### Delimiter modes

- **Whitespace delimiter** — `delimiter_whitespace`
- **Whitespace delimiter keeps consecutive spaces separate** — `delimiter_whitespace_runs`
- **Comma delimiter** — `delimiter_comma`
- **Semicolon delimiter** — `delimiter_semicolon`
- **Pipe delimiter** — `delimiter_pipe`
- **Newline delimiter** — `delimiter_newline`
- **Tab delimiter** — `delimiter_tab`
- **Sentence punctuation delimiter** — `delimiter_sentence`
- **Custom delimiter match-all (full string)** — `delimiter_custom_match_all`
- **Custom delimiter match-any (character set)** — `delimiter_custom_match_any`
- **Custom delimiter with `\n`** — `delimiter_custom_newline`
- **Custom delimiter with `\t`** — `delimiter_custom_tab`
- **Custom delimiter fallback (empty input)** — `delimiter_custom_empty`

#### Chunk sizing + first-chunk behavior

- **Fixed chunk size grouping** — `random_first_off`
- **Custom chunk sizes persist** — `custom_chunk_size`
- **First chunk Between 1 - X** — `first_chunk_between`
- **First chunk random start** — `first_chunk_random_start`

#### Preserve + rechunking

- **Preserve chunks off enables controls** — `preserve_off_enables_controls`
- **Nested rechunk behavior** — `nested_rechunk`
- **Rechunk pass not randomized** — `rechunk_no_random`

#### Length modes

- **Split Final Chunk** — `exact_length_trim`
- **Delete Final Chunk** — `delete_final_chunk`
- **Fit to Smallest (mix)** — `fit_smallest_mix`
- **Fit to Largest (mix)** — `fit_largest_mix`
- **Dropout (full fit-largest, then random chunk removal to limit)** — `dropout_mix`
- **Dropout on strings (full one-pass chunk output, then random chunk removal)** — `root_string_dropout`
- **Fit to Smallest halts when any child is empty** — `fit_smallest_empty_child`
- **Fit to Smallest halts when a variable resolves empty** — `fit_smallest_empty_variable`
- **Exactly Once (chunk single-pass behavior)** — `exact_once_length`

#### Randomization scope

- **Mix list order shuffle** — `random_mix_order`
- **Chunk list shuffle** — `random_chunk_order`

#### Variables

- **Variable references forward chunks** — `variable_reference`
- **Variable options exclude ancestor mixes** — `variable_parent_filtered`
- **Removing a variable does not remove its parent mix** — `remove_variable_keeps_parent_mix`
- **Exactly Once variables** — `exact_once_variable_mix`
- **Variable cycle guard** — `variable_cycle_guard`
- **Randomized string variable stays consistent** — `variable_random_chunk_consistent`
- **Multiple variables share one randomized string output** — `variable_random_chunk_multi_reference`
- **Randomized mix variable stays consistent** — `variable_random_mix_consistent`

#### Output + copy behavior

- **Copy buttons use generated output** — `copy_output_behavior`

#### Color presets

- **Custom color state** — `color_custom_state`
- **Preset shared across boxes** — `color_preset_shared`
- **Missing preset fallback** — `color_preset_missing`

#### File + persistence

- **Prompt menu save flow** — `prompt_menu_save_flow`
- **Local storage load** — `local_storage_load`

- **Color presets**  
  Custom color presets are global across boxes, persist in saved state, and missing preset ids fall back to Auto on load.

- **File save/load semantics**  
  Save reuses the current file name (prompting if unset). Save As always prompts, appends `.json` when missing, and updates the window title (title omits the `.json` suffix).

- **Local persistence**  
  The app stores state in localStorage on unload and reloads it on startup when available.
