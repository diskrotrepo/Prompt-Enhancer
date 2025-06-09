# Prompt Enhancer

A lightweight web utility for creating enhanced prompt variations for AI models. This tool generates both "good" (quality-enhanced) and "bad" (negative prompt) versions of your base prompts, optimized for various AI generation platforms like Suno AI (audio) and Stable Diffusion (images).

## Overview

The Prompt Enhancer helps you create more effective prompts by:
- **Good Version**: Adds positive quality modifiers to enhance output quality
- **Bad Version**: Prepends negative descriptors to help AI models avoid unwanted characteristics
- **Cycling Algorithm**: Intelligently cycles through modifiers to maximize prompt diversity within character limits

## Features

- **Multiple Input Formats**: Supports comma, semicolon, or newline-separated prompt lists
- **Preset Lists**: Built-in curated lists for audio and image generation
  - Audio bad lists (genres/styles to avoid)
  - Image bad lists (quality issues, artifacts)
  - Image positive lists (quality enhancers)
- **Custom Lists**: Full support for user-defined modifier lists
- **Smart Cycling**: Automatically cycles through base prompts and modifiers
- **Randomization Options**: Optional shuffling for each list independently
- **Character Limits**: Configurable output length limits (presets for Suno and Riffusion)
- **No Dependencies**: Pure vanilla JavaScript, works completely offline
- **Dark Theme**: Eye-friendly interface inspired by Diskrot

## How to Use

1. **Open the Tool**: Simply open `src/index.html` in your browser. No build step or server required.

2. **Enter Base Prompts**: 
   - Add your base prompts in the first textarea
   - Separate multiple prompts with commas, semicolons, or newlines
   - Example: `cyberpunk city, neon lights, rain`

3. **Select Modifier Lists**:
   - **Bad Descriptor List**: Choose a preset or create custom negative modifiers
   - **Positive Modifier List**: Choose a preset or create custom quality enhancers
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
5. Generates parallel good/bad versions maintaining the same base prompt order

### Example

**Input Base Prompts**: `jazz, blues, rock`

**Bad Descriptors**: `mediocre, amateur`

**Positive Modifiers**: `masterpiece, high quality`

**Output**:
- Bad Version: `mediocre jazz, amateur blues, mediocre rock, amateur jazz...`
- Good Version: `masterpiece jazz, high quality blues, masterpiece rock, high quality jazz...`

## File Structure

```
src/
├── index.html          # Main UI and structure
├── script.js           # Core logic and cycling algorithm
├── style.css           # Dark theme styling
├── assets/
│   └── logo.png        # Diskrot logo
└── lists/
    ├── bad_lists.js     # Negative descriptor presets
    ├── good_lists.js    # Positive modifier presets
    └── length_lists.js  # Length limit presets
```

### Key Files

- **index.html**: Contains the user interface with dynamically populated dropdown menus
- **script.js**: Implements the prompt generation algorithm with comprehensive comments
- **style.css**: Provides responsive dark theme styling with gradient backgrounds
- **lists/**: Contains curated modifier lists in a structured format

## Customization

### Adding New Preset Lists

Edit the list files in `src/lists/`:

```javascript
// In bad_lists.js
const BAD_LISTS = {
  presets: [
    {
      id: 'your-list-id',
      title: 'Your List Title',
      items: ['item1', 'item2', 'item3']
    }
    // ... more presets
  ]
};
```

Length presets follow the same structure in `length_lists.js` with a single value per list.

The system will automatically detect and add new presets to the dropdown menus.

### Modifying Existing Lists

Simply edit the `items` array in any preset. The changes will be reflected immediately upon page reload.

## Technical Details

- **No Build Process**: Pure client-side JavaScript
- **No External Dependencies**: Works completely offline
- **Browser Compatibility**: Works in all modern browsers
- **Responsive Design**: Mobile-friendly interface
- **Modular Architecture**: Clean separation of data, logic, and presentation

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
