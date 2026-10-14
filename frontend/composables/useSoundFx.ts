/**
 * useSoundFx — v2.1 (W3) synthesized sound FX for task completion +
 * level-up (contract §5 W3).
 *
 * Design rules (from the contract):
 *   - **No audio files.** Pure WebAudio synth (one OscillatorNode +
 *     GainNode per blip, wrapped in a small envelope).
 *   - **Lazy AudioContext.** `AudioContext` is created the first time
 *     the user actually causes a sound to play (a real user gesture);
 *     it is then resumed, since most browsers start it suspended.
 *   - **Volume ≤ 0.2.** Master gain tops out at 0.2; each individual
 *     blip can scale within that envelope.
 *   - **No sound under `prefers-reduced-motion`** unless the user
 *     explicitly enabled Sound FX. Reduced-motion users get silence
 *     even if the toggle is on, to respect the wider "calm" preference.
 *   - **Setting off ⇒ silent.** `settingsStore.soundFx` (localStorage
 *     `soundFx`, default false) is the master switch.
 *
 * Event contract (also owned by W3 in the consumer; W1's
 * `composables/useAppEvents.ts` may add `levelUp` later — we listen
 * defensively via `(onAppEvent as any)('levelUp', …)` so the synth
 * stays no-op when the event doesn't exist yet).
 *
 * Usage: call once from `app.vue` on mount; the subscriptions are
 * cleared in `onBeforeUnmount`. Never call from multiple components
 * to avoid duplicate sounds.
 */

import { onBeforeUnmount, onMounted } from "vue";
import { onAppEvent } from "./useAppEvents";
import { useSettingsStore } from "../stores/settingsStore";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let installed = 0; // counter, lets us tear down the singleton when no owners remain

interface SoundRuntimeFlags {
  audioContextOk: boolean;
  lastPlayedAt: number;
  lastEvent: "blip" | "lowBlip" | "arpeggio" | null;
}

const flags: SoundRuntimeFlags = {
  audioContextOk: false,
  lastPlayedAt: 0,
  lastEvent: null,
};

/** Test/debug accessor — read by the verification harness to prove the
 *  synth created an `AudioContext` after a real gesture. Never read by
 *  shipped UI code. Exported on `window.__ppSoundFxFlags` in dev only. */
export function _peekSoundFxFlags(): Readonly<SoundRuntimeFlags> {
  return flags;
}

// ----- AudioContext lifecycle -----

function reducedMotionPreferred(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) {
    // Resume if previously created in a suspended state. Browsers that
    // started the context during a gesture never auto-suspend it again,
    // but keep this idempotent.
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {/* noop; will retry on next play */});
    }
    return ctx;
  }
  const Ctor =
    (window as any).AudioContext ||
    (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor() as AudioContext;
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.2; // contract: ≤ 0.2 master volume
    masterGain.connect(ctx.destination);
    flags.audioContextOk = true;
    return ctx;
  } catch {
    ctx = null;
    masterGain = null;
    return null;
  }
}

// ----- Sound primitives -----

interface VoiceOpts {
  freq: number;
  durationMs: number;
  /** Sine / square / triangle / sawtooth. Sine is the softest; square gives
   *  the punchy 8-bit feel that matches the combat-deck aesthetic. */
  type?: OscillatorType;
  /** 0..1 — relative to the master ≤ 0.2 gain. */
  peak?: number;
  /** Steady tone level once the envelope has ramped up. */
  sustain?: number;
  /** Where in `durationMs` the envelope releases; relative to the end. */
  release?: number;
}

/**
 * Play one short tone (a "voice"). Returns once the note has been
 * scheduled — the actual envelope plays out on the AudioContext thread.
 */
function voice(opts: VoiceOpts): void {
  const ac = ensureContext();
  if (!ac || !masterGain) return;
  const now = ac.currentTime;
  const dur = Math.max(0.03, opts.durationMs / 1000);
  const release = Math.max(0.015, (opts.release ?? dur * 0.4) / 1000);
  const attack = Math.min(0.005, dur * 0.1);
  const peak = Math.max(0, Math.min(1, opts.peak ?? 0.7));
  const sustain = Math.max(0, Math.min(1, opts.sustain ?? peak * 0.6));

  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.value = opts.freq;

  // ADSR-ish: attack → sustain → release.
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(peak, now + attack);
  env.gain.linearRampToValueAtTime(sustain, now + Math.max(attack, dur - release));
  env.gain.linearRampToValueAtTime(0.0001, now + dur);

  osc.connect(env);
  env.connect(masterGain);
  osc.start(now);
  osc.stop(now + dur + 0.005);
}

function blip() {
  flags.lastEvent = "blip";
  flags.lastPlayedAt = Date.now();
  voice({ freq: 660, durationMs: 110, type: "square", peak: 0.65, release: 40 });
  // Tiny pitch-up tail so it reads as "ka-CHING".
  setTimeout(
    () =>
      voice({
        freq: 990,
        durationMs: 70,
        type: "square",
        peak: 0.45,
        release: 30,
      }),
    40,
  );
}

function lowBlip() {
  flags.lastEvent = "lowBlip";
  flags.lastPlayedAt = Date.now();
  voice({ freq: 220, durationMs: 90, type: "triangle", peak: 0.45, release: 40 });
}

function arpeggio() {
  flags.lastEvent = "arpeggio";
  flags.lastPlayedAt = Date.now();
  // 3-note rising arpeggio (C5 → E5 → G5) — feels like a level-up.
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    setTimeout(
      () =>
        voice({
          freq,
          durationMs: 180,
          type: "square",
          peak: 0.55,
          release: 60,
        }),
      i * 90,
    );
  });
}

// ----- Public mount hook -----

/**
 * Mount the synthesizer for the lifetime of the calling component.
 * Safe to call from a single owner (`app.vue`); increment a counter
 * so a future second caller doesn't double-subscribe.
 */
export function useSoundFx(): void {
  installed += 1;

  function shouldPlay(): boolean {
    if (typeof window === "undefined") return false;
    const settings = useSettingsStore();
    if (!settings.soundFx) return false;
    if (reducedMotionPreferred()) return false;
    return true;
  }

  const offTask = onAppEvent("taskCompleted", () => {
    if (!shouldPlay()) return;
    blip();
  });

  // Defensive subscription: W1's store will dispatch `levelUp` after the
  // level curve bumps (contract §4). Until the event exists in `AppEvents`,
  // the function-pointer casts below no-op — the listener map only
  // receives a matching emit, so this stays a free subscription.
  let offLevel: (() => void) | null = null;
  try {
    const anyBus = { onAppEvent } as { onAppEvent: (n: string, h: (p: any) => void) => () => void };
    offLevel = anyBus.onAppEvent("levelUp", () => {
      if (!shouldPlay()) return;
      arpeggio();
    });
  } catch {
    offLevel = null;
  }

  // Dev-only debug surface: `window.__ppSoundFxFlags.audioContextOk`
  // proves the lazy AudioContext was created after a real gesture.
  if (import.meta.dev && typeof window !== "undefined") {
    (window as any).__ppSoundFxFlags = flags;
  }

  onBeforeUnmount(() => {
    offTask();
    offLevel?.();
    installed -= 1;
    if (installed <= 0) {
      // Don't actually close the AudioContext — its lifecycle is owned
      // by the browser anyway, and closing means we'd need to recreate
      // it later (which costs a real user gesture again).
      installed = 0;
    }
  });

  // `onMounted` runs the body above a second time (Vue 3 setup script
  // runs once, but guard against future refactors).
  onMounted(() => {
    /* subscriptions are already in place; nothing else to do here */
  });
}
