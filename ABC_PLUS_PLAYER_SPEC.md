# Specification: ABC+ Maestro Player (v1.0)

## 1. Project Overview

The **ABC+ Maestro Player** is a high-performance, lightweight musical notation and playback engine designed specifically for the **ABC+ Spec v1.2.0**. It prioritizes sub-second load times on mobile/desktop while maintaining professional-grade General MIDI (GM) audio fidelity.

---

## 2. Core Architecture

The player is built on a **Decoupled Event-Driven Architecture**, separating the visual, logical, and audio concerns.

### 2.1 The Semantic Parser (ABC+ Logic)

* **Input:** Raw ABC+ string.
* **Output:** Musical Object Model (MOM) + Directives Map.
* **Tasks:**
  * Extract standard ABC 2.1 metadata.
  * Parse `%%dir`, `%%fx`, `%%loop`, and `%%marker` directives.
  * Map durations to `AudioContext` clock pulses.

### 2.2 The Graphics Engine (Visualizer)

* **Technology:** SVG (Scalable Vector Graphics).
* **Strategy:** Vector Tiling.
* **Optimization:**
  * CSS-based highlighting (zero re-render cost).
  * Virtualization for scores longer than 16 measures.

### 2.3 The Synth Engine (Sharded Sampler)

* **Technology:** Web Audio API (`AudioContext`).
* **Logic:** Multi-tap sampler utilizing instrument-specific JSON shards.
* **Fallback:** Oscillator-based FM Synth for slow connections.

---

## 3. The "Sharded Soundfont" Specification

To avoid the standard 140MB GM download, the player uses a **Just-In-Time (JIT) Instrument Loading system**.

### 3.1 JSON Shard Structure

Each instrument (e.g., `violin.json`) should contain:

* **Metadata:** Name, GM ID, ADSR Envelope.
* **Samples:** Base64 encoded MP3/WebP chunks (approx. 3-4 samples per octave).
* **Mapping:** Pitch -> Sample + Pitch Shift ratio.

**Example Shard Config:**

```json
{
  "instrument": "violin",
  "gm_id": 41,
  "adsr": [0.02, 0.1, 0.8, 0.4],
  "samples": {
    "G2": "data:audio/mp3;base64,...",
    "D3": "data:audio/mp3;base64,...",
    "A3": "data:audio/mp3;base64,..."
  }
}
```

---

## 4. Playback Management & State Control

To ensure a premium user experience, the player follows a **"Singleton Playback Pattern"**.

### 4.1 Exclusive Playback (Single-Stream)

* **The Rule:** Only one instance of the Maestro Player can be active at any given time across the application.
* **The Implementation:** A global `AudioSessionManager` will track the current active player. If a user presses "Play" on a new score, the manager must immediately issue a `.stop()` command to the previous instance before priming the new one.

### 4.2 Lifecycle & Navigation

* **Page Departure:** The player must automatically clean up the `AudioContext` and stop all oscillators/samples if the user navigates to another page (via `useEffect` cleanup or `popstate` events).
* **Transport Controls:** Full implementation of:
  * `play()`: Starts/Resumes from current position.
  * `pause()`: Freezes the sequencer clock without resetting position.
  * `stop()`: Kills all active voices and resets the "playhead" to measure 0.

### 4.3 Tempo & BPM Precision

* **BPM Accuracy:** The sequencer must derive its heartbeat from the ABC `Q:` header or `%%tempo` directive.
* **Real-time Scaling:** If no tempo is provided, default to 120 BPM. The engine must support real-time tempo warping (%%warp) without pitch shifting.

---

## 5. Notation & Annotation Engine

Rendering accuracy is as vital as playback fidelity.

### 5.1 Full ABC+ Rendering

* **Annotations:** Must render all text-based annotations including `w:` (lyrics), `"Chord"` symbols, and `%%analysis` markers.
* **Dynamics & Articulations:** Visual rendering of `!f!`, `!p!`, `!trill!`, and staccato dots must be geometrically precise and responsive to container width.

### 5.2 Export & Portability

* **MusicXML 4.0:** Provide a `toMusicXML()` method that converts the internal Musical Object Model (MOM) into a valid `.musicxml` file for import into MuseScore/Sibelius.
* **MIDI Export:** Generate a multi-track `.mid` file on-the-fly, preserving all velocity and tempo data derived from ABC+ directives.

---

## 6. ABC+ Directive Implementation Map (v1.2.0)

The player must map the following `%%` directives to specific Web Audio node parameters:

| Directive | Attribute | Web Audio Target | Effect |
| :--- | :--- | :--- | :--- |
| `%%dir` | `intensity` | `GainNode.gain` | Scaled velocity (0.0 - 1.0) |
| `%%dir` | `mood="melancholic"` | `DynamicsCompressorNode` | Slower attack, softer knee |
| `%%fx` | `name="reverb"` | `ConvolverNode` | Dry/Wet mix of IR buffer |
| `%%fx` | `name="delay"` | `DelayNode` | Feedback loop synced to tempo |
| `%%swing` | N/A | `Scheduler` | Offsets even notes by 1/12th |

---

## 5. Performance Targets

* **Initial JS Payload:** < 150KB (Gzipped).
* **Time to First Note:** < 800ms (on 4G connection).
* **Memory Usage:** < 50MB during active 4-staff playback.
* **Concurrency:** Support for up to 16 simultaneous polyphonic voices.

---

## 6. Development Integration

* **Framework:** Framework-agnostic (Vanilla TS) with a React/Vue wrapper.
* **States:** `IDLE` -> `LOADING_SHARDS` -> `PRIMING` -> `READY` -> `PLAYING`.
* **Sync:** Emits `onNoteStart(id)` events for real-time SVG highlighting.

---

## 7. Required Assets for IGCSE

To cover 90% of Baroque/Classical content, the initial shard library must include:

1. **Harpsichord** (Quilled string samples)
2. **Violin** (Legato + Spiccato variants)
3. **Cello/Bass** (Sustained)
4. **Oboe** (Nasal characteristic)
5. **Pipe Organ** (Mixture/Plenum settings)
