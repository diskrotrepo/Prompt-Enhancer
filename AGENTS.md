# AGENT Instructions for Prompt-Enhancer

This project is a lightweight web tool written in vanilla JavaScript. Indentation is two spaces with no trailing whitespace.
All client logic lives in a single `script.js` file to make code search easy when collaborating with an LLM. Keep that file well commented and organized as described in `src/AGENTS.md`. Help Mode uses `data-help` attributes or a central map in `script.js` to surface tooltips; maintain those hints when adding or changing controls. Provide clear, specific `data-help` text for every button, list, and input field—avoid generic phrases.

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
