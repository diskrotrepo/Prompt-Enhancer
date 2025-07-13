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

### Depth Control Note

Depth inputs rely on DOM watchers to rebuild values when related fields change.
Negative depth selectors that include positive modifiers must watch the
corresponding positive fields. Update `updateDepthContainers` if new inputs are
added so these watchers remain synchronized.

## Testing

Run the full suite with `npm test` whenever you modify code. Expand coverage whenever a bug is fixed or a new feature is added.
