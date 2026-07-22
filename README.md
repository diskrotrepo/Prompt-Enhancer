# Prompt Enhancer

Prompt Enhancer is a modular list-mixing tool. Chunking boxes turn raw text into delimiter-preserving chunks. Mixing boxes interleave those lists to produce an output string by concatenating chunks only — no delimiter injection. Variable nodes can reference any existing mix or string and forward its chunks unchanged. **+ Add Save** buttons append saved prompt enhancer JSON boxes into the clicked root or mix level without replacing the current window. Everything runs in the browser with no build step.

Open `src/index.html` to use the tool. The UI presents a Windows 3.1 style desktop with a procedural large-shape 90s confetti wallpaper: scroll over bare desktop space to travel through an effectively endless field whose shapes, palette, and texture evolve gradually, while app windows keep their own conventional scrolling. Apps open from the start menu into draggable silver windows with beveled controls, and the focused window carries the navy title bar. Add lists inside mixing boxes, set per-box limits, and press **Generate Mixes**. You can save your configuration to a file or reload it later. On narrow screens, button rows automatically wrap so text labels stay within their section.
Prompt menu presets load from `src/presets/index.js` via `window.PromptEnhancerPresetCatalog`. Add or update catalog entries there with inline preset `state` objects.
Window apps can register from dedicated monolithic files under `src/apps/` through `window.PromptEnhancerAppModules`, which keeps app-specific behavior out of the core shell file.

The code is intentionally kept in a single `script.js` file so an LLM can search through the entire logic easily. Comments and a small table of contents guide navigation. Following the **50% Rule**, even small clarifications or tests compound into a much more reliable project.

## Length handling model

Mix and string generation follow this pipeline:

1. Build the source chunk list from the configured children (canonical or randomized ordering rules).
2. Apply the selected length mode to that source list.

Length modes then decide how the length limit is enforced:

- **Split Final Chunk** trims the first chunk that would overflow.
- **Delete Final Chunk** stops before the first chunk that would overflow.
- **Fit to Smallest / Fit to Largest / Exactly Once** run a one-pass traversal of source lists.
- **Dropout** first builds a full all-once source list, skipping any child list after it is exhausted, then repeatedly removes random chunks and recounts until total length is `<= limit`.

For Dropout in canonical order, surviving chunks keep canonical relative order; randomness controls which chunks remain.
When a mode wraps a shorter list (for example Fit to Largest or non-single-pass repeat), the wrapped source is regenerated from its base state so randomized children reroll instead of replaying one frozen cycle. Dropout does not wrap exhausted children; longer siblings keep contributing their remaining one-pass chunks.

## Shared terminology

Use these terms consistently in code, docs, and tests:

- **String**: a leaf box (`chunk-box`) containing raw text input.
- **Chunk**: one delimiter-preserving text segment produced from a string or rechunked mix output.
- **Chunk list**: ordered array of chunks (the core unit passed between helpers).
- **Mix**: a node (`mix-box`) that combines child chunk lists into one output chunk list.
- **Source list**: the full pre-length-mode chunk list produced by a string or mix.
- **Output list**: the chunk list after length-mode rules are applied.
- **Canonical order**: deterministic order with no shuffling; relative order is preserved.
- **Length limit**: max character count constraint applied by the selected length mode.

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
- **Blank strings emit one empty chunk and lock delimiter controls** — `root_string_empty_chunk`
- **Typing into a blank string restores normal delimiter controls** — `root_string_empty_chunk_released`
- **Root-level strings support dropout mode** — `root_string_dropout`
- **Root-level short strings still build a full one-pass source list before dropout removal** — `root_string_dropout_short_one_pass`

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
- **Default first-chunk behavior is fixed size (canonical runs stay deterministic unless randomized explicitly; shared fixture)** — `nested_rechunk`
- **Custom chunk sizes persist** — `custom_chunk_size`
- **First chunk Between 1 - X** — `first_chunk_between`
- **First chunk random start** — `first_chunk_random_start`

#### Preserve + rechunking

- **Preserve chunks off enables controls** — `preserve_off_enables_controls`
- **Nested rechunk behavior (shared fixture)** — `nested_rechunk`
- **Rechunk pass not randomized** — `rechunk_no_random`
- **Visible mix output reflects the final rechunked list** — `mix_rechunk_visible_output`
- **Full randomize shuffles after final rechunking** — `mix_full_randomize_after_rechunk`

#### Length modes

- **Split Final Chunk** — `exact_length_trim`
- **Delete Final Chunk** — `delete_final_chunk`
- **Fit to Smallest (mix)** — `fit_smallest_mix`
- **Fit to Largest (mix)** — `fit_largest_mix`
- **Dropout on mixes (full all-once seed, then random chunk removal to limit)** — `dropout_mix`
- **Dropout on short mixes still builds one full pass before removal** — `dropout_mix_short_lists`
- **Dropout skips exhausted exact-once children instead of wrapping them** — `dropout_mix_skips_exhausted_exact_once_child`
- **Dropout on strings (full one-pass seed, then random chunk removal)** — `root_string_dropout`
- **Dropout can keep late canonical chunks because seeding starts from a full one-pass list** — `dropout_mix_reaches_tail_chunks`
- **Fit to Smallest keeps blank-string children (empty chunk slots)** — `fit_smallest_empty_child`
- **Fit to Smallest halts when a variable resolves empty** — `fit_smallest_empty_variable`
- **Exactly Once (chunk single-pass behavior)** — `exact_once_length`
- **Fit to Largest rerolls wrapped randomized children instead of replaying one static cycle** — `fit_largest_rerolls_wrapped_child`

#### Randomization scope

- **Mix randomize interleave order mode** — `random_mix_order`
- **Mix full randomize order mode** — `mix_full_randomize_order`
- **Chunk full randomize order mode** — `random_chunk_order`

#### Empty chunks

- **Empty chunk list can skip interleave slots in mixes** — `empty_chunk_mix_skip`

#### Variables

- **Variable references forward chunks** — `variable_reference`
- **Variable options exclude ancestor mixes** — `variable_parent_filtered`
- **Removing a variable does not remove its parent mix** — `remove_variable_keeps_parent_mix`
- **Exactly Once variables** — `exact_once_variable_mix`
- **Variable cycle guard** — `variable_cycle_guard`
- **Randomized string variable stays consistent** — `variable_random_chunk_consistent`
- **Multiple variables share one randomized string output** — `variable_random_chunk_multi_reference`
- **Randomized mix variable matches duplicated submix behavior** — `variable_random_mix_consistent`
- **Add Variable UI can select and forward a source mix** — `add_variable_ui_selects_source_mix`
- **Variables fall back to mirrored target ids while option lists rebuild** — `tests/stateManager.test.js`

#### Output + copy behavior

- **Copy buttons use generated output** — `copy_output_behavior`
- **Copy buttons preserve intentionally empty generated string output** — `copy_empty_chunk_output`

#### Color presets

- **Custom color state** — `color_custom_state`
- **Preset shared across boxes** — `color_preset_shared`
- **Missing preset fallback** — `color_preset_missing`

#### Procedural box mats

- **Nested boxes receive stable, palette-ready pattern mats distinct from their parents, with every motif kept inside its visually sampled density envelope** — `procedural_box_pattern_hierarchy`, `tests/dynamicDom.test.js`
- **Custom colors retint the mat while preserving its generated motif** — `tests/dynamicDom.test.js`

#### File + persistence

- **Collapsed mix/string UI state roundtrips through save/load** — `collapsed_state_persisted`
- **Preserve chunks remembers hidden first-chunk behavior during export** — `tests/stateManager.test.js`
- **Blank string export keeps the delimiter that resumes after typing** — `tests/stateManager.test.js`
- **Prompt menu includes Load Preset submenu** — `prompt_menu_load_preset_item`
- **Prompt menu save flow** — `prompt_menu_save_flow`
- **Duplicate loaded ids are re-keyed during hydration so cache keys stay isolated across boxes** — `duplicate_loaded_ids_are_rekeyed`
- **+ Add Save appends a saved prompt file into the clicked mix/root level without replacing existing boxes** — `add_save_appends_saved_mix_into_clicked_mix`
- **+ Add Save remaps imported variable targets when ids collide with existing boxes** — `tests/stateManager.test.js`
- **Startup ignores legacy local storage and initializes the fresh default prompt** — `local_storage_ignored_on_startup`
- **Every newly opened Prompt Enhancer window starts fresh, independent of browser storage** — `fresh_prompt_window_ignores_local_storage`
- **File Open remains the explicit path for replacing a fresh prompt with saved state** — `tests/windowBehavior.test.js`

#### Window apps

- **Prompt workspace meets its file strip without an inherited flex-gap artifact** — `tests/windowBehavior.test.js`
- **On mobile, the /// file launcher reads as physical chrome with a raised face, divided dropdown cue, and depressed open state** — `tests/windowBehavior.test.js`
- **Pressing any interior window surface activates and raises that window without swallowing its control action** — `multi_prompt_windows_open`
- **The /// yolk start mark compensates the slash baseline for balanced vertical padding** — `tests/windowBehavior.test.js`
- **Completion API appears in the menu and opens its own window** — `openrouter_app_window`
- **Completion API encrypted settings actions live in the top file menu (password + file save/open)** — `openrouter_app_window`
- **Completion API reuses the shell Help mode and standard boxed copy control** — `openrouter_app_window`
- **Completion copy feedback preserves the token and cost status readout** — `tests/openrouterApp.test.js`
- **Completion API model picker is dropdown-only and filtered to completion-oriented models (chat/instruct models excluded)** — `openrouter_app_window`
- **Completion API status breaks out billed input/output/total tokens and request cost when usage data is available** — `openrouter_app_window`
- **Completion API treats empty completion text as a successful blank response when stop sequences halt immediately** — `tests/openrouterApp.test.js`
- **Completion API copies intentionally blank output without treating it as failure** — `tests/openrouterApp.test.js`
- **Multiple Prompt Enhancer windows can be opened in one session and each gets its own taskbar button** — `multi_prompt_windows_open`

#### Procedural desktop wallpaper

- **Wheel or trackpad movement over bare desktop space advances the procedural wallpaper without creating a fourth native scroll region** — `procedural_wallpaper_background_scroll`, `tests/wallpaper.test.js`
- **A quick one-finger mobile drag releases into a long-tail, time-based coast that remains active around 1.5 seconds, rolls roughly two viewports after a fast flick, decays to rest, and stops immediately for a new touch or reduced-motion preference** — `mobile_wallpaper_touch_momentum`, `tests/wallpaper.test.js`
- **Wheel movement inside an app window remains isolated from the wallpaper and available to the window's own scroll body** — `window_wheel_does_not_scroll_wallpaper`, `tests/wallpaper.test.js`
- **Seeded world bands are deterministic in both directions, preserve the original nine silhouettes, add new shape families, and recycle a bounded visible pool** — `tests/wallpaper.test.js`
- **Backdrop palettes and texture parameters change continuously with virtual distance while generated fills retain useful contrast** — `tests/wallpaper.test.js`

- **Color presets**  
  Custom color presets are global across boxes, persist in saved state, and missing preset ids fall back to Auto on load.

- **Pattern-mat hierarchy**
  Mix, String, and Variable boxes derive one of eight low-density 90s-inspired
  CSS patterns from their stable box id. Parent and adjacent motifs are kept
  different when possible; opaque silver islands protect every functional
  control, and a box's existing Auto/Custom color tints only its visual identity.

- **File save/load semantics**
  Save reuses the current file name (prompting if unset). Save As always prompts, appends `.json` when missing, and updates the window title (title omits the `.json` suffix).

- **Add Save append semantics**
  The root and mix action rows include **+ Add Save**. It opens a JSON file picker, reads the saved `mixes` array, and appends those top-level boxes exactly where the button was clicked. Imported ids are re-keyed against the receiving prompt tree when needed, and variables inside the imported save are remapped to the imported copies.

- **Preset submenu semantics**
  Prompt menu **Load Preset** reads `src/presets/index.js` catalog entries and applies each preset's inline `state` directly. The submenu shows `No presets in catalog` when the catalog is empty.

- **Explicit restoration only**
  Prompt Enhancer does not autosave to or restore from localStorage. Startup and every newly opened Prompt window use the fresh default state; restore a setup deliberately with **File → Open**, **Load Preset**, or **+ Add Save**.
