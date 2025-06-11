# AGENT Instructions for Prompt-Enhancer

This repository contains a static web tool implemented in vanilla JavaScript. The
`src/script.js` file defines the core logic and now also exposes a small API for
unit tests. Indentation throughout the repository uses **two spaces** and no
trailing whitespace.

## Testing

All programmatic checks should be executed with:

```bash
npm test
```

This runs the Jest test suite located under `tests/`.

Whenever you modify any JavaScript logic, especially functions in
`src/script.js`, add or update the corresponding tests to keep coverage up to
date.

## Conventions

* Prefer vanilla JavaScript and keep dependencies minimal.
* Keep HTML and CSS under the `src/` directory.
* Avoid introducing build steps; the tool should remain fully client side.
