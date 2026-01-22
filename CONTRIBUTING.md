# Contributing to ABC+ Maestro Player

Thank you for your interest in contributing! 🎵

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/abc-plus-maestro.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development

```bash
# Start dev server with hot reload
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

## Code Style

- TypeScript with strict mode
- No external runtime dependencies (vanilla approach)
- Use meaningful variable names
- Add JSDoc comments for public APIs

## Pull Request Process

1. Ensure your code builds without errors
2. Update documentation if needed
3. Write clear commit messages
4. Submit a PR with a description of changes

## Architecture Notes

- **Parser**: Converts ABC+ text → Musical Object Model (MOM)
- **Audio**: Web Audio API with FM synthesis fallback
- **Graphics**: SVG rendering with CSS-based highlighting
- **Transport**: State machine for playback control

## Questions?

Open an issue and we'll help you out!
