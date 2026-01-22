/**
 * Sequencer
 * Tempo-synchronized note scheduling and playback
 */

import type { MusicalObjectModel, Note, Rest, Chord } from '../types';
import type { FMSynth } from './FMSynth';

interface ScheduledEvent {
    noteId: string;
    midiNote: number;
    velocity: number;
    startBeat: number;
    durationBeats: number;
}

export class Sequencer {
    private audioContext: AudioContext;
    private synth: FMSynth;
    private tempo: number;
    private secondsPerBeat: number;

    private scheduledEvents: ScheduledEvent[] = [];
    private currentEventIndex = 0;
    private startTime = 0;
    private pauseTime = 0;
    private isRunning = false;

    private lookahead = 25; // ms to look ahead
    private scheduleAheadTime = 0.1; // seconds to schedule ahead
    private timerID: number | null = null;

    private onNoteStart: (noteId: string) => void;
    private onNoteEnd: (noteId: string) => void;
    private onPlaybackEnd: () => void;

    constructor(
        audioContext: AudioContext,
        synth: FMSynth,
        tempo: number,
        onNoteStart: (noteId: string) => void,
        onNoteEnd: (noteId: string) => void,
        onPlaybackEnd: () => void
    ) {
        this.audioContext = audioContext;
        this.synth = synth;
        this.tempo = tempo;
        this.secondsPerBeat = 60 / tempo;
        this.onNoteStart = onNoteStart;
        this.onNoteEnd = onNoteEnd;
        this.onPlaybackEnd = onPlaybackEnd;
    }

    /**
     * Load notes from Musical Object Model
     */
    loadNotes(mom: MusicalObjectModel): void {
        this.scheduledEvents = [];

        for (const measure of mom.measures) {
            for (const element of measure.elements) {
                if ('midiNote' in element) {
                    // It's a Note
                    const note = element as Note;
                    this.scheduledEvents.push({
                        noteId: note.id,
                        midiNote: note.midiNote,
                        velocity: note.velocity,
                        startBeat: note.startTime,
                        durationBeats: note.duration
                    });
                }
                // Rests are handled implicitly by note timing
            }
        }

        // Sort by start time
        this.scheduledEvents.sort((a, b) => a.startBeat - b.startBeat);
    }

    /**
     * Start playback from beginning
     */
    start(): void {
        if (this.isRunning) return;

        this.currentEventIndex = 0;
        this.startTime = this.audioContext.currentTime;
        this.isRunning = true;

        this.scheduler();
    }

    /**
     * Resume from pause
     */
    resume(): void {
        if (this.isRunning) return;

        // Adjust start time to account for pause duration
        const pausedDuration = this.audioContext.currentTime - this.pauseTime;
        this.startTime += pausedDuration;
        this.isRunning = true;

        this.scheduler();
    }

    /**
     * Pause playback
     */
    pause(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.pauseTime = this.audioContext.currentTime;

        if (this.timerID !== null) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
    }

    /**
     * Stop and reset to beginning
     */
    stop(): void {
        this.isRunning = false;
        this.currentEventIndex = 0;

        if (this.timerID !== null) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
    }

    /**
     * Main scheduler loop
     */
    private scheduler(): void {
        if (!this.isRunning) return;

        const currentTime = this.audioContext.currentTime;
        const currentBeat = (currentTime - this.startTime) / this.secondsPerBeat;

        // Schedule notes within the lookahead window
        while (this.currentEventIndex < this.scheduledEvents.length) {
            const event = this.scheduledEvents[this.currentEventIndex];
            const eventTime = this.startTime + (event.startBeat * this.secondsPerBeat);

            // If the event is beyond the schedule window, stop scheduling
            if (eventTime > currentTime + this.scheduleAheadTime) {
                break;
            }

            // Schedule the note
            const durationSeconds = event.durationBeats * this.secondsPerBeat;
            this.synth.scheduleNote(
                event.noteId,
                event.midiNote,
                event.velocity,
                eventTime,
                durationSeconds
            );

            // Emit note start event (with visual timing)
            const delay = (eventTime - currentTime) * 1000;
            if (delay > 0) {
                setTimeout(() => this.onNoteStart(event.noteId), delay);
                setTimeout(() => this.onNoteEnd(event.noteId), delay + (durationSeconds * 1000));
            } else {
                this.onNoteStart(event.noteId);
                setTimeout(() => this.onNoteEnd(event.noteId), durationSeconds * 1000);
            }

            this.currentEventIndex++;
        }

        // Check if playback is complete
        if (this.currentEventIndex >= this.scheduledEvents.length) {
            // Wait for last notes to finish
            const lastEvent = this.scheduledEvents[this.scheduledEvents.length - 1];
            if (lastEvent) {
                const endTime = this.startTime + ((lastEvent.startBeat + lastEvent.durationBeats) * this.secondsPerBeat);
                const remainingTime = (endTime - currentTime) * 1000;

                setTimeout(() => {
                    this.isRunning = false;
                    this.onPlaybackEnd();
                }, Math.max(0, remainingTime));
            }
            return;
        }

        // Schedule next check
        this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }

    /**
     * Set tempo (BPM)
     */
    setTempo(bpm: number): void {
        this.tempo = bpm;
        this.secondsPerBeat = 60 / bpm;
    }

    /**
     * Get current playback position in beats
     */
    getCurrentBeat(): number {
        if (!this.isRunning) return 0;
        return (this.audioContext.currentTime - this.startTime) / this.secondsPerBeat;
    }
}
