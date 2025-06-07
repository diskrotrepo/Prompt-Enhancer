# Prompt-Enhancer
A prompt enhancer that includes various modes with sticky negative support.

The project is now purely JavaScript-based with a single web interface.

## Web Interface
Open `index.html` in your browser to use the tool. It provides text areas for a base prompt list, a "bad" descriptor list, and a list of negative modifiers. You can choose default, empty, or custom lists using the drop-down menus next to each box. A separate selector allows you to choose the **combination mode** controlling how the negative and bad terms are mixed:

* **Negative first** – run through negatives then bad descriptors (default).
* **Bad first** – run through bad descriptors before negatives.
* **Negative only** – output only negative-modified items.
* **Bad only** – output only bad descriptors.
* **Mixed** – randomly alternate between negatives and bad descriptors.

The page now emulates Diskrot's dark style with a split image/tool layout. All
images are embedded directly in the HTML using Base64 data URIs so no binary
files are needed.
