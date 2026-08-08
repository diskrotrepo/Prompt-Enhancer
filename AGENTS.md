# AGENT Instructions for Prompt-Enhancer

This project is a lightweight web tool written in vanilla JavaScript. Indentation is two spaces with no trailing whitespace.
The UI is a Windows 3.1 style desktop (procedural large-shape 90s confetti over a gradually changing textured ground, silver beveled windows, navy active title bars, pointer-anchored off-canvas dragging, eight-direction frame resizing, half/quarter edge snapping with shared layout dividers and Snap Assist, and restrained per-box procedural pattern mats that expose prompt nesting). Box mats use audited pigment-like auto colors and family-specific density bounds; see the Theme section in `src/AGENTS.md` before changing styles so new controls reuse the shared `--w31-*` tokens, bevel recipes, and opaque silver work surfaces.
Core shell logic lives in `src/script.js`, and app-specific logic can live in standalone monolithic files under `src/apps/<app-name>/` that register through `window.PromptEnhancerAppModules`. Keep each monolith well commented and organized as described in `src/AGENTS.md`. Help Mode uses `data-help` attributes or a central map in `script.js` to surface tooltips; maintain those hints when adding or changing controls. Provide clear, specific `data-help` text for every button, list, and input field—avoid generic phrases.

Completion API and Terminal have intentionally different transport contracts. `src/apps/openrouter-completions/app.js` is the multi-provider raw/FIM surface: every request must contain `prompt`, must never contain `messages`, and may add `suffix` only for documented FIM adapters or OpenAI's model-specific legacy suffix. Its current allowlist is OpenRouter, DeepSeek FIM, DeepInfra raw text completion, Fireworks, Together, Mistral FIM, OpenAI Legacy, and Hyperbolic's sunset base-completion route. Require an absolute HTTP(S) URL ending in `/completions`; keep Hyperbolic limited to its one documented base model, conservative `max_tokens`/`temperature` fields, and no invented catalog route. The provider records are the protocol allowlist for request fields, stop/token/temperature limits, response extraction, pricing units, catalog interpretation, and pagination. Preserve DeepSeek's authenticated model list intersected with exact FIM model `deepseek-v4-pro`, DeepInfra's authenticated `/v1/models` list filtered by exact `metadata.tags` value `text-generation` plus its nested token/pricing metadata, every Fireworks `models` page through `nextPageToken` plus camelCase serverless metadata, Together's top-level language/code array and per-million prices, Mistral's `capabilities.completion_fim` gate and temperature maximum of 1.5, OpenAI's exact legacy completion IDs, OpenRouter's per-model `supported_parameters`/mandatory-reasoning filters, and DeepInfra/Fireworks/OpenAI/OpenRouter's four-stop limits. Completion encrypted settings must validate Completion kind/version before mutation, retain provider-scoped key/endpoint/model maps, and make a complete restored provider/model/key ready without a catalog call. `src/apps/terminal/app.js` is the conversational tool harness: it may use Chat Completions, OpenAI Responses, or native Anthropic Messages because function calls require structured call/result records. Do not blur these modes or imply that a routed chat-trained model guarantees tokenizer-level raw continuation.

Terminal extensions register schemas and handlers through `window.YolkToolRegistry`; application discovery and window operations come from the shell-owned `window.YolkDesktop` bridge. Future reference material enters through `window.YolkTerminalKnowledge.registerDocument`. Preserve the explicit empty-corpus behavior and describe cross-origin iframe apps as open/focus-only until they provide native adapters. Terminal's connection UX is deliberately one transcript-driven state machine: required-key providers follow provider → masked key → live model catalog → model, while a custom provider follows provider → endpoint → model. Do not restore provider/model/key panels or selectors. Successful catalog reads reflect current account availability and pin economical tool-capable recommendations such as DeepSeek V4 Flash and GPT-5.6 Luna first; documented curated choices remain the fallback when discovery is unavailable. Model resolution accepts numbers, exact ids/names/aliases, typo confirmation, ranked fuzzy matches, and an explicit use-as-typed escape hatch for newer model ids. Keep the key field masked and transient, never echo secrets, preserve queued pre-setup requests, and expose rare controls through slash commands instead of permanent buttons. A credential step must reject short, whitespace-containing, or menu-like input without leaving that step; a 401/403 catalog response must return to that key step; `/providers` must return the state machine to provider selection; and locally complete configuration is described as **ready**, not authenticated or connected, until a real request succeeds. API keys remain in the cloned window's memory unless the user explicitly chooses Terminal File → Save Encrypted Settings; `src/apps/shared/encrypted-settings.js` is the single PBKDF2/AES-GCM envelope used by Terminal and Completion API, and loading must validate product kind/version before applying provider-scoped state. A complete restored provider/model/key becomes ready without forcing another catalog call. Terminal's app strip is the standard gray File menu with encrypted Open/Save only—do not add a redundant Help button or app brand there. The visible Terminal must not narrate its prompt, security rationale, registry size, transport, tool names, or harness architecture: show necessary questions and human-readable outcomes only. Its composer is an inline transparent prompt submitted with Enter—never restore a boxed field or Send button. The face keeps a seven-character ASCII string for semantics, but its visible brackets, eyes, and mouth are baseline-independent SVG paths inside one fixed 84x20 viewBox; never return animated features to a font string. Eye paths stay on their shared upper anchor and mouth paths on their lower anchor at every window width. Assistant lines may drive broad mouth-path frames plus a capped, quiet procedural Web Audio murmur after an Enter gesture; ambient face animation must be paint-only so the viewBox never translates, scales, or jitters. This effect must never use TTS, recorded speech, external voice services, or response-text playback. Respect reduced motion for the face and keep sound controllable through `/sound on|off` rather than adding chrome.

Prompt files can now be appended through **+ Add Save** controls at the root or inside any mix. Keep append-save behavior distinct from file-menu Open: Open replaces the active prompt state, while Add Save imports saved top-level `mixes` entries into the clicked level and preserves existing boxes.

The project embraces the **50% Rule**: many small, better-than-even improvements compound into reliable software. Document intent and reasoning so later revisions build on that advantage.

## Applying the 50% Rule to LLM Collaboration

The 50% Rule in this context means diversifying token combinations to reinforce semantic meaning. When making changes, use multiple "attack angles" to document them:

- **Token Diversity**: Express changes via line-by-line comments, structural overviews, TOC updates, natural language explanations, and examples.
- **Reinforcement**: Each method adds redundancy; if one is unclear, others clarify the intent.
- **Permutation**: Reorder or rephrase documentation to activate different model pathways.

Directives for LLMs:
- For every change, update comments in code files using at least three methods (e.g., function purpose, line-by-line, section summary).
- Ensure AGENTS.md files reflect new structures.
- Use diverse phrasing to communicate changes to future LLM instances, increasing success probability.

Heuristics discipline: whenever behavior changes or grows, expand the README Heuristic rule index and add/adjust matching sanity fixtures so the documentation and regression coverage stay in lockstep.

For development details see `src/AGENTS.md`.

## Testing

Run all programmatic checks with:

```bash
npm test
```

Always execute the test suite whenever you change code.
The sanity regression lives in `tests/sanity/` and drives the real UI flow
(loads `src/index.html`, registered app modules, and `src/script.js`, then clicks Generate). Any behavior change
must update the sanity input/expected JSON files and the README Heuristic rule index.
