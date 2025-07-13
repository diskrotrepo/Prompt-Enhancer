# Prompt Enhancer

Prompt Enhancer is a small web tool for building AI prompts. It combines base prompts with positive and negative modifiers to produce two variations. Everything runs in the browser with no build step.

Open `src/index.html` to use the tool. Enter a list of base phrases, pick modifier presets and press **Generate**. You can save your data to a file or reload it later.

The code is intentionally kept in a single `script.js` file so an LLM can search through the entire logic easily. Comments and a small table of contents guide navigation. Following the **50% Rule**, even small clarifications or tests compound into a much more reliable project.

## Development

Install dependencies and run the test suite:

```bash
npm test
```

Tests live in the `tests/` directory and cover all functionality.
