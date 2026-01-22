/**
 * ABC+ Maestro Player - Type Definitions
 * Musical Object Model (MOM) and related types
 */

// ============================================
// Player State Machine
// ============================================

export enum PlayerState {
    IDLE = 'IDLE',
    LOADING_SHARDS = 'LOADING_SHARDS',
    PRIMING = 'PRIMING',
    READY = 'READY',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED'
}

// ============================================
// ABC+ Headers & Metadata
// ============================================

export interface ABCHeaders {
    X: number;           // Reference number
    T: string;           // Title
    C?: string;          // Composer
    M: string;           // Meter (e.g., "4/4", "3/4")
    L: string;           // Default note length (e.g., "1/8")
    Q?: string;          // Tempo (e.g., "1/4=120")
    K: string;           // Key signature
    V?: VoiceDefinition[];  // Voice definitions
}

export interface VoiceDefinition {
    id: string;
    name?: string;
    shortName?: string;
    clef?: 'treble' | 'bass' | 'alto' | 'tenor';
    instrument?: string;
}

// ============================================
// Musical Object Model (MOM)
// ============================================

export interface Note {
    id: string;
    pitch: string;       // ABC pitch notation (e.g., "C", "c", "c'", "_B,")
    midiNote: number;    // MIDI note number (0-127)
    duration: number;    // Duration in beats
    startTime: number;   // Start time in beats from beginning
    velocity: number;    // 0-1 range
    voice: string;       // Voice ID
    measure: number;     // Measure number
    decorations?: Decoration[];
    tiedTo?: string;     // ID of note this is tied to
    slurStart?: boolean;
    slurEnd?: boolean;
}

export interface Rest {
    id: string;
    duration: number;
    startTime: number;
    voice: string;
    measure: number;
}

export interface Chord {
    id: string;
    notes: Note[];
    duration: number;
    startTime: number;
    voice: string;
    measure: number;
}

export interface Decoration {
    type: DecorationType;
    value?: string;
}

export type DecorationType =
    | 'fermata' | 'accent' | 'staccato' | 'tenuto'
    | 'marcato' | 'trill' | 'mordent' | 'turn'
    | 'p' | 'pp' | 'ppp' | 'mp' | 'mf' | 'f' | 'ff' | 'fff'
    | 'crescendo' | 'diminuendo'
    | 'fingering' | 'text';

export interface Measure {
    number: number;
    startTime: number;
    duration: number;
    elements: (Note | Rest | Chord)[];
    barlineType?: 'single' | 'double' | 'final' | 'repeat-start' | 'repeat-end';
}

export interface MusicalObjectModel {
    headers: ABCHeaders;
    measures: Measure[];
    totalDuration: number;  // Total duration in beats
    voices: Map<string, (Note | Rest | Chord)[]>;
}

// ============================================
// ABC+ Directives
// ============================================

export type DirectiveType =
    | 'dir' | 'fx' | 'analysis' | 'game_state'
    | 'loop' | 'art' | 'marker' | 'swing' | 'mute'
    | 'vskip' | 'sep' | 'measurenumbering' | 'frame' | 'fb';

export interface Directive {
    type: DirectiveType;
    position: number;      // Beat position in score
    measure: number;
    attributes: Record<string, string>;
}

export interface DirectivesMap {
    dir: Directive[];
    fx: Directive[];
    analysis: Directive[];
    game_state: Directive[];
    loop: Directive[];
    art: Directive[];
    marker: Directive[];
    swing: Directive[];
    mute: Directive[];
    layout: Directive[];   // vskip, sep, measurenumbering
    harmony: Directive[];  // frame, fb
}

// ============================================
// Parser Output
// ============================================

export interface ParseResult {
    mom: MusicalObjectModel;
    directives: DirectivesMap;
    errors: ParseError[];
    warnings: ParseWarning[];
}

export interface ParseError {
    line: number;
    column: number;
    message: string;
}

export interface ParseWarning {
    line: number;
    column: number;
    message: string;
}

// ============================================
// Audio Engine Types
// ============================================

export interface InstrumentShard {
    instrument: string;
    gm_id: number;
    adsr: [number, number, number, number];  // Attack, Decay, Sustain, Release
    samples: Record<string, string>;          // Pitch -> Base64 audio data
}

export interface ScheduledNote {
    note: Note;
    scheduledTime: number;  // AudioContext time
    releaseTime: number;
}

// ============================================
// Events
// ============================================

export interface NoteEvent {
    type: 'noteStart' | 'noteEnd';
    noteId: string;
    time: number;
}

export type MaestroEventType = 'noteStart' | 'noteEnd' | 'stateChange' | 'measureChange';

export interface MaestroEvent {
    type: MaestroEventType;
    data: unknown;
}

export type MaestroEventHandler = (event: MaestroEvent) => void;
