# AGENT Instructions

This directory stores the client side code. All files use two spaces for indentation with no trailing whitespace.

## Folder structure

```
src/
  index.html        # UI layout
  script.js         # main logic tied to the DOM
  style.css         # styling
  assets/           # images and fonts
  lib/              # pure functions only
  default_list.json   # preset data
  stateManager.js   # state container
  listManager.js    # preset list helpers
  storageManager.js # persistence helpers
  uiControls.js     # small DOM interactions
```

Place any side-effect free logic inside `src/lib` so other modules remain focused on their direct tasks.

## Testing

Run all checks with `npm test`. The goal is complete coverage. If any bug reaches production, write a test that exposes it and then consider similar gaps that might allow related bugs. Expand the suite until you are confident it cannot happen again.

