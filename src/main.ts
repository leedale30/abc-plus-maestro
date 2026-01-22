/**
 * Universal Music Player - Main Application Entry
 */

import './style.css';
import { ABCPlusParser } from './parser/ABCPlusParser';
import { MIDIParser, type MIDINoteEvent } from './parser/MIDIParser';
import { AudioSessionManager } from './audio/AudioSessionManager';
import { AudioFilePlayer } from './audio/AudioFilePlayer';
import { SVGRenderer } from './graphics/SVGRenderer';
import { PianoKeyboard } from './graphics/PianoKeyboard';
import { PlayerState } from './types';

type InputMode = 'abc' | 'file';
type FileType = 'abc' | 'midi' | 'audio' | 'musicxml' | 'unknown';

class UniversalMusicPlayer {
    private abcParser: ABCPlusParser;
    private midiParser: MIDIParser;
    private audioManager: AudioSessionManager;
    private audioFilePlayer: AudioFilePlayer;
    private svgRenderer: SVGRenderer;
    private pianoKeyboard: PianoKeyboard;
    private state: PlayerState = PlayerState.IDLE;
    private inputMode: InputMode = 'abc';
    private loadedFile: File | null = null;
    private midiNotes: MIDINoteEvent[] = [];

    // DOM Elements
    private abcInput!: HTMLTextAreaElement;
    private playPauseBtn!: HTMLButtonElement;
    private stopBtn!: HTMLButtonElement;
    private loadExampleBtn!: HTMLButtonElement;
    private clearBtn!: HTMLButtonElement;
    private tempoDisplay!: HTMLElement;
    private stateDisplay!: HTMLElement;
    private scoreContainer!: HTMLElement;
    private playIcon!: SVGElement;
    private pauseIcon!: SVGElement;
    private tabABC!: HTMLButtonElement;
    private tabFile!: HTMLButtonElement;
    private abcPanel!: HTMLElement;
    private filePanel!: HTMLElement;
    private dropZone!: HTMLElement;
    private fileInput!: HTMLInputElement;
    private browseBtn!: HTMLButtonElement;
    private fileInfo!: HTMLElement;
    private fileName!: HTMLElement;
    private clearFileBtn!: HTMLButtonElement;

    constructor() {
        this.abcParser = new ABCPlusParser();
        this.midiParser = new MIDIParser();
        this.audioManager = AudioSessionManager.getInstance();
        this.audioFilePlayer = new AudioFilePlayer();
        this.svgRenderer = new SVGRenderer();
        this.pianoKeyboard = new PianoKeyboard({ startOctave: 3, endOctave: 5 });
        this.initializeDOM();
        this.bindEvents();
        this.updateState(PlayerState.IDLE);
    }

    private initializeDOM(): void {
        this.abcInput = document.getElementById('abcInput') as HTMLTextAreaElement;
        this.playPauseBtn = document.getElementById('playPauseBtn') as HTMLButtonElement;
        this.stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
        this.loadExampleBtn = document.getElementById('loadExample') as HTMLButtonElement;
        this.clearBtn = document.getElementById('clearEditor') as HTMLButtonElement;
        this.tempoDisplay = document.getElementById('tempoValue') as HTMLElement;
        this.stateDisplay = document.getElementById('playerState') as HTMLElement;
        this.scoreContainer = document.getElementById('scoreContainer') as HTMLElement;
        this.playIcon = document.getElementById('playIcon') as unknown as SVGElement;
        this.pauseIcon = document.getElementById('pauseIcon') as unknown as SVGElement;
        this.tabABC = document.getElementById('tabABC') as HTMLButtonElement;
        this.tabFile = document.getElementById('tabFile') as HTMLButtonElement;
        this.abcPanel = document.getElementById('abcPanel') as HTMLElement;
        this.filePanel = document.getElementById('filePanel') as HTMLElement;
        this.dropZone = document.getElementById('dropZone') as HTMLElement;
        this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
        this.browseBtn = document.getElementById('browseBtn') as HTMLButtonElement;
        this.fileInfo = document.getElementById('fileInfo') as HTMLElement;
        this.fileName = document.getElementById('fileName') as HTMLElement;
        this.clearFileBtn = document.getElementById('clearFile') as HTMLButtonElement;
    }

    private bindEvents(): void {
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.loadExampleBtn?.addEventListener('click', () => this.loadExample());
        this.clearBtn?.addEventListener('click', () => this.clearEditor());
        this.abcInput?.addEventListener('input', () => this.onInputChange());
        this.tabABC?.addEventListener('click', () => this.switchTab('abc'));
        this.tabFile?.addEventListener('click', () => this.switchTab('file'));
        this.browseBtn?.addEventListener('click', () => this.fileInput?.click());
        this.fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));
        this.clearFileBtn?.addEventListener('click', () => this.clearFile());

        this.dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); this.dropZone.classList.add('drag-over'); });
        this.dropZone?.addEventListener('dragleave', () => this.dropZone.classList.remove('drag-over'));
        this.dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            if (e.dataTransfer?.files?.length) this.loadFile(e.dataTransfer.files[0]);
        });

        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        window.addEventListener('beforeunload', () => this.cleanup());

        this.audioManager.on('noteStart', (noteId: string) => {
            this.svgRenderer.highlightNote(noteId);
            const midiNote = this.getMidiNoteFromId(noteId);
            if (midiNote !== null) this.pianoKeyboard.highlightKey(midiNote);
        });
        this.audioManager.on('noteEnd', (noteId: string) => {
            this.svgRenderer.unhighlightNote(noteId);
            const midiNote = this.getMidiNoteFromId(noteId);
            if (midiNote !== null) this.pianoKeyboard.unhighlightKey(midiNote);
        });
        this.audioManager.on('playbackEnd', () => {
            this.updateState(PlayerState.READY);
            this.pianoKeyboard.clearHighlights();
        });
        this.audioFilePlayer.onEnd(() => this.updateState(PlayerState.READY));
    }

    private switchTab(mode: InputMode): void {
        this.inputMode = mode;
        this.stop();
        if (mode === 'abc') {
            this.tabABC?.classList.add('tab-active');
            this.tabFile?.classList.remove('tab-active');
            this.abcPanel?.classList.remove('hidden');
            this.filePanel?.classList.add('hidden');
        } else {
            this.tabABC?.classList.remove('tab-active');
            this.tabFile?.classList.add('tab-active');
            this.abcPanel?.classList.add('hidden');
            this.filePanel?.classList.remove('hidden');
        }
    }

    private handleFileSelect(e: Event): void {
        const files = (e.target as HTMLInputElement).files;
        if (files?.length) this.loadFile(files[0]);
    }

    private async loadFile(file: File): Promise<void> {
        this.loadedFile = file;
        this.fileName.textContent = file.name;
        this.dropZone?.classList.add('hidden');
        this.fileInfo?.classList.remove('hidden');
        const fileType = this.detectFileType(file.name);

        try {
            this.updateState(PlayerState.LOADING_SHARDS);
            if (fileType === 'midi') await this.loadMIDI(file);
            else if (fileType === 'audio') await this.loadAudio(file);
            else if (fileType === 'abc') await this.loadABCFile(file);
            else this.updateState(PlayerState.IDLE);
        } catch (error) {
            console.error('Error loading file:', error);
            this.updateState(PlayerState.IDLE);
        }
    }

    private detectFileType(filename: string): FileType {
        const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
        if (['.mid', '.midi'].includes(ext)) return 'midi';
        if (['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext)) return 'audio';
        if (['.abc'].includes(ext)) return 'abc';
        if (['.xml', '.musicxml'].includes(ext)) return 'musicxml';
        return 'unknown';
    }

    private async loadMIDI(file: File): Promise<void> {
        this.midiNotes = await this.midiParser.parseFile(file);
        this.scoreContainer.innerHTML = '<div class="piano-container" id="pianoContainer"></div>';
        const container = document.getElementById('pianoContainer');
        if (container) this.pianoKeyboard.render(container);
        this.tempoDisplay.textContent = '120';
        this.updateState(PlayerState.READY);
    }

    private async loadAudio(file: File): Promise<void> {
        await this.audioFilePlayer.loadFile(file);
        this.scoreContainer.innerHTML = `<div class="audio-visualization"><p>${file.name}</p></div>`;
        this.tempoDisplay.textContent = '--';
        this.updateState(PlayerState.READY);
    }

    private async loadABCFile(file: File): Promise<void> {
        const text = await file.text();
        this.abcInput.value = text;
        this.switchTab('abc');
        await this.parseAndPlayABC();
    }

    private clearFile(): void {
        this.loadedFile = null;
        this.midiNotes = [];
        this.audioFilePlayer.cleanup();
        this.dropZone?.classList.remove('hidden');
        this.fileInfo?.classList.add('hidden');
        this.showScorePlaceholder();
        this.updateState(PlayerState.IDLE);
    }

    private async togglePlayPause(): Promise<void> {
        if (this.state === PlayerState.PLAYING) this.pause();
        else if (this.state === PlayerState.PAUSED || this.state === PlayerState.READY) await this.play();
        else if (this.state === PlayerState.IDLE && this.inputMode === 'abc' && this.abcInput?.value.trim()) await this.parseAndPlayABC();
    }

    private async play(): Promise<void> {
        if (this.state !== PlayerState.READY && this.state !== PlayerState.PAUSED) return;
        this.updateState(PlayerState.PLAYING);
        if (this.loadedFile) {
            const type = this.detectFileType(this.loadedFile.name);
            if (type === 'audio') this.audioFilePlayer.play();
            else if (type === 'midi') this.playMIDI();
        } else {
            this.audioManager.play();
        }
    }

    private playMIDI(): void {
        for (const note of this.midiNotes) {
            setTimeout(() => this.pianoKeyboard.highlightKey(note.midiNote), note.startTime * 1000);
            setTimeout(() => this.pianoKeyboard.unhighlightKey(note.midiNote), (note.startTime + note.duration) * 1000);
        }
    }

    private pause(): void {
        if (this.state !== PlayerState.PLAYING) return;
        this.updateState(PlayerState.PAUSED);
        if (this.loadedFile && this.detectFileType(this.loadedFile.name) === 'audio') this.audioFilePlayer.pause();
        else this.audioManager.pause();
    }

    private stop(): void {
        this.audioManager.stop();
        this.audioFilePlayer.stop();
        this.svgRenderer.clearHighlights();
        this.pianoKeyboard.clearHighlights();
        this.updateState((this.inputMode === 'abc' && this.abcInput?.value.trim()) || this.loadedFile ? PlayerState.READY : PlayerState.IDLE);
    }

    private async parseAndPlayABC(): Promise<void> {
        const content = this.abcInput?.value.trim();
        if (!content) return;
        try {
            this.updateState(PlayerState.LOADING_SHARDS);
            const result = this.abcParser.parse(content);
            if (result.errors.length) { this.updateState(PlayerState.IDLE); return; }
            this.tempoDisplay.textContent = this.extractTempo(result.mom.headers.Q).toString();
            this.svgRenderer.render(result.mom, this.scoreContainer);
            await this.audioManager.prime(result);
            this.updateState(PlayerState.READY);
            await this.play();
        } catch { this.updateState(PlayerState.IDLE); }
    }

    private loadExample(): void {
        if (this.abcInput) this.abcInput.value = `X:1\nT:Demo\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\n|: C2 E2 G2 c2 | B2 d2 g2 f2 :|`;
        this.onInputChange();
    }

    private clearEditor(): void {
        this.stop();
        if (this.abcInput) this.abcInput.value = '';
        this.showScorePlaceholder();
        this.updateState(PlayerState.IDLE);
    }

    private showScorePlaceholder(): void {
        this.scoreContainer.innerHTML = '<div class="score-placeholder"><p>Enter ABC+ or upload a file</p></div>';
    }

    private onInputChange(): void {
        if (this.state !== PlayerState.IDLE) { this.stop(); this.updateState(PlayerState.IDLE); }
    }

    private getMidiNoteFromId(id: string): number | null {
        if (!id.startsWith('midi_')) return null;
        const note = this.midiNotes[parseInt(id.replace('midi_', ''), 10)];
        return note ? note.midiNote : null;
    }

    private handleKeyboard(e: KeyboardEvent): void {
        if (e.target === this.abcInput) return;
        if (e.key === ' ') { e.preventDefault(); this.togglePlayPause(); }
        if (e.key === 'Escape') this.stop();
    }

    private updateState(state: PlayerState): void {
        this.state = state;
        if (this.stateDisplay) { this.stateDisplay.textContent = state; this.stateDisplay.setAttribute('data-state', state); }
        if (this.playIcon) this.playIcon.style.display = state === PlayerState.PLAYING ? 'none' : 'block';
        if (this.pauseIcon) this.pauseIcon.style.display = state === PlayerState.PLAYING ? 'block' : 'none';
    }

    private extractTempo(q?: string): number {
        if (!q) return 120;
        const m = q.match(/(\d+)\/(\d+)=(\d+)/);
        return m ? parseInt(m[3]) : 120;
    }

    private cleanup(): void { this.audioManager.cleanup(); this.audioFilePlayer.cleanup(); }
}

document.addEventListener('DOMContentLoaded', () => new UniversalMusicPlayer());
