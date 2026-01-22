/**
 * MusicXML Parser
 * Parses MusicXML files into Musical Object Model (MOM)
 */

import type {
    ParseResult,
    MusicalObjectModel,
    ABCHeaders,
    DirectivesMap,
    Note,
    Rest,
    Measure
} from '../types';

export class MusicXMLParser {
    private divisions = 1;
    private currentTempo = 120;

    async parseFile(file: File): Promise<ParseResult> {
        const text = await file.text();
        return this.parse(text);
    }

    parse(xmlContent: string): ParseResult {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'application/xml');

        const parseError = doc.querySelector('parsererror');
        if (parseError) return this.errorResult(`XML parse error: ${parseError.textContent}`);

        const scorePartwise = doc.querySelector('score-partwise');
        const scoreTimewise = doc.querySelector('score-timewise');
        if (!scorePartwise && !scoreTimewise) return this.errorResult('Invalid MusicXML');

        const root = scorePartwise || scoreTimewise!;

        try {
            const headers = this.parseHeaders(root);
            const measures = this.parseMeasures(root);
            const totalDuration = measures.reduce((sum, m) => sum + m.duration, 0);

            return {
                mom: { headers, measures, totalDuration, voices: new Map() },
                directives: this.emptyDirectives(),
                errors: [],
                warnings: []
            };
        } catch (error) {
            return this.errorResult(`Parse error: ${error}`);
        }
    }

    private parseHeaders(root: Element): ABCHeaders {
        const headers: ABCHeaders = { X: 1, T: 'Untitled', M: '4/4', L: '1/8', K: 'C' };

        const workTitle = root.querySelector('work-title');
        const movementTitle = root.querySelector('movement-title');
        headers.T = workTitle?.textContent || movementTitle?.textContent || 'Untitled';

        const creator = root.querySelector('creator[type="composer"]');
        if (creator?.textContent) headers.C = creator.textContent;

        const time = root.querySelector('time');
        if (time) {
            const beats = time.querySelector('beats')?.textContent || '4';
            const beatType = time.querySelector('beat-type')?.textContent || '4';
            headers.M = `${beats}/${beatType}`;
        }

        const key = root.querySelector('key');
        if (key) {
            const fifths = parseInt(key.querySelector('fifths')?.textContent || '0', 10);
            const mode = key.querySelector('mode')?.textContent || 'major';
            headers.K = this.fifthsToKey(fifths, mode);
        }

        const tempo = root.querySelector('sound[tempo]');
        if (tempo) {
            this.currentTempo = parseFloat(tempo.getAttribute('tempo') || '120');
            headers.Q = `1/4=${this.currentTempo}`;
        }

        const divisions = root.querySelector('divisions');
        if (divisions?.textContent) this.divisions = parseInt(divisions.textContent, 10);

        return headers;
    }

    private parseMeasures(root: Element): Measure[] {
        const measures: Measure[] = [];
        const measureElements = root.querySelectorAll('measure');
        let currentTime = 0;
        let noteIdCounter = 0;

        measureElements.forEach((measureEl, index) => {
            const measure: Measure = { number: index + 1, startTime: currentTime, duration: 0, elements: [] };
            let measureDuration = 0;

            const noteElements = measureEl.querySelectorAll('note');
            noteElements.forEach((noteEl) => {
                const isRest = noteEl.querySelector('rest') !== null;
                const isChord = noteEl.querySelector('chord') !== null;
                const durationEl = noteEl.querySelector('duration');
                const duration = durationEl ? parseInt(durationEl.textContent || '0', 10) / this.divisions : 0.25;

                if (isRest) {
                    measure.elements.push({
                        id: `rest_${noteIdCounter++}`,
                        duration,
                        startTime: currentTime + measureDuration,
                        measure: measure.number,
                        voice: '1'
                    } as Rest);
                } else {
                    const pitch = noteEl.querySelector('pitch');
                    if (pitch) {
                        const step = pitch.querySelector('step')?.textContent || 'C';
                        const octave = parseInt(pitch.querySelector('octave')?.textContent || '4', 10);
                        const alter = parseInt(pitch.querySelector('alter')?.textContent || '0', 10);
                        const midiNote = this.pitchToMidi(step, octave, alter);
                        const dynamics = noteEl.querySelector('dynamics');
                        const velocity = dynamics ? this.dynamicsToVelocity(dynamics) : 0.8;

                        measure.elements.push({
                            id: `note_${noteIdCounter++}`,
                            pitch: `${step}${alter > 0 ? '#' : alter < 0 ? 'b' : ''}${octave}`,
                            midiNote,
                            duration,
                            startTime: isChord ? currentTime + measureDuration - duration : currentTime + measureDuration,
                            velocity,
                            measure: measure.number,
                            voice: '1'
                        } as Note);
                    }
                }
                if (!isChord) measureDuration += duration;
            });

            measure.duration = measureDuration;
            currentTime += measureDuration;
            measures.push(measure);
        });

        return measures;
    }

    private pitchToMidi(step: string, octave: number, alter: number): number {
        const stepMap: Record<string, number> = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        return (octave + 1) * 12 + (stepMap[step.toUpperCase()] || 0) + alter;
    }

    private fifthsToKey(fifths: number, mode: string): string {
        const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
        const majorFlats = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
        const minorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];
        const minorFlats = ['Am', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];

        if (mode === 'minor') {
            return fifths >= 0 ? minorKeys[Math.min(fifths, 7)] : minorFlats[Math.min(-fifths, 7)];
        }
        return fifths >= 0 ? majorKeys[Math.min(fifths, 7)] : majorFlats[Math.min(-fifths, 7)];
    }

    private dynamicsToVelocity(dynamics: Element): number {
        const marks = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'];
        const velocities = [0.2, 0.3, 0.4, 0.55, 0.7, 0.85, 0.95, 1.0];
        for (let i = 0; i < marks.length; i++) {
            if (dynamics.querySelector(marks[i])) return velocities[i];
        }
        return 0.8;
    }

    private errorResult(message: string): ParseResult {
        return {
            mom: { headers: { X: 1, T: '', M: '4/4', L: '1/8', K: 'C' }, measures: [], totalDuration: 0, voices: new Map() },
            directives: this.emptyDirectives(),
            errors: [{ message, line: 0, column: 0 }],
            warnings: []
        };
    }

    private emptyDirectives(): DirectivesMap {
        return { dir: [], fx: [], analysis: [], game_state: [], loop: [], art: [], marker: [], swing: [], mute: [], layout: [], harmony: [] };
    }
}
