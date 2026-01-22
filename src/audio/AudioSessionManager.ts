/**
 * Audio Session Manager
 * Singleton pattern for exclusive playback control
 */

import type { ParseResult, Note, Rest, ScheduledNote } from '../types';
import { FMSynth } from './FMSynth';
import { Sequencer } from './Sequencer';

type EventCallback = (data: unknown) => void;

export class AudioSessionManager {
    private static instance: AudioSessionManager | null = null;

    private audioContext: AudioContext | null = null;
    private synth: FMSynth | null = null;
    private sequencer: Sequencer | null = null;
    private parseResult: ParseResult | null = null;

    private eventListeners: Map<string, EventCallback[]> = new Map();
    private isPlaying = false;
    private isPaused = false;

    private constructor() {
        // Singleton - use getInstance()
    }

    static getInstance(): AudioSessionManager {
        if (!AudioSessionManager.instance) {
            AudioSessionManager.instance = new AudioSessionManager();
        }
        return AudioSessionManager.instance;
    }

    // ==========================================
    // Event System
    // ==========================================

    on(event: string, callback: EventCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    off(event: string, callback: EventCallback): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) listeners.splice(index, 1);
        }
    }

    private emit(event: string, data?: unknown): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(cb => cb(data));
        }
    }

    // ==========================================
    // Lifecycle
    // ==========================================

    async prime(parseResult: ParseResult): Promise<void> {
        // Stop any existing playback
        this.stop();

        // Create new audio context
        this.audioContext = new AudioContext();

        // Initialize synth
        this.synth = new FMSynth(this.audioContext);

        // Extract tempo from headers
        const tempo = this.extractTempo(parseResult.mom.headers.Q);

        // Initialize sequencer with notes
        this.sequencer = new Sequencer(
            this.audioContext,
            this.synth,
            tempo,
            (noteId) => this.emit('noteStart', noteId),
            (noteId) => this.emit('noteEnd', noteId),
            () => this.emit('playbackEnd')
        );

        // Load notes from MOM
        this.sequencer.loadNotes(parseResult.mom);

        this.parseResult = parseResult;
        this.isPlaying = false;
        this.isPaused = false;
    }

    play(): void {
        if (!this.audioContext || !this.sequencer) return;

        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        if (this.isPaused) {
            this.sequencer.resume();
        } else {
            this.sequencer.start();
        }

        this.isPlaying = true;
        this.isPaused = false;
    }

    pause(): void {
        if (!this.sequencer) return;

        this.sequencer.pause();
        this.isPlaying = false;
        this.isPaused = true;
    }

    stop(): void {
        if (this.sequencer) {
            this.sequencer.stop();
        }

        if (this.synth) {
            this.synth.stopAll();
        }

        this.isPlaying = false;
        this.isPaused = false;
    }

    cleanup(): void {
        this.stop();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.synth = null;
        this.sequencer = null;
        this.parseResult = null;
    }

    // ==========================================
    // Utilities
    // ==========================================

    private extractTempo(qHeader?: string): number {
        if (!qHeader) return 120;

        const match = qHeader.match(/(\d+)\/(\d+)=(\d+)/);
        if (match) {
            return parseInt(match[3], 10);
        }

        const simpleMatch = qHeader.match(/(\d+)/);
        if (simpleMatch) {
            return parseInt(simpleMatch[1], 10);
        }

        return 120;
    }

    getState(): { isPlaying: boolean; isPaused: boolean } {
        return { isPlaying: this.isPlaying, isPaused: this.isPaused };
    }
}
