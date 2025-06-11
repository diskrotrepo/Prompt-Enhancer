# AGENT Instructions for Prompt-Enhancer

This repository contains a static web tool implemented in vanilla JavaScript. The
`src/script.js` file defines the core logic and exposes a small API for
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
date. Tests should exercise edge cases and boundary conditions so that unusual
inputs do not cause regressions.

## Conventions

* Prefer vanilla JavaScript and avoid dependencies.
* Keep HTML and CSS under the `src/` directory.
* Avoid introducing build steps; the tool should remain fully client side.
* Prefer modular, reusable code, that assumes the underlying structure may change over time ie functional programming is preferred over OOP

## Code Health

Be wary of code "ballooning" where older structures linger and complicate the
current direction of the program. When a simpler or more efficient approach is
apparent, refactor instead of layering on more code. Keep functions short and
focused and remove obsolete parts when revising features.

## Lists Folder

The `src/lists/` directory holds large data files with modifier presets. Each
file defines constants used by `script.js`:

* `bad_lists.js` and `good_lists.js` contain objects like:

  ```javascript
  const NEGATIVE_LISTS = {
    presets: [
      { id: 'example', title: 'Some title', items: ['item1', 'item2'] }
    ]
  };
  ```

  `POSITIVE_LISTS` and `LENGTH_LISTS` follow the same structure. Only the
  contents of `items` differ (strings vs a single numeric value).

* `adjectives.js`, `genres.js`, `prefixes.js` and `suffix.js` simply export
  arrays of strings.

These lists are very long but contain no logic, so there is rarely a need to
examine them in detail when modifying functionality.
