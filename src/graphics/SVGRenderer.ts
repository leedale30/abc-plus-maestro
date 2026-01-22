/**
 * SVG Renderer
 * Renders Musical Object Model as SVG notation
 */

import type { MusicalObjectModel, Note, Rest, Chord, Measure } from '../types';

export class SVGRenderer {
    private container: HTMLElement | null = null;
    private svg: SVGSVGElement | null = null;
    private noteElements: Map<string, SVGElement> = new Map();

    // Layout constants
    private staffHeight = 40;
    private noteSpacing = 30;
    private measurePadding = 20;
    private lineSpacing = 8;
    private noteRadius = 5;

    render(mom: MusicalObjectModel, container: HTMLElement): void {
        this.container = container;
        this.noteElements.clear();

        // Calculate dimensions
        const totalNotes = mom.measures.reduce((sum, m) => sum + m.elements.length, 0);
        const width = Math.max(600, totalNotes * this.noteSpacing + mom.measures.length * this.measurePadding * 2);
        const height = this.staffHeight + 100;

        // Create SVG
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', 'auto');
        this.svg.style.minHeight = '200px';

        // Draw staff lines
        this.drawStaff(width);

        // Draw clef
        this.drawClef();

        // Draw measures and notes
        let xPosition = 80; // Start after clef

        for (const measure of mom.measures) {
            xPosition = this.drawMeasure(measure, xPosition);
        }

        // Replace container content
        container.innerHTML = '';
        container.appendChild(this.svg);
    }

    private drawStaff(width: number): void {
        if (!this.svg) return;

        const staffGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        staffGroup.setAttribute('class', 'staff-lines');

        const startY = 30;

        for (let i = 0; i < 5; i++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', '10');
            line.setAttribute('y1', String(startY + i * this.lineSpacing));
            line.setAttribute('x2', String(width - 10));
            line.setAttribute('y2', String(startY + i * this.lineSpacing));
            line.setAttribute('stroke', '#000000');
            line.setAttribute('stroke-width', '1');
            staffGroup.appendChild(line);
        }

        this.svg.appendChild(staffGroup);
    }

    private drawClef(): void {
        if (!this.svg) return;

        // Simplified treble clef as text
        const clef = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        clef.setAttribute('x', '20');
        clef.setAttribute('y', '58');
        clef.setAttribute('font-size', '48');
        clef.setAttribute('font-family', 'serif');
        clef.setAttribute('fill', '#000000');
        clef.textContent = '𝄞';
        this.svg.appendChild(clef);
    }

    private drawMeasure(measure: Measure, startX: number): number {
        if (!this.svg) return startX;

        let xPos = startX + this.measurePadding;

        for (const element of measure.elements) {
            if ('midiNote' in element) {
                xPos = this.drawNote(element as Note, xPos);
            } else if ('duration' in element && !('midiNote' in element)) {
                xPos = this.drawRest(element as Rest, xPos);
            }
        }

        // Draw barline
        const barline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        barline.setAttribute('x1', String(xPos + this.measurePadding / 2));
        barline.setAttribute('y1', '30');
        barline.setAttribute('x2', String(xPos + this.measurePadding / 2));
        barline.setAttribute('y2', String(30 + 4 * this.lineSpacing));
        barline.setAttribute('stroke', '#000000');
        barline.setAttribute('stroke-width', '1');

        if (measure.barlineType === 'final' || measure.barlineType === 'double') {
            barline.setAttribute('stroke-width', '2');
        }

        this.svg.appendChild(barline);

        return xPos + this.measurePadding;
    }

    private drawNote(note: Note, xPos: number): number {
        if (!this.svg) return xPos;

        const yPos = this.midiToY(note.midiNote);

        // Create note group
        const noteGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        noteGroup.setAttribute('class', 'note');
        noteGroup.setAttribute('id', note.id);
        noteGroup.setAttribute('data-midi', String(note.midiNote));

        // Note head (ellipse)
        const noteHead = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        noteHead.setAttribute('cx', String(xPos));
        noteHead.setAttribute('cy', String(yPos));
        noteHead.setAttribute('rx', String(this.noteRadius + 1));
        noteHead.setAttribute('ry', String(this.noteRadius));
        noteHead.setAttribute('fill', '#000000');
        noteHead.setAttribute('transform', `rotate(-15, ${xPos}, ${yPos})`);

        // Determine if note should be filled based on duration
        if (note.duration >= 0.5) {
            noteHead.setAttribute('fill', 'none');
            noteHead.setAttribute('stroke', '#000000');
            noteHead.setAttribute('stroke-width', '1.5');
        }

        noteGroup.appendChild(noteHead);

        // Draw stem for notes shorter than whole note
        if (note.duration < 1) {
            const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const stemDirection = yPos > 50 ? -1 : 1;
            stem.setAttribute('x1', String(xPos + (stemDirection > 0 ? -this.noteRadius : this.noteRadius)));
            stem.setAttribute('y1', String(yPos));
            stem.setAttribute('x2', String(xPos + (stemDirection > 0 ? -this.noteRadius : this.noteRadius)));
            stem.setAttribute('y2', String(yPos + stemDirection * 30));
            stem.setAttribute('stroke', '#000000');
            stem.setAttribute('stroke-width', '1.5');
            noteGroup.appendChild(stem);
        }

        // Draw ledger lines if needed
        this.drawLedgerLines(xPos, yPos, noteGroup);

        this.svg.appendChild(noteGroup);
        this.noteElements.set(note.id, noteGroup);

        return xPos + this.noteSpacing;
    }

    private drawRest(rest: Rest, xPos: number): number {
        if (!this.svg) return xPos;

        const restSymbol = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        restSymbol.setAttribute('x', String(xPos));
        restSymbol.setAttribute('y', '52');
        restSymbol.setAttribute('font-size', '20');
        restSymbol.setAttribute('fill', '#333333');
        restSymbol.setAttribute('text-anchor', 'middle');

        // Use different symbols for different rest durations
        if (rest.duration >= 1) {
            restSymbol.textContent = '𝄻'; // Whole rest
        } else if (rest.duration >= 0.5) {
            restSymbol.textContent = '𝄼'; // Half rest
        } else if (rest.duration >= 0.25) {
            restSymbol.textContent = '𝄽'; // Quarter rest
        } else {
            restSymbol.textContent = '𝄾'; // Eighth rest
        }

        this.svg.appendChild(restSymbol);
        return xPos + this.noteSpacing * (rest.duration / 0.125);
    }

    private drawLedgerLines(xPos: number, yPos: number, group: SVGElement): void {
        const topLine = 30;
        const bottomLine = 30 + 4 * this.lineSpacing;

        // Above staff
        if (yPos < topLine) {
            for (let y = topLine - this.lineSpacing; y >= yPos; y -= this.lineSpacing) {
                const ledger = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                ledger.setAttribute('x1', String(xPos - 10));
                ledger.setAttribute('y1', String(y));
                ledger.setAttribute('x2', String(xPos + 10));
                ledger.setAttribute('y2', String(y));
                ledger.setAttribute('stroke', '#000000');
                ledger.setAttribute('stroke-width', '1');
                group.appendChild(ledger);
            }
        }

        // Below staff
        if (yPos > bottomLine) {
            for (let y = bottomLine + this.lineSpacing; y <= yPos; y += this.lineSpacing) {
                const ledger = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                ledger.setAttribute('x1', String(xPos - 10));
                ledger.setAttribute('y1', String(y));
                ledger.setAttribute('x2', String(xPos + 10));
                ledger.setAttribute('y2', String(y));
                ledger.setAttribute('stroke', '#000000');
                ledger.setAttribute('stroke-width', '1');
                group.appendChild(ledger);
            }
        }
    }

    private midiToY(midiNote: number): number {
        // Map MIDI notes to staff positions
        // Middle C (60) should be on the first ledger line below the staff
        const middleC_y = 30 + 5 * this.lineSpacing; // Just below staff
        const stepsFromC = this.midiToSteps(midiNote);

        return middleC_y - (stepsFromC * this.lineSpacing / 2);
    }

    private midiToSteps(midiNote: number): number {
        // Convert MIDI note to diatonic steps from middle C
        const noteInOctave = midiNote % 12;
        const octave = Math.floor(midiNote / 12) - 5; // Octave relative to middle C

        // Map chromatic to diatonic (C=0, D=1, E=2, F=3, G=4, A=5, B=6)
        const chromaticToDiatonic = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
        const diatonicStep = chromaticToDiatonic[noteInOctave];

        return diatonicStep + octave * 7;
    }

    /**
     * Highlight a note during playback
     */
    highlightNote(noteId: string): void {
        const element = this.noteElements.get(noteId);
        if (element) {
            element.classList.add('active');
        }
    }

    /**
     * Remove highlight from a note
     */
    unhighlightNote(noteId: string): void {
        const element = this.noteElements.get(noteId);
        if (element) {
            element.classList.remove('active');
            element.classList.add('played');
        }
    }

    /**
     * Clear all highlights
     */
    clearHighlights(): void {
        for (const element of this.noteElements.values()) {
            element.classList.remove('active', 'played');
        }
    }
}
