# TYPE//TANK 🪖🕹️

> An authentic retro arcade DOS military terminal typing defense game built using **HTML5 Canvas**, **CSS**, and **Vanilla JavaScript**. Zero external libraries, zero backend, and 100% procedural sound effects synthesized via the **Web Audio API**.

---

## ⚡ Features

- **Retro DOS / Arcade Aesthetics**: Deep black/dark-green background (`#020402`), phosphor scanlines, CRT cathode bloom & vignette with real-time `[CRT: ON/OFF]` toggle.
- **Dynamic Arcade Cabinet Aspect Ratio**:
  - `AUTO [SCREEN FIT]`: Fluidly scales to fill any screen or window dimension.
  - `16:9 [WIDESCREEN]`: Authentic arcade widescreen cabinet with side bezels.
  - `4:3 [CLASSIC CRT]`: Vintage arcade cabinet pillarboxing.
- **180° Ballistic Turret & Physics**:
  - Semicircular dome turret with armor plating and active cannon barrel.
  - Recoil pushback animation and muzzle flash spark bursts.
  - Ballistic tracer rounds fire directly at the targeted character on every keystroke.
  - Typed letters immediately drop to ~35% opacity with an active glowing cursor under the current letter.
- **Lowest-First Priority Target Lock**:
  - Automatically targets the lowest / closest threat when multiple words begin with the same character.
  - Stays locked onto the target until neutralized or breached.
- **Red Bonus Threats**:
  - Descend faster with a crimson glow and grant 3.5× score multipliers.
  - Suppresses duplicate starting letters while active, followed by a 3-second exclusion cooldown window.
- **4 Distinct Combat Arsenal Modes**:
  - **Mode 1 [Alpha]**: Lowercase tactical terms (`radar`, `tank`, `artillery`).
  - **Mode 2 [Bravo]**: Mixed case callsigns and designations (`Viper`, `DeltaForce`).
  - **Mode 3 [Charlie]**: Mixed case + numbers (`Squad5`, `Tank99`, `F16Raptor`).
  - **Mode 4 [Delta]**: Mixed case + numbers + special characters (`[tank-01]`, `(8+9)`, `!alert!`).
- **Native Web Audio API Procedural Synthesis**:
  - High-frequency laser fire chirps
  - Heavy metallic elimination thumps & explosions
  - Dual-tone red bonus threat alarms
  - Low crunch hull damage buzzes
  - Ascending 8-bit victory fanfare
  - Tactile UI terminal clicks
- **Debrief & Operator Flight Logs**:
  - Sortie debrief metrics: Final Score, WPM, Combat Accuracy, Max Combo, Threats Destroyed.
  - Personal best tracking with arcade fanfare and confetti celebration on new records.
  - Persistent flight logs saved to `localStorage` with mode filters and log purge controls.

---

## 🕹️ Controls

| Key / Action | Function |
| :--- | :--- |
| **`ENTER` / `SPACEBAR`** | Confirm Callsign, advance screens, engage combat, or play again |
| **Character Keys** | Fire cannon at matching threats |
| **`ESC`** | Abort combat sortie or return to previous menu |
| **`R`** | Open Flight Logs from Sortie Debrief screen |
| **`S`** | Open Arsenal Settings from Sortie Debrief screen |
| **`[CRT]` Button** | Toggle CRT scanlines and phosphor glow |
| **`[SND]` Button** | Toggle Web Audio sound effects mute |
| **`[ASPECT]` Button** | Cycle through AUTO, 16:9, and 4:3 monitor modes |

---

## 🚀 Getting Started

No build tools, npm packages, or dependencies required!

### Option 1: Open Directly
Double-click `index.html` to open it in your browser.

### Option 2: Run Local Server
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000`.

---

## 📂 Project Structure

```
├── index.html        # Semantic layout, cabinet frame, CRT overlays, HUD & terminal screens
├── style.css         # Dark DOS terminal theme, CRT scanlines, 100% viewport fit
├── js/
│   ├── words.js      # Lexicons for Modes 1-4, threat exclusion & cooldown manager
│   ├── audio.js      # Web Audio API procedural sound synthesizer
│   ├── storage.js    # LocalStorage engine for callsign, settings, PBs, and flight logs
│   ├── game.js       # 60 FPS Canvas 2D engine, turret mechanics, ballistic physics
│   └── app.js        # State machine, keyboard dispatcher, debrief & confetti
└── README.md
```

---

## 📜 License
MIT License.
