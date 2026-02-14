// Preset catalog for local/file usage.
// Add entries as { name, file, state }.
window.PromptEnhancerPresetCatalog = {
  "presets": [
    {
      "name": "yolkhead lyrics processor",
      "file": "yolkhead lyrics processor.json",
      "state": {
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
            "collapsed": false,
            "minimized": false,
            "maximized": true,
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
                "collapsed": false,
                "minimized": false,
                "maximized": true,
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
            "collapsed": true,
            "minimized": true,
            "maximized": false,
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
                "collapsed": false,
                "minimized": false,
                "maximized": true,
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
                "collapsed": true,
                "minimized": true,
                "maximized": false,
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
                "collapsed": true,
                "minimized": true,
                "maximized": false,
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
                "collapsed": true,
                "minimized": true,
                "maximized": false,
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
                "collapsed": true,
                "minimized": true,
                "maximized": false,
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
                "collapsed": true,
                "minimized": true,
                "maximized": false,
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
                "collapsed": true,
                "minimized": true,
                "maximized": false,
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
    },
    {
      "name": "yolkhead pos_neg example",
      "file": "yolkhead pos_neg example.json",
      "state": {
        "mixes": [
          {
            "type": "chunk",
            "id": "chunk-5",
            "title": "Prompt",
            "text": "A night sky Cassette smeared into tomorrow, An loop of a decomposing electric guitar and voice tape\nis juxtaposed over\nplugged in beside an a prepared piano dyad\nevanescent flux of industrial and a swirling ambience background sounds, Time continues, of industrial noise\nThe hands drying in the resulting combination\nis an irrigation from this dewdrop unsteady totter of irregular pond, A knowing smile meter\nand pitch intervals in passing conversation, Cat dependent\non chance decay ridges along a pink over time, As segments orange ceiling, sometimes the of the tape loop volume scrapes these white deteriorate, sputtering and wheezing teeth, sometimes, it descends replaces\nthe original recorded into silence, but it frequencies\nas the system is always present, A slowly collapses in on barbebìa, ",
            "limit": 1000,
            "lengthMode": "exact-once",
            "exact": true,
            "singlePass": true,
            "firstChunkBehavior": "between",
            "color": "1",
            "colorMode": "custom",
            "colorValue": "#79c0ec",
            "colorPreset": "",
            "orderMode": "canonical",
            "collapsed": true,
            "minimized": true,
            "maximized": false,
            "randomize": false,
            "delimiter": {
              "mode": "whitespace",
              "custom": "",
              "size": 4
            }
          },
          {
            "type": "mix",
            "id": "mix-6",
            "title": "Positive Conditioning",
            "limit": 1000,
            "lengthMode": "dropout",
            "exact": true,
            "singlePass": false,
            "firstChunkBehavior": "size",
            "color": "5",
            "colorMode": "custom",
            "colorValue": "#b6ce5f",
            "colorPreset": "",
            "preserve": true,
            "orderMode": "randomize-interleave",
            "collapsed": true,
            "minimized": true,
            "maximized": false,
            "randomize": true,
            "delimiter": {
              "mode": "whitespace",
              "custom": "",
              "size": 1
            },
            "children": [
              {
                "type": "variable",
                "id": "var-8",
                "targetId": "chunk-5"
              },
              {
                "type": "chunk",
                "id": "chunk-11",
                "title": "general good terms",
                "text": "good, best, great, wonderful, amazing, incredible, excellent, perfect, compelling, exceptional, exemplary, first-rate, masterful, foremost, gratifying, impressive, meaningful, outstanding, remarkable, standout, superior, top-notch, wonderful, enjoyable, fulfilling, insightful, refreshing, satisfying, solid, worthwhile, pleasing, high-quality",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "size",
                "color": "6",
                "colorMode": "custom",
                "colorValue": "#8cfb04",
                "colorPreset": "",
                "orderMode": "full-randomize",
                "collapsed": true,
                "minimized": true,
                "maximized": false,
                "randomize": true,
                "delimiter": {
                  "mode": "comma",
                  "custom": "",
                  "size": 1
                }
              }
            ]
          },
          {
            "type": "mix",
            "id": "mix-7",
            "title": "Negative Conditioning",
            "limit": 1000,
            "lengthMode": "dropout",
            "exact": true,
            "singlePass": false,
            "firstChunkBehavior": "size",
            "color": "2",
            "colorMode": "custom",
            "colorValue": "#e16666",
            "colorPreset": "",
            "preserve": true,
            "orderMode": "randomize-interleave",
            "collapsed": true,
            "minimized": true,
            "maximized": false,
            "randomize": true,
            "delimiter": {
              "mode": "whitespace",
              "custom": "",
              "size": 1
            },
            "children": [
              {
                "type": "variable",
                "id": "var-9",
                "targetId": "chunk-5"
              },
              {
                "type": "chunk",
                "id": "chunk-10",
                "title": "general bad terms",
                "text": "bad, worst, awful, terrible, horrible, unconvincing, mediocre, disappointing, displeasing, uninspiring, forgettable, lackluster, subpar, unenjoyable, shallow, stale, second-rate, disappointing, unimpressive, mundane, low-quality, unenjoyable, pointless, boring, tedious, drab, dull, vapid, unremarkable, unfulfilling, unsatisfying, uninsightful, ungratifying, unmasterful, uncompelling, unfavorable, poor, dreadful, abysmal, dismal, rubbish, unsatisfactory, atrocious, lousy",
                "limit": 1000,
                "lengthMode": "exact-once",
                "exact": true,
                "singlePass": true,
                "firstChunkBehavior": "size",
                "color": "3",
                "colorMode": "custom",
                "colorValue": "#ff4d00",
                "colorPreset": "",
                "orderMode": "full-randomize",
                "collapsed": true,
                "minimized": true,
                "maximized": false,
                "randomize": true,
                "delimiter": {
                  "mode": "comma",
                  "custom": "",
                  "size": 1
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
