/**
 * Audio File Player
 * Handles MP3, WAV, OGG playback via HTMLAudioElement
 */

type AudioPlayerCallback = () => void;
type ProgressCallback = (currentTime: number, duration: number) => void;

export class AudioFilePlayer {
    private audioElement: HTMLAudioElement | null = null;
    private isPlaying = false;
    private isPaused = false;

    private onPlayCallback: AudioPlayerCallback | null = null;
    private onPauseCallback: AudioPlayerCallback | null = null;
    private onEndCallback: AudioPlayerCallback | null = null;
    private onProgressCallback: ProgressCallback | null = null;
    private progressInterval: number | null = null;

    constructor() {
        // Will be initialized when file is loaded
    }

    async loadFile(source: File | string): Promise<void> {
        this.cleanup();
        this.audioElement = new Audio();
        
        if (source instanceof File) {
            const url = URL.createObjectURL(source);
            this.audioElement.src = url;
        } else {
            this.audioElement.src = source;
        }

        this.setupEventListeners();

        return new Promise((resolve, reject) => {
            if (!this.audioElement) {
                reject(new Error('Audio element not initialized'));
                return;
            }
            this.audioElement.addEventListener('canplaythrough', () => resolve(), { once: true });
            this.audioElement.addEventListener('error', (e) => reject(e), { once: true });
            this.audioElement.load();
        });
    }

    private setupEventListeners(): void {
        if (!this.audioElement) return;

        this.audioElement.addEventListener('play', () => {
            this.isPlaying = true;
            this.isPaused = false;
            this.startProgressTracking();
            this.onPlayCallback?.();
        });

        this.audioElement.addEventListener('pause', () => {
            this.isPlaying = false;
            this.isPaused = true;
            this.stopProgressTracking();
            this.onPauseCallback?.();
        });

        this.audioElement.addEventListener('ended', () => {
            this.isPlaying = false;
            this.isPaused = false;
            this.stopProgressTracking();
            this.onEndCallback?.();
        });
    }

    private startProgressTracking(): void {
        this.stopProgressTracking();
        this.progressInterval = window.setInterval(() => {
            if (this.audioElement && this.onProgressCallback) {
                this.onProgressCallback(this.audioElement.currentTime, this.audioElement.duration);
            }
        }, 100);
    }

    private stopProgressTracking(): void {
        if (this.progressInterval !== null) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    play(): void {
        if (this.audioElement) this.audioElement.play();
    }

    pause(): void {
        if (this.audioElement) this.audioElement.pause();
    }

    stop(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.isPlaying = false;
            this.isPaused = false;
            this.stopProgressTracking();
        }
    }

    seek(time: number): void {
        if (this.audioElement) {
            this.audioElement.currentTime = Math.max(0, Math.min(time, this.audioElement.duration));
        }
    }

    setVolume(volume: number): void {
        if (this.audioElement) {
            this.audioElement.volume = Math.max(0, Math.min(1, volume));
        }
    }

    getState(): { isPlaying: boolean; isPaused: boolean; currentTime: number; duration: number } {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentTime: this.audioElement?.currentTime ?? 0,
            duration: this.audioElement?.duration ?? 0
        };
    }

    onPlay(callback: AudioPlayerCallback): void { this.onPlayCallback = callback; }
    onPause(callback: AudioPlayerCallback): void { this.onPauseCallback = callback; }
    onEnd(callback: AudioPlayerCallback): void { this.onEndCallback = callback; }
    onProgress(callback: ProgressCallback): void { this.onProgressCallback = callback; }

    static getSupportedTypes(): string[] {
        return ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    }

    cleanup(): void {
        this.stop();
        this.stopProgressTracking();
        if (this.audioElement) {
            if (this.audioElement.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.audioElement.src);
            }
            this.audioElement = null;
        }
    }
}
