/**
 * Piano Keyboard Visualization
 * Interactive SVG-based piano keyboard for MIDI visualization
 */

interface PianoKeyboardOptions {
    startOctave?: number;
    endOctave?: number;
    onKeyPress?: (note: number) => void;
    onKeyRelease?: (note: number) => void;
}

export class PianoKeyboard {
    private container: HTMLElement | null = null;
    private svg: SVGSVGElement | null = null;
    private keys: Map<number, SVGRectElement> = new Map();
    
    private startOctave: number;
    private endOctave: number;
    private onKeyPress: ((note: number) => void) | null;
    private onKeyRelease: ((note: number) => void) | null;
    
    private whiteKeyWidth = 24;
    private whiteKeyHeight = 120;
    private blackKeyWidth = 14;
    private blackKeyHeight = 75;
    
    private blackKeyPositions = [1, 3, 6, 8, 10];
    private whiteKeyNotes = [0, 2, 4, 5, 7, 9, 11];
    
    constructor(options: PianoKeyboardOptions = {}) {
        this.startOctave = options.startOctave ?? 3;
        this.endOctave = options.endOctave ?? 5;
        this.onKeyPress = options.onKeyPress ?? null;
        this.onKeyRelease = options.onKeyRelease ?? null;
    }
    
    render(container: HTMLElement): void {
        this.container = container;
        this.keys.clear();
        
        const numOctaves = this.endOctave - this.startOctave + 1;
        const width = numOctaves * 7 * this.whiteKeyWidth;
        const height = this.whiteKeyHeight + 10;
        
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', 'auto');
        this.svg.style.maxHeight = '150px';
        this.svg.classList.add('piano-keyboard');
        
        let xOffset = 0;
        for (let octave = this.startOctave; octave <= this.endOctave; octave++) {
            xOffset = this.drawOctave(octave, xOffset);
        }
        
        container.innerHTML = '';
        container.appendChild(this.svg);
    }
    
    private drawOctave(octave: number, startX: number): number {
        if (!this.svg) return startX;
        const octaveGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        for (let i = 0; i < 7; i++) {
            const noteInOctave = this.whiteKeyNotes[i];
            const midiNote = (octave + 1) * 12 + noteInOctave;
            const key = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            key.setAttribute('x', String(startX + i * this.whiteKeyWidth));
            key.setAttribute('y', '0');
            key.setAttribute('width', String(this.whiteKeyWidth - 1));
            key.setAttribute('height', String(this.whiteKeyHeight));
            key.setAttribute('fill', '#ffffff');
            key.setAttribute('stroke', '#333333');
            key.setAttribute('rx', '3');
            key.classList.add('piano-key', 'white-key');
            this.addKeyInteraction(key, midiNote);
            octaveGroup.appendChild(key);
            this.keys.set(midiNote, key);
        }
        
        const blackKeyOffsets = [1, 2, 4, 5, 6];
        for (let i = 0; i < 5; i++) {
            const noteInOctave = this.blackKeyPositions[i];
            const midiNote = (octave + 1) * 12 + noteInOctave;
            const xPos = startX + blackKeyOffsets[i] * this.whiteKeyWidth - this.blackKeyWidth / 2;
            const key = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            key.setAttribute('x', String(xPos));
            key.setAttribute('y', '0');
            key.setAttribute('width', String(this.blackKeyWidth));
            key.setAttribute('height', String(this.blackKeyHeight));
            key.setAttribute('fill', '#1a1a1a');
            key.setAttribute('rx', '2');
            key.classList.add('piano-key', 'black-key');
            this.addKeyInteraction(key, midiNote);
            octaveGroup.appendChild(key);
            this.keys.set(midiNote, key);
        }
        
        this.svg.appendChild(octaveGroup);
        return startX + 7 * this.whiteKeyWidth;
    }
    
    private addKeyInteraction(key: SVGRectElement, midiNote: number): void {
        key.style.cursor = 'pointer';
        key.addEventListener('mousedown', () => {
            this.highlightKey(midiNote);
            this.onKeyPress?.(midiNote);
        });
        key.addEventListener('mouseup', () => {
            this.unhighlightKey(midiNote);
            this.onKeyRelease?.(midiNote);
        });
        key.addEventListener('mouseleave', () => this.unhighlightKey(midiNote));
    }
    
    highlightKey(midiNote: number): void {
        const key = this.keys.get(midiNote);
        if (key) {
            key.setAttribute('fill', key.classList.contains('white-key') ? '#6366f1' : '#818cf8');
        }
    }
    
    unhighlightKey(midiNote: number): void {
        const key = this.keys.get(midiNote);
        if (key) {
            key.setAttribute('fill', key.classList.contains('white-key') ? '#ffffff' : '#1a1a1a');
        }
    }
    
    clearHighlights(): void {
        for (const [note] of this.keys) this.unhighlightKey(note);
    }
}
