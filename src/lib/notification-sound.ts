/**
 * Play a subtle notification sound using Web Audio API.
 * Two-tone chime — no audio file required.
 */
let audioCtx: AudioContext | null = null;

export function playNotificationSound() {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }

    const now = audioCtx.currentTime;

    // First tone
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.frequency.value = 830; // high note
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone (slightly higher, delayed)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.frequency.value = 1050; // higher note
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.12, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.45);
  } catch {
    // Audio not available — silently ignore
  }
}
