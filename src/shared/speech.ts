// Voice alerts via the Web Speech API (WebView2 ships Windows voices).

let queue: string[] = [];
let speaking = false;

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return voices.find((v) => v.lang.startsWith("ru")) ?? voices[0];
}

function drain(volume: number) {
  const text = queue.shift();
  if (!text) {
    speaking = false;
    return;
  }
  speaking = true;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = pickVoice() ?? null;
  u.lang = u.voice?.lang ?? "ru-RU";
  u.volume = volume;
  u.rate = 1.1;
  u.onend = u.onerror = () => drain(volume);
  window.speechSynthesis.speak(u);
}

export function speak(text: string, volume = 1): void {
  if (!("speechSynthesis" in window)) return;
  queue.push(text);
  if (!speaking) drain(volume);
}

/** Short beep fallback when voice is off but a sound is wanted. */
export function beep(): void {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
  osc.onended = () => ctx.close();
}

export function resetSpeech(): void {
  queue = [];
  speaking = false;
  window.speechSynthesis?.cancel();
}
