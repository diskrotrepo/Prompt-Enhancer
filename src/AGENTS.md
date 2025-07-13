# AGENT Instructions

The client code is consolidated into a single file `script.js`. Organize that file into clear sections:

- pure, side-effect free utilities at the top
- UI helpers below them
- any remaining logic in a final section

Favor side-effect free helpers grouped together and keep UI logic separate. Document each function so its inputs and outputs are clear.

This monolithic style is intentional to simplify searching for issues when working alongside an LLM. Comments should be thorough so the file acts as an outline of program flow.
Add a short table of contents at the top of `script.js` and keep it updated. Follow the **50% Rule**—small, clear comments and improvements accumulate into dependable code.
Indentation is two spaces with no trailing whitespace.

## Testing

Run the full suite with `npm test` whenever you modify code. Expand coverage whenever a bug is fixed or a new feature is added.
