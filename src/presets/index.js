// Preset catalog for local/file usage.
// Add entries as { name, file, state }.
window.PromptEnhancerPresetCatalog = {
  presets: [
    {
      name: 'yolkhead lyrics processor',
      file: 'yolkhead lyrics processor.json',
      state: {
        "mixes": [
          {
            "type": "mix",
            "id": "mix-1",
            "title": "space varied lyrics",
            "limit": 1000,
            "lengthMode": "fit-largest",
            "exact": true,
            "singlePass": true,
            "singlePassMode": "largest",
            "firstChunkBehavior": "size",
            "color": "1",
            "colorMode": "custom",
            "colorValue": "#df4af2",
            "colorPreset": "",
            "preserve": true,
            "orderMode": "canonical",
            "randomize": false,
            "delimiter": {
              "mode": "whitespace",
              "custom": "",
              "size": 1
            },
            "children": [
              {
                "type": "chunk",
                "id": "chunk-2",
                "title": "Lyrics Input",
                "text": "one does not grow old\nfor the sake of the maker\nwhen would one cease asking\nwho would the gods seize, when\nheated in the morning\nsilver and blue, just to rain\nwhen the sky breaks open,\nand in the rumbling gray we decide\nif we are meant to grow old, but\nnot if we are fated to grow\n\nmay my familiar grow long\nfor the sake of my family\nfather's day is just for you\nwho will you call my eyes next\nyou know the gray would narrate silence\nand in the stony gray you decide\nif it finds our ears at all",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "size",
                "color": "2",
                "colorMode": "custom",
                "colorValue": "#7e82f7",
                "colorPreset": "",
                "orderMode": "canonical",
                "randomize": false,
                "delimiter": {
                  "mode": "whitespace",
                  "custom": "",
                  "size": 1
                }
              },
              {
                "type": "variable",
                "id": "var-15",
                "targetId": "mix-14"
              }
            ]
          },
          {
            "type": "mix",
            "id": "mix-14",
            "title": "Space Insertions",
            "limit": 1000,
            "lengthMode": "dropout",
            "exact": true,
            "singlePass": false,
            "firstChunkBehavior": "size",
            "color": "3",
            "colorMode": "custom",
            "colorValue": "#f27878",
            "colorPreset": "",
            "preserve": true,
            "orderMode": "full-randomize",
            "randomize": false,
            "delimiter": {
              "mode": "whitespace",
              "custom": "",
              "size": 1
            },
            "children": [
              {
                "type": "chunk",
                "id": "chunk-17",
                "title": "0 spaces",
                "text": "",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "between",
                "color": "5",
                "colorMode": "auto",
                "colorValue": "",
                "colorPreset": "",
                "orderMode": "canonical",
                "randomize": false,
                "delimiter": {
                  "mode": "whitespace",
                  "custom": "",
                  "size": 4
                }
              },
              {
                "type": "chunk",
                "id": "chunk-18",
                "title": "1 space",
                "text": " ",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "size",
                "color": "2",
                "colorMode": "auto",
                "colorValue": "",
                "colorPreset": "",
                "orderMode": "canonical",
                "randomize": false,
                "delimiter": {
                  "mode": "whitespace",
                  "custom": "",
                  "size": 1
                }
              },
              {
                "type": "chunk",
                "id": "chunk-19",
                "title": "2 spaces",
                "text": "  ",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "size",
                "color": "4",
                "colorMode": "auto",
                "colorValue": "",
                "colorPreset": "",
                "orderMode": "canonical",
                "randomize": false,
                "delimiter": {
                  "mode": "whitespace",
                  "custom": "",
                  "size": 2
                }
              },
              {
                "type": "chunk",
                "id": "chunk-20",
                "title": "3 spaces",
                "text": "   ",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "size",
                "color": "5",
                "colorMode": "auto",
                "colorValue": "",
                "colorPreset": "",
                "orderMode": "canonical",
                "randomize": false,
                "delimiter": {
                  "mode": "whitespace",
                  "custom": "",
                  "size": 3
                }
              },
              {
                "type": "chunk",
                "id": "chunk-21",
                "title": "4 spaces",
                "text": "    ",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "size",
                "color": "1",
                "colorMode": "auto",
                "colorValue": "",
                "colorPreset": "",
                "orderMode": "canonical",
                "randomize": false,
                "delimiter": {
                  "mode": "whitespace",
                  "custom": "",
                  "size": 4
                }
              },
              {
                "type": "chunk",
                "id": "chunk-22",
                "title": "5 spaces",
                "text": "     ",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "size",
                "color": "2",
                "colorMode": "auto",
                "colorValue": "",
                "colorPreset": "",
                "orderMode": "canonical",
                "randomize": false,
                "delimiter": {
                  "mode": "whitespace",
                  "custom": "",
                  "size": 5
                }
              },
              {
                "type": "chunk",
                "id": "chunk-23",
                "title": "6 spaces",
                "text": "      ",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "size",
                "color": "4",
                "colorMode": "auto",
                "colorValue": "",
                "colorPreset": "",
                "orderMode": "canonical",
                "randomize": false,
                "delimiter": {
                  "mode": "whitespace",
                  "custom": "",
                  "size": 6
                }
              }
            ]
          }
        ],
        "colorPresets": []
      }
    }
  ]
};
