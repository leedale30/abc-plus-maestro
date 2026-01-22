/**
 * MIDI File Parser
 * Parses .mid files and extracts note events for playback
 */

export interface MIDINoteEvent {
    noteId: string;
    midiNote: number;
    velocity: number;
    startTime: number;
    duration: number;
    channel: number;
}

export class MIDIParser {
    private data: DataView | null = null;
    private position = 0;

    async parseFile(file: File): Promise<MIDINoteEvent[]> {
        const arrayBuffer = await file.arrayBuffer();
        return this.parse(arrayBuffer);
    }

    parse(arrayBuffer: ArrayBuffer): MIDINoteEvent[] {
        this.data = new DataView(arrayBuffer);
        this.position = 0;

        const header = this.parseHeader();
        if (!header) throw new Error('Invalid MIDI file');

        const { numTracks, ticksPerBeat } = header;
        const tracks: { events: any[] }[] = [];
        const tempoEvents: { time: number; tempo: number }[] = [];

        for (let i = 0; i < numTracks; i++) {
            const track = this.parseTrack();
            if (track) {
                tracks.push(track);
                for (const event of track.events) {
                    if (event.type === 'tempo' && event.tempo) {
                        tempoEvents.push({ time: event.time, tempo: event.tempo });
                    }
                }
            }
        }

        if (tempoEvents.length === 0) {
            tempoEvents.push({ time: 0, tempo: 500000 });
        }

        return this.eventsToNotes(tracks, ticksPerBeat, tempoEvents);
    }

    private parseHeader(): { format: number; numTracks: number; ticksPerBeat: number } | null {
        if (!this.data) return null;
        const chunk = this.readString(4);
        if (chunk !== 'MThd') return null;
        const length = this.readUint32();
        if (length !== 6) return null;
        const format = this.readUint16();
        const numTracks = this.readUint16();
        const division = this.readUint16();
        return { format, numTracks, ticksPerBeat: division & 0x7FFF };
    }

    private parseTrack(): { events: any[] } | null {
        if (!this.data) return null;
        const chunk = this.readString(4);
        if (chunk !== 'MTrk') return null;
        const length = this.readUint32();
        const endPosition = this.position + length;
        const events: any[] = [];
        let absoluteTime = 0;
        let runningStatus = 0;

        while (this.position < endPosition) {
            const deltaTime = this.readVariableLength();
            absoluteTime += deltaTime;
            let status = this.readUint8();

            if (status < 0x80) {
                this.position--;
                status = runningStatus;
            } else {
                runningStatus = status;
            }

            const type = status & 0xF0;
            const channel = status & 0x0F;

            if (type === 0x90) {
                const note = this.readUint8();
                const velocity = this.readUint8();
                events.push({ type: velocity > 0 ? 'noteOn' : 'noteOff', channel, note, velocity: velocity / 127, time: absoluteTime });
            } else if (type === 0x80) {
                const note = this.readUint8();
                this.readUint8();
                events.push({ type: 'noteOff', channel, note, time: absoluteTime });
            } else if (type === 0xA0 || type === 0xB0 || type === 0xE0) {
                this.readUint8(); this.readUint8();
            } else if (type === 0xC0 || type === 0xD0) {
                this.readUint8();
            } else if (status === 0xFF) {
                const metaType = this.readUint8();
                const metaLength = this.readVariableLength();
                if (metaType === 0x51 && metaLength === 3) {
                    const tempo = (this.readUint8() << 16) | (this.readUint8() << 8) | this.readUint8();
                    events.push({ type: 'tempo', channel: 0, tempo, time: absoluteTime });
                } else {
                    this.position += metaLength;
                }
            } else if (status === 0xF0 || status === 0xF7) {
                const sysexLength = this.readVariableLength();
                this.position += sysexLength;
            }
        }

        return { events };
    }

    private eventsToNotes(tracks: { events: any[] }[], ticksPerBeat: number, tempoEvents: { time: number; tempo: number }[]): MIDINoteEvent[] {
        const notes: MIDINoteEvent[] = [];
        let noteIdCounter = 0;
        tempoEvents.sort((a, b) => a.time - b.time);

        const ticksToSeconds = (ticks: number): number => {
            let seconds = 0;
            let currentTempo = tempoEvents[0]?.tempo ?? 500000;
            let lastTempoTick = 0;
            for (const te of tempoEvents) {
                if (te.time >= ticks) break;
                seconds += ((te.time - lastTempoTick) / ticksPerBeat) * (currentTempo / 1000000);
                currentTempo = te.tempo;
                lastTempoTick = te.time;
            }
            seconds += ((ticks - lastTempoTick) / ticksPerBeat) * (currentTempo / 1000000);
            return seconds;
        };

        for (const track of tracks) {
            const activeNotes: Map<string, any> = new Map();
            for (const event of track.events) {
                if (event.type === 'noteOn' && event.note !== undefined) {
                    activeNotes.set(`${event.channel}_${event.note}`, event);
                } else if (event.type === 'noteOff' && event.note !== undefined) {
                    const noteOn = activeNotes.get(`${event.channel}_${event.note}`);
                    if (noteOn) {
                        notes.push({
                            noteId: `midi_${noteIdCounter++}`,
                            midiNote: event.note,
                            velocity: noteOn.velocity ?? 0.8,
                            startTime: ticksToSeconds(noteOn.time),
                            duration: ticksToSeconds(event.time) - ticksToSeconds(noteOn.time),
                            channel: event.channel
                        });
                        activeNotes.delete(`${event.channel}_${event.note}`);
                    }
                }
            }
        }

        return notes.sort((a, b) => a.startTime - b.startTime);
    }

    private readUint8(): number {
        if (!this.data) return 0;
        return this.data.getUint8(this.position++);
    }

    private readUint16(): number {
        if (!this.data) return 0;
        const value = this.data.getUint16(this.position);
        this.position += 2;
        return value;
    }

    private readUint32(): number {
        if (!this.data) return 0;
        const value = this.data.getUint32(this.position);
        this.position += 4;
        return value;
    }

    private readString(length: number): string {
        if (!this.data) return '';
        let str = '';
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(this.data.getUint8(this.position + i));
        }
        this.position += length;
        return str;
    }

    private readVariableLength(): number {
        if (!this.data) return 0;
        let value = 0;
        let byte: number;
        do {
            byte = this.readUint8();
            value = (value << 7) | (byte & 0x7F);
        } while (byte & 0x80);
        return value;
    }
}
