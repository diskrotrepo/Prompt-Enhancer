# Prompt Enhancer

A lightweight web utility for creating enhanced prompt variations for AI models. This tool generates both positive (quality-enhanced) and negative prompt versions of your base prompts, optimized for various AI generation platforms like Suno AI (audio) and Stable Diffusion (images).

## Overview

The Prompt Enhancer helps you create more effective prompts by:
- **Positive Conditioning**: Adds positive modifiers to enhance output quality
- **Negative Conditioning**: Prepends negative modifiers to help AI models avoid unwanted characteristics
- **Cycling Algorithm**: Intelligently cycles through modifiers to maximize prompt diversity within character limits

## Features

- **Multiple Input Formats**: Supports comma, semicolon, or newline-separated prompt lists
- **Preset Lists**: Built-in curated lists for audio and image generation
  - Audio negative lists (genres/styles to avoid)
  - Image negative lists (quality issues, artifacts)
  - Image positive lists (quality enhancers)
- **Custom Lists**: Full support for user-defined modifier lists
- **Smart Cycling**: Automatically cycles through base prompts and modifiers
- **Randomization Options**: Optional shuffling for each list independently
- **Divider Lists**: Choose between simple or natural newline phrases and create your own
- **Character Limits**: Configurable output length limits (presets for Suno and Riffusion)
- **No Dependencies**: Pure vanilla JavaScript, works completely offline
- **Dark Theme**: Eye-friendly interface inspired by Diskrot
- **Quick Copy Buttons**: Every textbox has a copy icon that briefly turns blue with a check mark when clicked
- **Insertion Depths**: Specify numeric lists for modifier insertion positions
- **State Saving**: Export and reload all current inputs for repeatable output
- **Deterministic Ordering**: Canonical or randomized lists control item ordering
- **Divider Ordering**: Control divider list order with canonical or random presets
- **Quick Actions**: One toggle sets all list ordering menus to canonical or randomized
- **Reroll Buttons**: Dice icons reroll random orders or switch the mode to random
- **Automatic Rerolls**: Random lists always reroll each time you generate

## How to Use

1. **Open the Tool**: Simply open `src/index.html` in your browser. No build step or server required.

2. **Enter Base Prompts**:
   - Add your base prompts in the first textarea
   - Separate multiple prompts with commas, semicolons, or newlines
   - Example: `cyberpunk city, neon lights, rain`

3. **Select Modifier Lists**:
   - **Negative Modifier List**: Choose a preset or create custom negative modifiers
   - **Positive Modifier List**: Choose a preset or create custom positive modifiers
   - Use the shuffle toggle next to each list title to randomize that list

4. **Set Length Limit**:
   - Choose a preset such as Suno (1000) or Riffusion (10000)
   - The number field remains editable for custom values
   - Use the **Hidden** toggle to hide this section if desired

5. **Generate**:
   - Click "Generate" to create variations
   - Shuffle toggles control whether each list is randomized

## How It Works

The tool uses a cycling algorithm that:

1. Takes each modifier from the selected lists
2. Combines it with base prompts in sequence
3. Creates pairs like: `[modifier] [base prompt]`
4. Continues cycling until the character limit is reached
5. Generates parallel positive/negative versions maintaining the same base prompt order

### Example

**Input Base Prompts**: `jazz, blues, rock`

**Negative Modifiers**: `mediocre, amateur`

**Positive Modifiers**: `masterpiece, high quality`

**Output**:
- Negative Conditioning: `mediocre jazz, amateur blues, mediocre rock, amateur jazz...`
- Positive Conditioning: `masterpiece jazz, high quality blues, masterpiece rock, high quality jazz...`

## File Structure

```
src/
├── index.html          # Main UI and structure
├── script.js           # Core logic and cycling algorithm
├── style.css           # Dark theme styling
├── assets/
│   └── logo.png        # Diskrot logo
└── default_list.js        # Modifier presets
```

### Key Files

- **index.html**: Contains the user interface with dynamically populated dropdown menus
- **script.js**: Implements the prompt generation algorithm with comprehensive comments
- **style.css**: Provides responsive dark theme styling with gradient backgrounds
- **default_list.js**: Contains curated modifier lists in a structured format

## Customization

### Adding New Preset Lists

Edit the preset file `src/default_list.js`:

```javascript
const DEFAULT_LIST = {
  presets: [
    {
      id: 'your-list-id',
      title: 'Your List Title',
      type: 'negative',
      items: ['item1', 'item2', 'item3']
    }
    // ... more presets
  ]
};
```

Each preset includes a `type` of `negative`, `positive` or `length`. Length presets use a single numeric value in `items`.

The system will automatically detect and add new presets to the dropdown menus.

### Modifying Existing Lists

Simply edit the `items` array in any preset. The changes will be reflected immediately upon page reload.

## Technical Details

- **No Build Process**: Pure client-side JavaScript
- **No External Dependencies**: Works completely offline
- **Browser Compatibility**: Works in all modern browsers
- **Responsive Design**: Mobile-friendly interface
- **Modular Architecture**: Clean separation of data, logic, and presentation

## Development & Testing

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the test suite:

   ```bash
   npm test
   ```

Tests live in the `tests/` directory and use the [Jest](https://jestjs.io/) framework.

## Use Cases

1. **AI Music Generation (Suno AI)**:
   - Create prompts that avoid unwanted genres
   - Enhance quality with audio-specific modifiers

2. **AI Image Generation (Stable Diffusion, DALL-E)**:
   - Add quality enhancers (8k, detailed, masterpiece)
   - Exclude common artifacts and quality issues

3. **General AI Prompting**:
   - Any AI model that benefits from negative prompting
   - Systematic prompt variation testing

## Contributing

Feel free to submit issues or pull requests. Some areas for contribution:
- Additional curated preset lists
- New length limit presets for other AI platforms
- UI/UX improvements
- Additional features

## License

This project is open source. See the repository for license details.

---

Built by Yolkhead for [Diskrot](https://www.diskrot.com)
