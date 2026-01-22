/**
 * FM Synthesizer
 * Oscillator-based audio synthesis with ADSR envelope
 */

interface ActiveVoice {
    oscillator: OscillatorNode;
    modulator: OscillatorNode;
    envelope: GainNode;
    noteId: string;
}

export class FMSynth {
    private audioContext: AudioContext;
    private masterGain: GainNode;
    private activeVoices: Map<string, ActiveVoice> = new Map();
    private maxPolyphony = 16;

    // ADSR envelope (in seconds)
    private attack = 0.02;
    private decay = 0.1;
    private sustain = 0.7;
    private release = 0.3;

    // FM synthesis parameters
    private modulationIndex = 2.5;
    private modulationRatio = 2;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;

        // Master gain for overall volume
        this.masterGain = audioContext.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(audioContext.destination);
    }

    /**
     * Convert MIDI note number to frequency
     */
    private midiToFrequency(midiNote: number): number {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    /**
     * Start a note
     */
    noteOn(noteId: string, midiNote: number, velocity: number, time?: number): void {
        // Enforce polyphony limit
        if (this.activeVoices.size >= this.maxPolyphony) {
            // Stop oldest voice
            const oldestKey = this.activeVoices.keys().next().value;
            if (oldestKey) this.noteOff(oldestKey);
        }

        const now = time ?? this.audioContext.currentTime;
        const frequency = this.midiToFrequency(midiNote);

        // Create modulator oscillator (for FM)
        const modulator = this.audioContext.createOscillator();
        modulator.type = 'sine';
        modulator.frequency.value = frequency * this.modulationRatio;

        const modulatorGain = this.audioContext.createGain();
        modulatorGain.gain.value = frequency * this.modulationIndex;
        modulator.connect(modulatorGain);

        // Create carrier oscillator
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;

        // Connect modulator to carrier frequency
        modulatorGain.connect(oscillator.frequency);

        // Create envelope
        const envelope = this.audioContext.createGain();
        envelope.gain.value = 0;

        oscillator.connect(envelope);
        envelope.connect(this.masterGain);

        // Apply ADSR envelope
        const peakLevel = velocity * 0.8;
        const sustainLevel = peakLevel * this.sustain;

        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(peakLevel, now + this.attack);
        envelope.gain.linearRampToValueAtTime(sustainLevel, now + this.attack + this.decay);

        // Start oscillators
        modulator.start(now);
        oscillator.start(now);

        this.activeVoices.set(noteId, {
            oscillator,
            modulator,
            envelope,
            noteId
        });
    }

    /**
     * Stop a note with release envelope
     */
    noteOff(noteId: string, time?: number): void {
        const voice = this.activeVoices.get(noteId);
        if (!voice) return;

        const now = time ?? this.audioContext.currentTime;

        // Apply release
        voice.envelope.gain.cancelScheduledValues(now);
        voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, now);
        voice.envelope.gain.linearRampToValueAtTime(0, now + this.release);

        // Stop and cleanup after release
        const stopTime = now + this.release + 0.1;
        voice.oscillator.stop(stopTime);
        voice.modulator.stop(stopTime);

        // Schedule removal
        setTimeout(() => {
            this.activeVoices.delete(noteId);
        }, (this.release + 0.1) * 1000);
    }

    /**
     * Schedule a note with specific start and end times
     */
    scheduleNote(noteId: string, midiNote: number, velocity: number, startTime: number, duration: number): void {
        this.noteOn(noteId, midiNote, velocity, startTime);

        // Schedule note off
        const releaseTime = startTime + duration - 0.05; // Slight overlap for smoother sound
        setTimeout(() => {
            this.noteOff(noteId, releaseTime);
        }, (releaseTime - this.audioContext.currentTime) * 1000);
    }

    /**
     * Stop all active voices immediately
     */
    stopAll(): void {
        const now = this.audioContext.currentTime;

        for (const [noteId, voice] of this.activeVoices) {
            voice.envelope.gain.cancelScheduledValues(now);
            voice.envelope.gain.setValueAtTime(0, now);
            voice.oscillator.stop(now + 0.01);
            voice.modulator.stop(now + 0.01);
        }

        this.activeVoices.clear();
    }

    /**
     * Set ADSR envelope parameters
     */
    setADSR(attack: number, decay: number, sustain: number, release: number): void {
        this.attack = attack;
        this.decay = decay;
        this.sustain = sustain;
        this.release = release;
    }

    /**
     * Set master volume (0-1)
     */
    setVolume(volume: number): void {
        this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
}
