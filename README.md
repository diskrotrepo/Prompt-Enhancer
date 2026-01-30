# Prompt Enhancer

Prompt Enhancer is a small web tool for building AI prompts. It combines base prompts with positive and negative modifiers to produce two variations. Everything runs in the browser with no build step.

Open `src/index.html` to use the tool. Enter a list of base phrases, pick modifier presets and press **Generate**. You can save your data to a file or reload it later. On narrow screens, button rows automatically wrap so text labels stay within their section.

The code is intentionally kept in a single `script.js` file so an LLM can search through the entire logic easily. Comments and a small table of contents guide navigation. Following the **50% Rule**, even small clarifications or tests compound into a much more reliable project.

## Testing (run first)

Install dependencies and run the full suite:

```bash
npm test
```

Tests live in the `tests/` directory and cover all functionality. There are two layers:

1. **Targeted Jest tests** (unit + integration) that exercise helpers and edge cases.
2. **Sanity regression** that drives the *real UI flow* to verify end-to-end behavior.

The sanity test loads `src/index.html`, evaluates `src/default_list.js` + `src/script.js`
inside JSDOM, fills inputs, clicks **Generate**, and compares outputs to a curated
golden file. This avoids calling helper functions directly and matches the real
browser flow.

## Sanity regression workflow

Canonical sanity fixtures live in `tests/sanity/`:

- `prompt_sanity_input.json` — the “raw” input cases (each case maps input ids → values).
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
const defaults = fs.readFileSync(path.join(__dirname, 'src', 'default_list.js'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'src', 'script.js'), 'utf8');
const input = JSON.parse(fs.readFileSync(path.join(root, 'sanity', 'prompt_sanity_input.json'), 'utf8'));

function applyInputs(window, inputs) {
  const pending = [];
  Object.entries(inputs).forEach(([id, value]) => {
    const el = window.document.getElementById(id);
    if (!el) {
      pending.push([id, value]);
      return;
    }
    if (el.type === 'checkbox') {
      el.checked = !!value;
      el.dispatchEvent(new window.Event('change'));
      return;
    }
    el.value = value == null ? '' : String(value);
    el.dispatchEvent(new window.Event('input'));
    el.dispatchEvent(new window.Event('change'));
  });
  if (!pending.length) return;
  pending.forEach(([id, value]) => {
    const el = window.document.getElementById(id);
    if (!el) throw new Error(`Missing input: ${id}`);
    if (el.type === 'checkbox') {
      el.checked = !!value;
      el.dispatchEvent(new window.Event('change'));
      return;
    }
    el.value = value == null ? '' : String(value);
    el.dispatchEvent(new window.Event('input'));
    el.dispatchEvent(new window.Event('change'));
  });
}

function runCase(testCase) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;
  window.localStorage.clear();
  window.alert = () => {};
  window.eval(defaults);
  window.eval(script);
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  window.Math.random = () => 0;
  applyInputs(window, testCase.inputs);
  window.document.getElementById('generate').click();
  return {
    id: testCase.id,
    positive: window.document.getElementById('positive-output').textContent || '',
    negative: window.document.getElementById('negative-output').textContent || '',
    lyrics: window.document.getElementById('lyrics-output').textContent || ''
  };
}

const generated = { cases: input.cases.map(runCase) };
const outPath = path.join(root, 'sanity', 'prompt_sanity_expected.generated.json');
fs.writeFileSync(outPath, JSON.stringify(generated, null, 2));
console.log(`Wrote ${outPath}`);
NODE
```

## Heuristic rule index

Case ids refer to the entries in `tests/sanity/prompt_sanity_input.json` and
`tests/sanity/prompt_sanity_expected.json`. Update this list whenever behavior changes.

1. **Exact-length trimming with include-positive negatives** — `exact_include_pos`  
   Exact length stays aligned to the longer term sequence even when negatives
   include positives, and both outputs are trimmed to the same character count.

2. **Delimiter chunk sizing (comma, size 2)** — `comma_chunk_size_two`  
   Base inputs are chunked by delimiter with preserved delimiters and grouped
   by the selected chunk size; outputs concatenate directly without new punctuation.

3. **Sentence punctuation parsing** — `sentence_punctuation_mode`  
   Base items split on punctuation or newlines while retaining those delimiters,
   so sentence boundaries stay intact during concatenation.

4. **Custom delimiter escape handling** — `custom_delimiter_tab`  
   Custom delimiter inputs interpret `\\t` (and `\\n`) as literal tab/newline
   separators before chunking.

5. **Newline delimiter chunk sizing (size 2)** — `newline_chunk_size_two`  
   Newline-delimited base lists group every two lines per term, preserving
   line breaks inside each chunk.

6. **Empty custom delimiter fallback** — `custom_delimiter_empty_fallback`  
   An empty custom delimiter falls back to whitespace chunking to avoid empty
   regex splits.

7. **Modifier chunk sizing (comma, size 2)** — `modifier_chunk_size_two`  
   Modifier lists honor delimiter chunk sizing before insertion into base terms.

8. **Random base ordering** — `random_base_order`  
   Random base order shuffles the base list deterministically when RNG is stubbed.

9. **Random modifier ordering** — `random_modifier_order`  
   Modifier lists can shuffle independently of the base, changing which modifiers
   map to each term.

10. **Stacked modifiers** — `stacked_modifiers`  
    Multiple modifier stacks apply sequentially to each term for both positives
    and negatives.

11. **Divider insertion + shuffle** — `divider_shuffle`  
    Divider phrases insert between base repetitions and use shuffled ordering.

12. **Negative addendum mode** — `neg_addendum`  
    Negatives can be appended as an addendum after the positive output.

13. **Include-positive negatives** — `include_pos_for_neg`  
    Negatives can be applied on top of positive terms to preserve shared context.

14. **Lyrics cleaning + insertions** — `lyrics_clean_insert`  
    Lyrics processing removes bracketed/parenthetical content when toggled and
    inserts bracketed terms at fixed intervals.

15. **Lyrics randomized insertions** — `lyrics_random_insert`  
    Randomized insertion positions use the RNG stub for deterministic placement.
