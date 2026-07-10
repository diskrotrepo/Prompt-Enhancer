# AGENT Instructions for Prompt-Enhancer

This project is a lightweight web tool written in vanilla JavaScript. Indentation is two spaces with no trailing whitespace.
The UI is a Windows 3.1 style desktop (large-shape 90s confetti over teal, silver beveled windows, navy active title bars); see the Theme section in `src/AGENTS.md` before changing styles so new controls reuse the shared `--w31-*` tokens and bevel recipes.
Core shell logic lives in `src/script.js`, and app-specific logic can live in standalone monolithic files under `src/apps/<app-name>/` that register through `window.PromptEnhancerAppModules`. Keep each monolith well commented and organized as described in `src/AGENTS.md`. Help Mode uses `data-help` attributes or a central map in `script.js` to surface tooltips; maintain those hints when adding or changing controls. Provide clear, specific `data-help` text for every button, list, and input field—avoid generic phrases.

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
(loads `src/index.html` + `src/script.js`, clicks Generate). Any behavior change
must update the sanity input/expected JSON files and the README Heuristic rule index.
