# Detailed AGENT Instructions

This repository contains a static web tool implemented in vanilla JavaScript. `src/script.js` defines the core logic and exposes a small API for unit tests. Indentation throughout the repository uses **two spaces** and no trailing whitespace.

## Testing

All programmatic checks should be executed with:

```bash
npm test
```

This runs the Jest test suite located under `tests/`.

Whenever you modify any JavaScript logic, especially functions in `src/script.js`, add or update the corresponding tests to keep coverage up to date. Tests should exercise edge cases and boundary conditions so that unusual inputs do not cause regressions.

Testing should happen in layers. Start with the usual unit tests and manual checks where you purposely examine uncommon scenarios. Next, build a functional test suite that modularizes typical user actions (loading files, generating, saving). Create a "random use" mode that chooses a sequence of these actions on randomized list data and repeat it many times to explore the error space.

## Conventions

* Prefer vanilla JavaScript and avoid dependencies.
* Keep HTML and CSS under the `src/` directory.
* Avoid introducing build steps; the tool should remain fully client side.
* Prefer modular, reusable code that assumes the underlying structure may change over time—functional programming is preferred over OOP.
* Extract all side-effect free logic into `src/lib/`. This keeps the main application thin and emphasizes reusable pure functions.

## Code Health

Be wary of code "ballooning" where older structures linger and complicate the current direction of the program. When a simpler or more efficient approach is apparent, refactor instead of layering on more code. Keep functions short and focused and remove obsolete parts when revising features.

## Lists File

The `src/default_list.js` file stores all modifier presets in one object. Each entry in `DEFAULT_LIST.presets` has the shape:

```javascript
{ id: 'example', title: 'Some title', type: 'negative', items: ['item1', 'item2'] }
```

`type` can be `negative`, `positive` or `length` (length lists contain a single numeric value). The file is large but purely data driven, so you rarely need to inspect it when working on functionality.

An additional preset type `order` contains numeric sequences used for insertion depths or item reorderings.
