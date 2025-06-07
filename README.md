# Prompt-Enhancer

A lightweight web utility for creating "good" and "bad" prompt variations. The project is entirely client side with a single HTML page and accompanying JavaScript and CSS files.

## Running

Simply open `index.html` in your browser. No build step or server is required.

## Usage

1. Enter a comma, semicolon or newline separated **base prompt list**.
2. For each list below the base prompt you can pick a **default**, **image** or **empty** set, or provide your own values:
   - **Bad Descriptor List** – adjectives or phrases to prepend in the "bad" variant.
   - **Negative Modifier List** – short negation words like `not` or `no`.
   - **Positive Modifier List** – words or phrases to prepend in the "good" variant.
3. Choose how the bad descriptors and negatives should be combined using the **Negative Combination Mode** menu:
   - *Negative first* (default)
   - *Bad first*
   - *Negative only*
   - *Bad only*
   - *Mixed*
4. Toggle the **Positive Combination Mode** to turn positive modifiers on or off.
5. Set the maximum length for the generated output (default 1000 characters).
6. Click **Generate** to see the good and bad versions, or **Randomize** to shuffle the base list before generating.

Built‑in descriptor lists live in `script.js` and can be extended by editing that file. The interface is styled by `style.css` and uses a dark theme inspired by Diskrot.

## Repository Layout

- `index.html` – the user interface
- `script.js` – list generation logic
- `style.css` – page styling

There are no external images or Base64 assets; everything is plain text so the tool works completely offline.
