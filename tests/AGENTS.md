# AGENT Instructions for Tests

This directory contains Jest test suites verifying functionality of the Prompt Enhancer. Follow these guidelines when extending tests:

- **Targeted Coverage**: For every new feature or bug fix, add a focused test that exercises the specific behavior. Reproduce previously observed issues so the bug cannot recur.
- **Reusable Helpers**: Implement small utilities that load presets, generate prompts and save lists so that tests can chain these actions together. Helpers should keep DOM setup short and make it easy to compose common workflows.
- **Randomized Sequential Tests**: In addition to deterministic unit tests, create tests that simulate a full user session. Randomly perform a sequence of actions—load, generate, modify, save—and assert that no errors are thrown and the generated output remains valid. Run these sequences multiple times to explore edge cases.
- **Toggle Map**: For complex option interactions, maintain a table mapping toggle combinations to their expected output. Drive parameterized tests from this table so each scenario is explicitly verified.
- **Sanity Fixtures**: Keep the real-UI sanity regression in sync (`tests/sanity/`). Any behavior change must update both the input/expected JSON fixtures and the README Heuristic rule index.
- **Procedural Wallpaper**: Keep deterministic world-model checks, bare-desktop wheel isolation, and mobile release-momentum coverage in `wallpaper.test.js`. Assert stable signatures, bounded pool size, continuous palette parameters, long-tail touch glide distance/decay/cancellation, and window-scroll isolation; leave subjective composition and texture balance to browser visual QA rather than brittle pixel snapshots.
- **Desktop Window Geometry**: Reproduce drag/resize regressions with explicit
  desktop and window DOMRects. Assert pointer-to-frame offset during off-canvas
  drag, all eight floating resize directions, half/quarter snap targets,
  first-snap Assist, existing-layout Assist suppression, shared vertical and
  horizontal divider resizing, viewport re-fit, and the CSS flex-body contract;
  leave texture and translucent-preview appearance to browser visual QA.
- **Completion Provider Matrix**: Mock each documented provider endpoint and
  inspect the emitted JSON. Raw/FIM cases must assert `prompt`, absence of
  `messages`, capability-gated sampling fields, FIM `suffix`, and any unusual
  response wrapper. These tests establish client shape, not live credentials or
  a router's hidden tokenizer input. Keep the seven-provider UI allowlist explicit,
  with DeepSeek's live catalog intersected against exact FIM model V4 Pro and
  Hyperbolic restricted to its one documented sunset base model and fields,
  and cover the real catalog topologies: every Fireworks `models` page through
  `nextPageToken` plus camelCase serverless metadata, Together's top-level language/code array and per-million
  pricing, Mistral `completion_fim`, OpenAI's exact legacy IDs, and OpenRouter
  per-model parameter/reasoning flags, treating absent OpenRouter parameter
  metadata as permission for no optional fields. Hyperbolic must not trigger an invented
  catalog read or accept a chat/instruct substitute. Regress absolute `/completions` endpoint
  validation, provider stop/token/temperature caps (including Fireworks' four
  stops and Mistral FIM's 1.5 temperature maximum), successful zero-model
  catalogs, provider-scoped key/endpoint/model switching, product-kind/version
  rejection, and no redundant catalog read after a complete encrypted restore.
- **Terminal Harness**: Test OpenAI-compatible chat records, OpenAI Responses
  function calls, and Anthropic Messages `tool_use`/`tool_result` blocks. Drive
  provider setup by dispatching Enter from the inline prompt, assert masked keys
  never echo, and cover queued pre-setup tasks plus slash-only conveniences such
  as `/copy`. Exercise the provider → key → live model → ready path: assert that
  discovery is an authenticated GET, economical curated choices outrank returned
  flagship order, numbered selection uses the refreshed catalog, and 401/403
  returns to the masked key field. Cover unique typo confirmation, ambiguous
  ranked matches, fallback catalogs, and the exact-id escape hatch. A numeric
  menu value must remain rejected once the masked key stage begins, `/providers`
  must change the stage, an out-of-range provider number must stay in selection,
  and only a complete key plus model may mark local setup ready. Roundtrip
  provider-scoped endpoints, models, and keys through the shared encrypted
  File-menu envelope, asserting that ciphertext leaks no secret or model text
  and that a complete restore does not force a redundant catalog request. The
  presentation regression must reject a Terminal Help button,
  Send controls,
  session dashboards, security/prompt narration, raw function names, and wrapped
  or width-changing face glyphs. Stub Web Audio to assert an Enter-unlocked,
  low-volume oscillator murmur without speech synthesis; cover the eighteen-frame
  cap, seven-character canonical emotes, the fixed 84x20 feature viewBox,
  baseline-independent eye/mouth paths, paint-only face CSS, mouth-path state,
  `/face` cancellation, and `/sound` on/off while leaving reduced motion static.
  Exercise real registry handlers against the desktop bridge and Prompt Enhancer
  state; the sanity fixture guards the one-surface UI, gray encrypted File menu,
  decision guard, hidden tool harness, knowledge seam, and responsive centered
  face.

Remember the **50% Rule**: incremental test improvements build long-term reliability.

All tests must run with `npm test` as described in the repository root instructions.
