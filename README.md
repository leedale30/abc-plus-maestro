# ABC+ Maestro Player

<p align="center">
  <strong>🎵 High-performance ABC+ notation player with Web Audio synthesis</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#abc-notation">ABC+ Notation</a> •
  <a href="#api">API</a> •
  <a href="#roadmap">Roadmap</a>
</p>

---

## Features

- **🎹 FM Synthesis** – Real-time audio via Web Audio API oscillators
- **📜 ABC+ Parser** – Full ABC 2.1 support with custom `%%` directives
- **🎼 SVG Rendering** – Clean black-on-white notation with note highlighting
- **⏯️ Transport Controls** – Play, pause, stop with keyboard shortcuts
- **🎯 Tempo Sync** – Derives BPM from `Q:` header, defaults to 120
- **📱 Responsive** – Works on desktop and mobile browsers
- **⚡ Fast** – Sub-second load times, <150KB JavaScript payload

## Demo

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/leedale30/abc-plus-maestro.git
cd abc-plus-maestro

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## ABC+ Notation

ABC+ extends standard ABC 2.1 notation with custom directives:

```abc
X:1
T:Example Tune
M:4/4
L:1/8
Q:1/4=120
K:C
%%dir mood="bright" intensity="0.8"
|: "C"C2 E2 G2 c2 | "G"B2 d2 g2 f2 :|
```

### Supported Directives

| Directive | Purpose |
|-----------|---------|
| `%%dir` | Performance directions (mood, intensity) |
| `%%fx` | Audio effects (reverb, delay) |
| `%%swing` | Swing timing interpretation |
| `%%marker` | Rehearsal marks |
| `%%vskip` | Vertical spacing |

See [ABC_PLUS_PLAYER_SPEC.md](./ABC_PLUS_PLAYER_SPEC.md) for full specification.

## Project Structure

```
src/
├── main.ts              # Application entry
├── types.ts             # TypeScript definitions
├── parser/
│   └── ABCPlusParser.ts # ABC+ → Musical Object Model
├── audio/
│   ├── AudioSessionManager.ts  # Singleton playback control
│   ├── FMSynth.ts              # Oscillator synthesis
│   └── Sequencer.ts            # Tempo-synced scheduling
├── graphics/
│   └── SVGRenderer.ts   # Notation rendering
└── style.css            # UI styles
```

## API

### ABCPlusParser

```typescript
import { ABCPlusParser } from './parser/ABCPlusParser';

const parser = new ABCPlusParser();
const result = parser.parse(abcString);

// result.mom – Musical Object Model
// result.directives – Parsed %% directives
// result.errors – Parse errors
```

### AudioSessionManager

```typescript
import { AudioSessionManager } from './audio/AudioSessionManager';

const manager = AudioSessionManager.getInstance();
await manager.prime(parseResult);
manager.play();
manager.pause();
manager.stop();
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `Escape` | Stop |

## Roadmap

- [ ] JIT instrument shard loading
- [ ] Real sample-based instruments (Harpsichord, Violin, Cello)
- [ ] MusicXML 4.0 export
- [ ] MIDI file export
- [ ] React/Vue wrapper components
- [ ] Score virtualization for long pieces

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License – see [LICENSE](./LICENSE) for details.

---

<p align="center">
  Built with ❤️ for music education
</p>
