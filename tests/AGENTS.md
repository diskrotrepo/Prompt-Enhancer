# AGENT Instructions for Tests

This directory contains Jest test suites verifying functionality of the Prompt Enhancer. Follow these guidelines when extending tests:

- **Targeted Coverage**: For every new feature or bug fix, add a focused test that exercises the specific behavior. Reproduce previously observed issues so the bug cannot recur.
- **Reusable Helpers**: Implement small utilities that load presets, generate prompts and save lists so that tests can chain these actions together. Helpers should keep DOM setup short and make it easy to compose common workflows.
- **Randomized Sequential Tests**: In addition to deterministic unit tests, create tests that simulate a full user session. Randomly perform a sequence of actions—load, generate, modify, save—and assert that no errors are thrown and the generated output remains valid. Run these sequences multiple times to explore edge cases.

Remember the **50% Rule**: incremental test improvements build long-term reliability.

All tests must run with `npm test` as described in the repository root instructions.
