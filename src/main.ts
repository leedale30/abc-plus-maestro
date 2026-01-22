/**
 * ABC+ Maestro Player - Main Application Entry
 */

import './style.css';
import { ABCPlusParser } from './parser/ABCPlusParser';
import { AudioSessionManager } from './audio/AudioSessionManager';
import { SVGRenderer } from './graphics/SVGRenderer';
import { PlayerState } from './types';

class MaestroPlayer {
    private parser: ABCPlusParser;
    private audioManager: AudioSessionManager;
    private renderer: SVGRenderer;
    private state: PlayerState = PlayerState.IDLE;

    // DOM Elements
    private abcInput: HTMLTextAreaElement;
    private playPauseBtn: HTMLButtonElement;
    private stopBtn: HTMLButtonElement;
    private loadExampleBtn: HTMLButtonElement;
    private clearBtn: HTMLButtonElement;
    private tempoDisplay: HTMLElement;
    private stateDisplay: HTMLElement;
    private scoreContainer: HTMLElement;
    private playIcon: SVGElement;
    private pauseIcon: SVGElement;

    constructor() {
        this.parser = new ABCPlusParser();
        this.audioManager = AudioSessionManager.getInstance();
        this.renderer = new SVGRenderer();

        // Initialize DOM references
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

        this.bindEvents();
        this.updateState(PlayerState.IDLE);
    }

    private bindEvents(): void {
        // Transport controls
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.stopBtn.addEventListener('click', () => this.stop());

        // Editor actions
        this.loadExampleBtn.addEventListener('click', () => this.loadExample());
        this.clearBtn.addEventListener('click', () => this.clearEditor());

        // ABC input changes
        this.abcInput.addEventListener('input', () => this.onInputChange());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => this.cleanup());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === PlayerState.PLAYING) {
                this.pause();
            }
        });

        // Audio manager events
        this.audioManager.on('noteStart', (noteId: string) => {
            this.renderer.highlightNote(noteId);
        });

        this.audioManager.on('noteEnd', (noteId: string) => {
            this.renderer.unhighlightNote(noteId);
        });

        this.audioManager.on('playbackEnd', () => {
            this.updateState(PlayerState.READY);
        });
    }

    private handleKeyboard(e: KeyboardEvent): void {
        // Ignore if typing in textarea
        if (e.target === this.abcInput) return;

        switch (e.key) {
            case ' ':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'Escape':
                this.stop();
                break;
        }
    }

    private async togglePlayPause(): Promise<void> {
        if (this.state === PlayerState.PLAYING) {
            this.pause();
        } else if (this.state === PlayerState.PAUSED || this.state === PlayerState.READY) {
            await this.play();
        } else if (this.state === PlayerState.IDLE && this.abcInput.value.trim()) {
            await this.parseAndPlay();
        }
    }

    private async parseAndPlay(): Promise<void> {
        const abcContent = this.abcInput.value.trim();
        if (!abcContent) return;

        try {
            this.updateState(PlayerState.LOADING_SHARDS);

            // Parse ABC+ notation
            const parseResult = this.parser.parse(abcContent);

            if (parseResult.errors.length > 0) {
                console.error('Parse errors:', parseResult.errors);
                this.updateState(PlayerState.IDLE);
                return;
            }

            // Update tempo display
            const tempo = this.extractTempo(parseResult.mom.headers.Q);
            this.tempoDisplay.textContent = tempo.toString();

            // Render score
            this.updateState(PlayerState.PRIMING);
            this.renderer.render(parseResult.mom, this.scoreContainer);

            // Prime audio engine
            await this.audioManager.prime(parseResult);

            this.updateState(PlayerState.READY);

            // Auto-play after parsing
            await this.play();
        } catch (error) {
            console.error('Error parsing ABC+:', error);
            this.updateState(PlayerState.IDLE);
        }
    }

    private async play(): Promise<void> {
        if (this.state === PlayerState.IDLE && this.abcInput.value.trim()) {
            await this.parseAndPlay();
            return;
        }

        if (this.state !== PlayerState.READY && this.state !== PlayerState.PAUSED) {
            return;
        }

        this.updateState(PlayerState.PLAYING);
        this.audioManager.play();
    }

    private pause(): void {
        if (this.state !== PlayerState.PLAYING) return;

        this.updateState(PlayerState.PAUSED);
        this.audioManager.pause();
    }

    private stop(): void {
        this.audioManager.stop();
        this.renderer.clearHighlights();

        if (this.abcInput.value.trim()) {
            this.updateState(PlayerState.READY);
        } else {
            this.updateState(PlayerState.IDLE);
        }
    }

    private loadExample(): void {
        const exampleABC = `X:1
T:ABC+ Maestro Demo
C:Sample Composer
M:4/4
L:1/8
Q:1/4=120
K:C
%%dir mood="bright" intensity="0.8"
|: "C"C2 E2 G2 c2 | "G"B2 d2 g2 f2 | "Am"e2 c2 A2 E2 | "F"F2 A2 c2 f2 :|
|: "Dm"d2 f2 a2 d'2 | "G7"g2 b2 d'2 f2 | "C"e2 g2 c'2 e2 | "C"c4 z4 :|
w: This is a sim-ple de-mo tune to show the play-er`;

        this.abcInput.value = exampleABC;
        this.onInputChange();
    }

    private clearEditor(): void {
        this.stop();
        this.abcInput.value = '';
        this.scoreContainer.innerHTML = `
      <div class="score-placeholder">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
        <p>Enter ABC+ notation to see the score</p>
      </div>
    `;
        this.updateState(PlayerState.IDLE);
    }

    private onInputChange(): void {
        // Reset state when input changes
        if (this.state !== PlayerState.IDLE) {
            this.stop();
            this.updateState(PlayerState.IDLE);
        }
    }

    private updateState(newState: PlayerState): void {
        this.state = newState;
        this.stateDisplay.textContent = newState;
        this.stateDisplay.setAttribute('data-state', newState);

        // Update play/pause button icons
        if (newState === PlayerState.PLAYING) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
        }

        console.log(`[MaestroPlayer] State: ${newState}`);
    }

    private extractTempo(qHeader?: string): number {
        if (!qHeader) return 120;

        // Parse Q: header format like "1/4=120"
        const match = qHeader.match(/(\d+)\/(\d+)=(\d+)/);
        if (match) {
            return parseInt(match[3], 10);
        }

        // Simple number format
        const simpleMatch = qHeader.match(/(\d+)/);
        if (simpleMatch) {
            return parseInt(simpleMatch[1], 10);
        }

        return 120;
    }

    private cleanup(): void {
        this.audioManager.cleanup();
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    new MaestroPlayer();
});
