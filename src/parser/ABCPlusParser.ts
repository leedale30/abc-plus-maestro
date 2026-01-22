/**
 * ABC+ Semantic Parser
 * Parses ABC+ notation into Musical Object Model (MOM)
 */

import type {
    ParseResult,
    MusicalObjectModel,
    ABCHeaders,
    DirectivesMap,
    Directive,
    DirectiveType,
    Note,
    Rest,
    Chord,
    Measure,
    VoiceDefinition,
    ParseError,
    ParseWarning,
    DecorationType
} from '../types';

export class ABCPlusParser {
    private currentLine = 0;
    private currentColumn = 0;
    private errors: ParseError[] = [];
    private warnings: ParseWarning[] = [];

    parse(abcContent: string): ParseResult {
        this.reset();

        const lines = abcContent.split('\n');
        const headers = this.parseHeaders(lines);
        const directives = this.parseDirectives(lines);
        const { measures, voices } = this.parseBody(lines, headers);

        const totalDuration = measures.reduce((sum, m) => sum + m.duration, 0);

        const mom: MusicalObjectModel = {
            headers,
            measures,
            totalDuration,
            voices
        };

        return {
            mom,
            directives,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    private reset(): void {
        this.currentLine = 0;
        this.currentColumn = 0;
        this.errors = [];
        this.warnings = [];
    }

    // ==========================================
    // Header Parsing
    // ==========================================

    private parseHeaders(lines: string[]): ABCHeaders {
        const headers: ABCHeaders = {
            X: 1,
            T: 'Untitled',
            M: '4/4',
            L: '1/8',
            K: 'C'
        };

        const voiceDefinitions: VoiceDefinition[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('%')) continue;

            // Stop at body content
            if (!trimmed.match(/^[A-Za-z]:/)) break;

            const match = trimmed.match(/^([A-Z]):\s*(.*)$/);
            if (match) {
                const [, field, value] = match;

                switch (field) {
                    case 'X':
                        headers.X = parseInt(value, 10) || 1;
                        break;
                    case 'T':
                        headers.T = value;
                        break;
                    case 'C':
                        headers.C = value;
                        break;
                    case 'M':
                        headers.M = value;
                        break;
                    case 'L':
                        headers.L = value;
                        break;
                    case 'Q':
                        headers.Q = value;
                        break;
                    case 'K':
                        headers.K = value;
                        break;
                    case 'V':
                        voiceDefinitions.push(this.parseVoiceDefinition(value));
                        break;
                }
            }
        }

        if (voiceDefinitions.length > 0) {
            headers.V = voiceDefinitions;
        }

        return headers;
    }

    private parseVoiceDefinition(value: string): VoiceDefinition {
        const parts = value.split(/\s+/);
        const def: VoiceDefinition = { id: parts[0] || 'V1' };

        // Parse additional attributes like name="Violin I" clef=treble
        const nameMatch = value.match(/name="([^"]+)"/);
        if (nameMatch) def.name = nameMatch[1];

        const shortMatch = value.match(/short(?:name)?="([^"]+)"/);
        if (shortMatch) def.shortName = shortMatch[1];

        const clefMatch = value.match(/clef=(\w+)/);
        if (clefMatch) def.clef = clefMatch[1] as VoiceDefinition['clef'];

        return def;
    }

    // ==========================================
    // Directive Parsing
    // ==========================================

    private parseDirectives(lines: string[]): DirectivesMap {
        const directives: DirectivesMap = {
            dir: [],
            fx: [],
            analysis: [],
            game_state: [],
            loop: [],
            art: [],
            marker: [],
            swing: [],
            mute: [],
            layout: [],
            harmony: []
        };

        let measureNumber = 0;
        let beatPosition = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Track measure for positioning
            if (line.includes('|')) {
                measureNumber += (line.match(/\|/g) || []).length;
            }

            // Parse %% directives
            if (line.startsWith('%%')) {
                const directive = this.parseDirective(line, measureNumber, beatPosition);
                if (directive) {
                    this.categorizeDirective(directive, directives);
                }
            }
        }

        return directives;
    }

    private parseDirective(line: string, measure: number, position: number): Directive | null {
        const match = line.match(/^%%(\w+(?:-\w+)?)\s*(.*)$/);
        if (!match) return null;

        const [, name, rest] = match;
        const type = this.getDirectiveType(name);
        const attributes = this.parseAttributes(rest);

        return {
            type,
            position,
            measure,
            attributes
        };
    }

    private getDirectiveType(name: string): DirectiveType {
        const typeMap: Record<string, DirectiveType> = {
            'dir': 'dir',
            'fx': 'fx',
            'analysis': 'analysis',
            'game_state': 'game_state',
            'loop': 'loop',
            'art': 'art',
            'marker': 'marker',
            'swing': 'swing',
            'swing-off': 'swing',
            'mute': 'mute',
            'mute-off': 'mute',
            'vskip': 'vskip',
            'sep': 'sep',
            'measurenumbering': 'measurenumbering',
            'frame': 'frame',
            'fb': 'fb'
        };
        return typeMap[name] || 'dir';
    }

    private parseAttributes(attrString: string): Record<string, string> {
        const attrs: Record<string, string> = {};

        // Parse key="value" patterns
        const regex = /(\w+)="([^"]+)"/g;
        let match;
        while ((match = regex.exec(attrString)) !== null) {
            attrs[match[1]] = match[2];
        }

        // If no key-value pairs, treat the whole string as a single value
        if (Object.keys(attrs).length === 0 && attrString.trim()) {
            attrs['value'] = attrString.trim();
        }

        return attrs;
    }

    private categorizeDirective(directive: Directive, map: DirectivesMap): void {
        switch (directive.type) {
            case 'dir':
                map.dir.push(directive);
                break;
            case 'fx':
                map.fx.push(directive);
                break;
            case 'analysis':
                map.analysis.push(directive);
                break;
            case 'game_state':
                map.game_state.push(directive);
                break;
            case 'loop':
                map.loop.push(directive);
                break;
            case 'art':
                map.art.push(directive);
                break;
            case 'marker':
                map.marker.push(directive);
                break;
            case 'swing':
                map.swing.push(directive);
                break;
            case 'mute':
                map.mute.push(directive);
                break;
            case 'vskip':
            case 'sep':
            case 'measurenumbering':
                map.layout.push(directive);
                break;
            case 'frame':
            case 'fb':
                map.harmony.push(directive);
                break;
        }
    }

    // ==========================================
    // Body Parsing (Notes, Rests, Chords)
    // ==========================================

    private parseBody(lines: string[], headers: ABCHeaders): {
        measures: Measure[];
        voices: Map<string, (Note | Rest | Chord)[]>;
    } {
        const measures: Measure[] = [];
        const voices = new Map<string, (Note | Rest | Chord)[]>();

        let currentMeasure: Measure = this.createMeasure(1, 0);
        let currentVoice = 'V1';
        let beatPosition = 0;
        let noteIdCounter = 0;

        const defaultLength = this.parseFraction(headers.L);
        const meterBeats = this.getMeterBeats(headers.M);

        // Find body start (after K: header)
        let bodyStartIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('K:')) {
                bodyStartIndex = i + 1;
                break;
            }
        }

        // Initialize default voice
        voices.set(currentVoice, []);

        for (let lineIndex = bodyStartIndex; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex].trim();

            // Skip empty lines, comments, and directives
            if (!line || line.startsWith('%')) continue;

            // Voice change
            const voiceMatch = line.match(/^V:(\S+)/);
            if (voiceMatch) {
                currentVoice = voiceMatch[1];
                if (!voices.has(currentVoice)) {
                    voices.set(currentVoice, []);
                }
                continue;
            }

            // Skip inline voice declarations
            if (line.startsWith('V:')) continue;

            // Parse notes and rests in the line
            const tokens = this.tokenizeLine(line);

            for (const token of tokens) {
                if (token === '|' || token === '|]' || token === '||' || token === ':|' || token === '|:') {
                    // Barline - finalize current measure
                    if (currentMeasure.elements.length > 0) {
                        currentMeasure.duration = beatPosition - currentMeasure.startTime;
                        if (token === '|]') currentMeasure.barlineType = 'final';
                        else if (token === '||') currentMeasure.barlineType = 'double';
                        else if (token === '|:') currentMeasure.barlineType = 'repeat-start';
                        else if (token === ':|') currentMeasure.barlineType = 'repeat-end';
                        measures.push(currentMeasure);
                    }
                    currentMeasure = this.createMeasure(measures.length + 1, beatPosition);
                    continue;
                }

                // Skip chord symbols (text in quotes)
                if (token.startsWith('"')) continue;

                // Parse note or rest
                const element = this.parseElement(token, noteIdCounter++, beatPosition, currentVoice, currentMeasure.number, defaultLength);

                if (element) {
                    currentMeasure.elements.push(element);
                    voices.get(currentVoice)?.push(element);
                    beatPosition += element.duration;
                }
            }
        }

        // Add final measure if it has content
        if (currentMeasure.elements.length > 0) {
            currentMeasure.duration = beatPosition - currentMeasure.startTime;
            measures.push(currentMeasure);
        }

        return { measures, voices };
    }

    private tokenizeLine(line: string): string[] {
        const tokens: string[] = [];
        let i = 0;

        while (i < line.length) {
            const char = line[i];

            // Skip whitespace
            if (char === ' ' || char === '\t') {
                i++;
                continue;
            }

            // Barlines
            if (char === '|') {
                let barline = '|';
                if (line[i + 1] === ']') { barline = '|]'; i++; }
                else if (line[i + 1] === '|') { barline = '||'; i++; }
                else if (line[i + 1] === ':') { barline = '|:'; i++; }
                tokens.push(barline);
                i++;
                continue;
            }

            if (char === ':' && line[i + 1] === '|') {
                tokens.push(':|');
                i += 2;
                continue;
            }

            // Chord symbols in quotes
            if (char === '"') {
                let j = i + 1;
                while (j < line.length && line[j] !== '"') j++;
                tokens.push(line.slice(i, j + 1));
                i = j + 1;
                continue;
            }

            // Decorations !xxx!
            if (char === '!') {
                let j = i + 1;
                while (j < line.length && line[j] !== '!') j++;
                // Skip decoration, it's handled in note parsing
                i = j + 1;
                continue;
            }

            // Notes, rests, and modifiers
            if (this.isNoteChar(char) || char === 'z' || char === 'Z' || char === '^' || char === '_' || char === '=') {
                let j = i;
                // Include accidentals
                while (j < line.length && (line[j] === '^' || line[j] === '_' || line[j] === '=')) j++;
                // Include note letter
                if (j < line.length && this.isNoteChar(line[j])) j++;
                // Include octave markers
                while (j < line.length && (line[j] === "'" || line[j] === ',')) j++;
                // Include duration
                while (j < line.length && (line[j].match(/\d/) || line[j] === '/')) j++;

                tokens.push(line.slice(i, j));
                i = j;
                continue;
            }

            i++;
        }

        return tokens;
    }

    private isNoteChar(char: string): boolean {
        return /[A-Ga-gz]/.test(char);
    }

    private parseElement(
        token: string,
        id: number,
        startTime: number,
        voice: string,
        measure: number,
        defaultLength: number
    ): Note | Rest | null {
        if (!token) return null;

        // Rest
        if (token.startsWith('z') || token.startsWith('Z')) {
            const duration = this.parseDuration(token.slice(1), defaultLength);
            return {
                id: `rest_${id}`,
                duration,
                startTime,
                voice,
                measure
            } as Rest;
        }

        // Note
        const { pitch, midiNote, lengthModifier } = this.parseNotePitch(token);
        const duration = this.parseDuration(lengthModifier, defaultLength);

        return {
            id: `note_${id}`,
            pitch,
            midiNote,
            duration,
            startTime,
            velocity: 0.8,
            voice,
            measure
        } as Note;
    }

    private parseNotePitch(token: string): { pitch: string; midiNote: number; lengthModifier: string } {
        let i = 0;
        let accidental = 0;

        // Parse accidentals
        while (i < token.length) {
            if (token[i] === '^') { accidental++; i++; }
            else if (token[i] === '_') { accidental--; i++; }
            else if (token[i] === '=') { accidental = 0; i++; }
            else break;
        }

        // Parse note letter
        const letter = token[i];
        i++;

        // Parse octave modifiers
        let octaveShift = 0;
        while (i < token.length) {
            if (token[i] === "'") { octaveShift++; i++; }
            else if (token[i] === ',') { octaveShift--; i++; }
            else break;
        }

        // Calculate MIDI note
        const baseMidi = this.letterToMidi(letter);
        const midiNote = baseMidi + accidental + (octaveShift * 12);

        const pitch = token.slice(0, i);
        const lengthModifier = token.slice(i);

        return { pitch, midiNote, lengthModifier };
    }

    private letterToMidi(letter: string): number {
        // Middle C (c) = MIDI 60
        const baseMap: Record<string, number> = {
            'C': 48, 'D': 50, 'E': 52, 'F': 53, 'G': 55, 'A': 57, 'B': 59,
            'c': 60, 'd': 62, 'e': 64, 'f': 65, 'g': 67, 'a': 69, 'b': 71
        };
        return baseMap[letter] || 60;
    }

    private parseDuration(modifier: string, defaultLength: number): number {
        if (!modifier) return defaultLength;

        // Handle simple multiplier (2, 3, 4, etc.)
        const numMatch = modifier.match(/^(\d+)$/);
        if (numMatch) {
            return defaultLength * parseInt(numMatch[1], 10);
        }

        // Handle fraction (/2, /4, etc.)
        const fracMatch = modifier.match(/^\/(\d*)$/);
        if (fracMatch) {
            const divisor = fracMatch[1] ? parseInt(fracMatch[1], 10) : 2;
            return defaultLength / divisor;
        }

        // Handle full fraction (3/2, 1/4, etc.)
        const fullFracMatch = modifier.match(/^(\d+)\/(\d+)$/);
        if (fullFracMatch) {
            return (parseInt(fullFracMatch[1], 10) / parseInt(fullFracMatch[2], 10)) * defaultLength;
        }

        return defaultLength;
    }

    private parseFraction(frac: string): number {
        const match = frac.match(/(\d+)\/(\d+)/);
        if (match) {
            return parseInt(match[1], 10) / parseInt(match[2], 10);
        }
        return 1 / 8; // Default
    }

    private getMeterBeats(meter: string): number {
        const match = meter.match(/(\d+)\/(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 4; // Default
    }

    private createMeasure(number: number, startTime: number): Measure {
        return {
            number,
            startTime,
            duration: 0,
            elements: []
        };
    }
}
