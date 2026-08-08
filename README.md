# Prompt Enhancer

Prompt Enhancer is a modular list-mixing tool. Chunking boxes turn raw text into delimiter-preserving chunks. Mixing boxes interleave those lists to produce an output string by concatenating chunks only — no delimiter injection. Variable nodes can reference any existing mix or string and forward its chunks unchanged. **+ Add Save** buttons append saved prompt enhancer JSON boxes into the clicked root or mix level without replacing the current window. Everything runs in the browser with no build step.

Open `src/index.html` to use the tool. The UI presents a Windows 3.1 style desktop with a procedural large-shape 90s confetti wallpaper: scroll over bare desktop space to travel through an effectively endless field whose shapes, palette, and texture evolve gradually, while app windows keep their own conventional scrolling. Apps open from the start menu into draggable silver windows with beveled controls, and the focused window carries the navy title bar. Floating frames stay anchored to the pointer and may cross a desktop edge; release near either side for a half, any corner for a quarter, or the top to maximize. Snap Assist starts a layout, later drops join an existing layout directly, and shared double-arrow separators rebalance neighboring panes. Every floating border and corner resizes. Add lists inside mixing boxes, set per-box limits, and press **Generate Mixes**. You can save your configuration to a file or reload it later. On narrow screens, button rows automatically wrap so text labels stay within their section.
Prompt menu presets load from `src/presets/index.js` via `window.PromptEnhancerPresetCatalog`. Add or update catalog entries there with inline preset `state` objects.
Window apps can register from dedicated monolithic files under `src/apps/` through `window.PromptEnhancerAppModules`, which keeps app-specific behavior out of the core shell file.

The code is intentionally kept in a single `script.js` file so an LLM can search through the entire logic easily. Comments and a small table of contents guide navigation. Following the **50% Rule**, even small clarifications or tests compound into a much more reliable project.

## Completion API: prompt-only providers

The **Completion API** start-menu app is for continuation-oriented requests. Every provider adapter sends a top-level `prompt` and never sends a `messages` array. Documented FIM adapters may additionally send `suffix`, as may OpenAI's model-specific legacy suffix path. Before any credential or prompt leaves the browser, the app requires an absolute HTTP(S) URL ending in `/completions`; Chat Completions, Responses, Messages, relative, and non-HTTP endpoints are rejected.

Provider support was checked against official documentation on **2026-08-08**:

| Provider | Default route | Continuation contract | Important caveat |
| --- | --- | --- | --- |
| [OpenRouter](https://openrouter.ai/docs/faq) | `/api/v1/completions` | OpenAI-compatible legacy text completion with `prompt` | The route itself is non-chat, but OpenRouter can route any catalog model. A chat-trained model may still be adapted upstream, so use a base/FIM-oriented model when exact continuation perspective matters. OpenRouter also labels this route [legacy text completions](https://openrouter.ai/docs/guides/features/router-metadata). |
| [DeepSeek](https://api-docs.deepseek.com/guides/fim_completion/) | `/beta/completions` | Native FIM `prompt` plus optional `suffix` | Currently documented with `deepseek-v4-pro`; FIM output is capped at 4K tokens. |
| [DeepInfra](https://docs.deepinfra.com/apis/completions) | `/v1/openai/completions` | Legacy raw text generation with one `prompt`; returned text is `choices[].text` | DeepInfra requires the exact prompt template expected by the chosen model. The client never constructs chat messages, but an instruction-tuned catalog model still retains its own training behavior. |
| [Fireworks](https://docs.fireworks.ai/guides/completions-api) | `/inference/v1/completions` | Raw text generation without automatic message formatting | Model/template behavior still matters; base models provide the cleanest continuation semantics. |
| [Together AI](https://docs.together.ai/reference/completions) | `/v1/completions` | One `prompt`; returned text is `choices[].text` | Select an appropriate base model or supply the complete prompt template yourself. |
| [Mistral](https://docs.mistral.ai/api/endpoint/fim) | `/v1/fim/completions` | Native FIM `prompt` plus optional `suffix` | The request is non-chat, although the current API wraps text in `choices[].message.content`. |
| [OpenAI API](https://developers.openai.com/api/reference/resources/completions/methods/create) | `/v1/completions` | Legacy prompt completion for `gpt-3.5-turbo-instruct`, `davinci-002`, and `babbage-002` | All three are deprecated; only `gpt-3.5-turbo-instruct` supports `suffix`, and current flagship models use Responses instead. |
| [Hyperbolic](https://www.hyperbolic.ai/docs/inference/text-apis) | `/v1/completions` | Raw base-model `prompt`; returned text is `choices[].text` | Its only documented base-completion model, Llama 3.1 405B BASE, carries a sunset notice. The app keeps that one curated ID and does not substitute an instruct/chat model. |

Catalog parsing follows each provider's current native shape rather than assuming OpenAI uniformity. DeepSeek intersects its authenticated account list with the FIM schema's exact `deepseek-v4-pro` ID; DeepInfra reads its authenticated OpenAI-shaped `/v1/models` list, requires the exact nested `metadata.tags` value `text-generation`, applies `metadata.context_length`/`max_tokens`, and converts its published per-million prices to per-token estimates; Fireworks reads its documented account `models` collection and `supportsServerless` flag, then follows every `nextPageToken` because one response is capped at 200 records; Together reads the top-level array, keeps only `language`/`code` entries, and converts catalog prices from per-million to per-token before estimating cost; Mistral requires `capabilities.completion_fim`; OpenAI keeps only the three documented legacy completion IDs; and OpenRouter honors per-model `supported_parameters` plus mandatory-reasoning metadata. Hyperbolic uses its one documented sunset base ID without making an undocumented catalog request. A successful catalog with zero compatible models remains empty, while documentation-backed fallbacks are used only when discovery is unavailable.

Request bounds are provider-aware rather than cosmetic slider limits. DeepSeek FIM is capped at 4K output and sixteen stop sequences; DeepInfra, Fireworks, OpenAI, and OpenRouter accept at most four stop sequences; Together temperature is capped at 1; Mistral FIM temperature is capped at 1.5; and known model output/context limits constrain `max_tokens`. DeepInfra exposes only its raw-route guide fields (`max_tokens`, temperature, `top_p`, and stop), while parameters unsupported by any active provider or selected OpenRouter model are disabled and omitted from JSON; missing OpenRouter `supported_parameters` metadata is treated conservatively as no permission for optional fields.

Hyperbolic illustrates why the modes remain separated: its primary hosted API uses `/v1/chat/completions` and instruct models, while a distinct documented section retains `/v1/completions` for the sunset base model. This distinction is deliberately precise: a JSON request with `prompt` instead of `messages` proves that the client is not forcing chat structure, but only a provider/model that preserves the raw prompt can guarantee tokenizer-level continuation behavior. The Jest provider matrix asserts all eight emitted request bodies, DeepInfra's nested catalog contract, and Mistral's unusual response adapter; live requests still require the user's own provider key and an account-available model.

Each provider retains an isolated API key, endpoint, and model while the user switches adapters. Encrypted Completion settings store those maps inside a Completion-specific versioned schema, validate product kind/version and every endpoint before mutating the window, and make a complete restored provider/model/key ready without another catalog request.

### ChatGPT, Codex, and API credits

OpenAI's [ChatGPT and API billing are separate](https://help.openai.com/en/articles/9039756-billing-settings-in-chatgpt-vs-platform). A ChatGPT subscription does not fund general Platform API calls, and current ChatGPT flexible credits are limited to [supported features such as Codex and ChatGPT for Excel](https://help.openai.com/en/articles/12642688-using-credits-for-flexible-usage-in-chatgpt-free-go-plus-pro). Use an OpenAI Platform API key with Platform billing for this app. Likewise, OpenRouter, DeepSeek, DeepInfra, Fireworks, Together, Mistral, and Hyperbolic each require their own provider key and provider-side balance. Provider credentials are kept in memory unless the user explicitly downloads an encrypted Completion settings file.

## Terminal: tool-using chat harness

**Terminal** is the low-clutter, ordinary-language way to use Yolk. A conventional gray **File** strip sits above one black console field containing a centered animated face, the transcript, and a transparent inline prompt; the redundant app-brand and Help buttons are absent. There is no session dashboard, bordered composer, or Send button: click the prompt, type, and press Enter. A short rainbow cursor-mark carries the desktop's color language without breaking the terminal illusion.

Connection setup follows one visible decision tree. For hosted providers, choose the provider and paste its masked API key; Terminal then asks that provider for the models currently available to the account and presents the model choice. A custom-compatible server instead asks for its endpoint and model directly. The printed list is capped at eight clean choices, while name/id search covers the full fetched catalog. A known id, display name, or alias selects directly; a close typo such as `sonet` prompts one “Did you mean?” confirmation; a broad search such as `gpt` returns several ranked matches. The last choice always allows the entered model id exactly, so a newly released model is usable even when metadata is incomplete. `/models` refreshes the live catalog and `/model [search]` runs the same resolver. A rejected catalog credential returns to the masked key line; a network or browser-CORS failure keeps the key and offers the verified fallback list. `/providers` deliberately returns to provider choice, while the key step rejects incomplete or menu-like values without echoing them. Finishing setup reports **Ready**. If a user types the actual task before setup, Terminal holds it and runs it automatically after model selection. `/copy` copies the last Yolk answer; `/help` prints the optional command guide inside the transcript without adding permanent chrome.

Live discovery uses the providers' documented model-list routes for [OpenRouter](https://openrouter.ai/docs/api/api-reference/models/get-models), [DeepSeek](https://api-docs.deepseek.com/api/list-models), [OpenAI](https://developers.openai.com/api/docs/models), [Anthropic](https://platform.claude.com/docs/en/api/models/list), [Fireworks](https://docs.fireworks.ai/tools-sdks/python-client/api-reference), [Together](https://docs.together.ai/docs/inference/openai-compatibility), and [Mistral](https://docs.mistral.ai/api/endpoint/models). OpenRouter requests tool-capable models in low-price order; provider capability metadata is honored where available, and capability-opaque Fireworks/Together lists are intersected with known function-calling choices. Hyperbolic retains a documented curated fallback because its public inference guide does not establish a generic list route. Fallback recommendations were checked on **2026-07-31** and intentionally favor sufficient, economical tool use over benchmark flagships: [DeepSeek V4 Flash](https://api-docs.deepseek.com/news/news260424/) comes first for DeepSeek and OpenRouter, and [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) comes first for OpenAI and OpenRouter. Luna's listed $1/$6 per-million input/output prices are 80% below [GPT-5.6 Sol's](https://developers.openai.com/api/docs/models/gpt-5.6-sol) $5/$30, while both support function calling.

Visible Terminal copy stays user-facing. It does not print prompt rationale, security architecture, transport mechanics, registry/document counts, provider implementation notes, raw function names, or serialized tool results. Those details remain in code and documentation; `/status` exposes connection details on demand. The face retains one seven-character ASCII value for semantics, while the visible brackets, eyes, and mouth are crisp path glyphs inside a single fixed viewBox that scales with the Terminal container instead of wrapping when the window narrows.

Assistant lines give that face a brief speaking life. The two eye paths stay on one upper feature line and every mouth shape—open `O`, small `o`, wave, dash, smile, or rest—stays on a separate lower anchor. Animation swaps only path data, so font cap height, punctuation baselines, and glyph bearings cannot make a mouth jump above the eyes. Paint-only glow/opacity leaves the coordinate system physically still. Most words receive one held pose; only longer words may add a distinct second pose, with short phrase rests and an eighteen-frame cap for a calmer cadence. A filtered triangle/square oscillator pair makes the accompanying quiet, muffled computer murmur. This is intentionally nonverbal—there is no TTS, recorded voice, response-text playback, or external audio service. Browsers unlock the sound on the first Enter gesture; `/sound off` and `/sound on` control it without adding another button. A new answer or explicit `/face` command cancels the previous sequence, and reduced-motion mode leaves the face static.

Terminal is intentionally separate from Completion API. Tool calling needs structured assistant calls and tool-result records, so it uses OpenAI Responses for OpenAI, native Claude Messages blocks for Anthropic, and OpenAI-compatible Chat Completions for OpenRouter, DeepSeek, Fireworks, Together, Mistral, Hyperbolic, or a custom endpoint. The Anthropic adapter returns every `tool_use` as the matching next-message `tool_result`; all transports share the same eight-round local registry cap.

There is no supported general-purpose “use my consumer subscription” login to embed here. OpenAI keeps [ChatGPT and API billing separate](https://help.openai.com/en/articles/9039756), and ChatGPT flexible credits currently apply only to [supported ChatGPT features](https://help.openai.com/en/articles/12642688). Anthropic likewise says third-party products should use [Claude Console API-key authentication](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account), while Claude subscription OAuth is for native Anthropic surfaces such as Claude Code. `/login openai` and `/login anthropic` explain this boundary and continue into the correct key wizard; Yolk never asks for an account password or reuses a consumer session token.

Keys remain only in that Terminal window's memory unless the user explicitly chooses **File → Save Encrypted Settings**. That action saves the active provider plus every provider-scoped endpoint, selected model, and API key in a password-encrypted JSON file; **File → Open Encrypted Settings** restores it and resumes at the first incomplete setup step. A complete restored provider/key/model becomes ready immediately rather than making a redundant catalog call, while `/models` remains the explicit refresh path. Terminal and Completion API use the same versioned PBKDF2-SHA-256/AES-GCM envelope in `src/apps/shared/encrypted-settings.js`; Terminal also validates its own decrypted kind and schema before applying provider state. The plaintext settings are not written to browser storage. Requests still go directly from the browser to the selected endpoint. This direct-browser BYOK build is appropriate for private/local use, but provider keys should live behind a server-side secret store before a public deployment. OpenAI's own [API authentication guidance](https://platform.openai.com/docs/api-reference/authentication) warns against exposing keys in client code; Anthropic supports direct `x-api-key` requests but likewise recommends secure secret storage in its [authentication guide](https://platform.claude.com/docs/en/manage-claude/authentication).

The first harness exposes nine tools:

- list desktop applications and runtime windows;
- open an application or focus an exact window instance;
- read, replace, generate, and inspect Prompt Enhancer state/output;
- search the future Terminal knowledge corpus; and
- set the animated ASCII face to idle, smile, happy, thinking, surprised, sad, cry, or playful sinister.

`window.YolkDesktop` is the shell-owned manifest and open/focus/close bridge. `window.YolkToolRegistry.register(definition, handler)` is the extension seam for future native apps. Audio Interpolator and diskrot are cross-origin iframes today, so Terminal can open or focus them but does not pretend it can operate their internal controls until those apps install explicit adapters.

The future reference corpus has a ready insertion contract without fabricated starter content:

```js
window.YolkTerminalKnowledge.registerDocument({
  id: 'stable-source-id',
  title: 'Tool guide',
  text: 'Full normalized transcription or guide text...',
  tags: ['prompting', 'audio']
});
```

`knowledge_search` ranks those registered documents and tells the model the installed document count. Until Patreon material or other sources are supplied, that count stays zero and the system prompt explicitly forbids inventing missing material.

## Length handling model

Mix and string generation follow this pipeline:

1. Build the source chunk list from the configured children (canonical or randomized ordering rules).
2. Apply the selected length mode to that source list.

Length modes then decide how the length limit is enforced:

- **Split Final Chunk** trims the first chunk that would overflow.
- **Delete Final Chunk** stops before the first chunk that would overflow.
- **Fit to Smallest / Fit to Largest / Exactly Once** run a one-pass traversal of source lists.
- **Dropout** first builds a full all-once source list, skipping any child list after it is exhausted, then repeatedly removes random chunks and recounts until total length is `<= limit`.
- **Proportional Dropout** performs the same random-removal pass, but first merges every child list by relative chunk progress. A 20-chunk source and a 5-chunk source therefore contribute roughly four and one chunks per local group while both span the full prompt.

For Dropout in canonical order, surviving chunks keep canonical relative order; randomness controls which chunks remain.
For Proportional Dropout, canonical order uses deterministic relative-progress positions. Randomize interleave moves each chunk within its local proportional interval, so a short-list chunk can appear anywhere inside the corresponding long-list group without changing either child's chunking or internal order.
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
- **Proportional Dropout distributes unequal child lists across the full canonical seed** — `proportional_dropout_mix`
- **Proportional Dropout randomized interleave drifts chunks within local progress windows** — `proportional_dropout_random_interleave`
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

#### Help Mode

- **Every visible Prompt control, title-bar icon, and resize handle has specific Help copy plus accessible icon labels** — `help_copy_coverage`, `tests/dom.test.js`
- **Proportional Dropout Help explains relative-progress scheduling, local randomized windows, and unchanged child chunks** — `help_copy_coverage`
- **Completion Help explains versioned product-checked restores, provider-scoped endpoints/models/keys, per-model Top-k support, local-only Title, strict endpoints, and token/cost status** — `openrouter_app_window`, `tests/dom.test.js`
- **Terminal removes its redundant Help button while retaining precise accessibility guidance on the inline prompt, masked key step, centered speaking face, `/sound` control, File actions, and title-bar controls** — `terminal_app_window`, `tests/dom.test.js`

#### Window apps

- **Prompt workspace meets its file strip without an inherited flex-gap artifact** — `tests/windowBehavior.test.js`
- **File keeps the same flat /// text-menu chrome on desktop and mobile, without a mobile-only arrow or divided dropdown bay** — `tests/windowBehavior.test.js`, `prompt_menu_load_preset_item`
- **Pressing any interior window surface activates and raises that window without swallowing its control action** — `multi_prompt_windows_open`
- **A floating title-bar drag preserves its exact pointer offset while the frame crosses the desktop boundary; only edge proximity and release commit a snap** — `tests/windowBehavior.test.js`
- **All four floating borders and four corners resize with conventional directional cursors, meet usable edges exactly, and browser resizing re-fits stranded frames** — `tests/windowBehavior.test.js`
- **Side and four-corner edge releases tile exact halves/quarters, top-edge release maximizes, and the first snap offers other open windows through Snap Assist** — `desktop_window_snap_assist`, `tests/windowBehavior.test.js`
- **A later drop joins an existing snapped layout without a redundant chooser, while shared double-arrow separators resize both neighboring panes from one flush boundary** — `desktop_window_snap_assist`, `tests/windowBehavior.test.js`
- **Tall manual resizes give all remaining height to the scrollable app body instead of exposing an expanding gray frame bar** — `tests/windowBehavior.test.js`
- **The /// yolk start mark compensates slash rasterization per breakpoint, and mobile tabs stay centered on the same taskbar axis as Start** — `tests/windowBehavior.test.js`
- **Completion API appears in the menu and opens its own window** — `openrouter_app_window`
- **Completion API encrypted settings actions live in the top file menu (password + file save/open)** — `openrouter_app_window`
- **Completion API reuses the shell Help mode and standard boxed copy control** — `openrouter_app_window`
- **Completion copy feedback preserves the token and cost status readout** — `tests/openrouterApp.test.js`
- **Completion API model picker is dropdown-only and provider-scoped; DeepSeek's live account list is intersected with its exact FIM model, DeepInfra requires nested `metadata.tags` text-generation rows and applies nested token/pricing metadata, native Fireworks/Together/Mistral/OpenAI/OpenRouter catalog shapes are normalized, every Fireworks `nextPageToken` is followed, successful zero-match catalogs stay empty, and documented fallbacks are reserved for unavailable discovery** — `openrouter_app_window`, `tests/openrouterApp.test.js`
- **Completion API status breaks out billed input/output/total tokens and request cost when usage data is available** — `openrouter_app_window`
- **Completion API treats empty completion text as a successful blank response when stop sequences halt immediately** — `tests/openrouterApp.test.js`
- **Completion API copies intentionally blank output without treating it as failure** — `tests/openrouterApp.test.js`
- **OpenRouter, DeepInfra, Fireworks, Together, OpenAI Legacy, and Hyperbolic emit `prompt` with no `messages`; DeepSeek and Mistral add only documented optional FIM `suffix`, while OpenAI suffix is limited to `gpt-3.5-turbo-instruct`** — `tests/openrouterApp.test.js`
- **Provider/model capability controls omit unsupported fields, treat missing OpenRouter parameter metadata as permission for no optional fields, enforce DeepInfra/Fireworks/OpenAI/OpenRouter four-stop limits, DeepSeek's sixteen-stop/4K caps, Together's temperature-1 cap, Mistral FIM's temperature-1.5 cap, and known model token/context limits; they convert DeepInfra/Together per-million prices correctly and adapt Mistral's message-wrapped FIM response without changing its request shape** — `tests/openrouterApp.test.js`
- **Completion API exposes exactly eight documented prompt/FIM providers; DeepInfra stays on its raw-text route and text-generation catalog rows, while Hyperbolic is limited to its one sunset base-completion model, conservative fields, and no undocumented catalog route** — `openrouter_app_window`, `tests/openrouterApp.test.js`
- **Completion endpoints must be absolute HTTP(S) `/completions` URLs, so Chat, Responses, Messages, relative, and non-HTTP targets are rejected before POST** — `tests/openrouterApp.test.js`
- **Completion encrypted settings validate Completion kind/version and all endpoints before mutation, preserve every provider's key/endpoint/model, and restore a complete selection without a redundant catalog request** — `tests/openrouterApp.test.js`
- **Terminal appears in the start menu as one phosphor console with only a standard gray File launcher as permanent app chrome, a centered container-scaled one-line ASCII face, transparent normal and masked Enter-driven prompts, nine hidden tools, and an empty knowledge seam** — `terminal_app_window`, `tests/terminalApp.test.js`, `tests/dom.test.js`
- **Assistant lines drive at most eighteen calmly paced mouth poses inside one fixed 84x20 viewBox; eyes retain upper anchors, every mouth path retains its lower anchor independent of font metrics, and `/face` cancels leftover speech before applying a canonical emote** — `terminal_app_window`, `tests/terminalApp.test.js`, `tests/dom.test.js`
- **The quiet Enter-unlocked procedural murmur follows the same bounded phrase plan; `/sound on|off` controls it without TTS, recordings, external audio, or new permanent controls** — `terminal_app_window`, `tests/terminalApp.test.js`, `tests/dom.test.js`
- **Terminal presentation never prints security/prompt rationale, harness counts, provider notes, raw function names, or tool-result records; connection detail is available only on request through `/status`** — `terminal_app_window`, `tests/terminalApp.test.js`
- **Terminal provider → key → live model setup is a transcript-driven decision tree; authenticated catalogs prioritize DeepSeek V4 Flash and GPT-5.6 Luna, keep the full returned set searchable, and fall back to conservative tool-capable choices when discovery is unavailable** — `terminal_app_window`, `tests/terminalApp.test.js`
- **DeepSeek and every required-key path reject incomplete or menu-like credentials, catalog 401/403 responses return to the masked field, `/providers` changes the active stage, and provider range errors remain selectable** — `terminal_app_window`, `tests/terminalApp.test.js`
- **Terminal File → Save/Open roundtrips every provider-scoped model, endpoint, and API key through the shared password-encrypted envelope without exposing plaintext or redundantly refreshing a complete restored catalog** — `terminal_app_window`, `tests/terminalApp.test.js`
- **Masked secrets never echo, provider endpoints remain scoped, and a task typed before provider setup resumes automatically when the fields are ready** — `terminal_app_window`, `tests/terminalApp.test.js`
- **Terminal loops OpenAI-compatible chat calls, OpenAI Responses function calls, and native Anthropic Messages `tool_use`/`tool_result` blocks through the same local registry until final text or the eight-round safety cap** — `tests/terminalApp.test.js`
- **Terminal `/copy` provides copy convenience without adding another permanent button to the command surface** — `tests/terminalApp.test.js`
- **Terminal Prompt Enhancer tools can open a fresh prompt window, replace its state, generate, and return exact visible outputs** — `tests/terminalApp.test.js`
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
