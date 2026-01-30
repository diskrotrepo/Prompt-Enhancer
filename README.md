# Prompt Enhancer

Prompt Enhancer is a modular list-mixing tool. Chunking boxes turn raw text into delimiter-preserving chunks. Mixing boxes interleave those lists to produce an output string by concatenating chunks only — no delimiter injection. Everything runs in the browser with no build step.

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
  describing mixes and a `random` value to stub Math.random).
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

Case ids refer to the entries in `tests/sanity/prompt_sanity_input.json` and
`tests/sanity/prompt_sanity_expected.json`. Update this list whenever behavior changes.

1. **Basic mix ordering with preserved delimiters** — `basic_mix_divider`  
   Chunk lists are interleaved without delimiter injection, yielding `a b d` for
   three lists in canonical order.

2. **Randomized list order per cycle** — `random_mix_order`  
   Mixing order changes per cycle when randomization is enabled (RNG stubbed).

3. **Exact length trimming** — `exact_length_trim`  
   Exact length trims the final chunk rather than injecting new delimiters.

4. **Nested rechunk behavior** — `nested_rechunk`  
   A child mix with preserve off rechunks its output before the parent mix consumes it.
