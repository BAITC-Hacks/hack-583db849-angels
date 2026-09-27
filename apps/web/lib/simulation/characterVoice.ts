/**
 * The character's line, out loud. The API's recorded voice comes first; when it
 * cannot play — no file, a blocked autoplay, an old browser — the browser's own
 * voice reads the same words. The caption is on screen either way.
 */

/** `characterAudioUrl` is relative to `/v1`; the browser reaches it through this app's `/api`. */
export function characterAudioSrc(apiUrl: string): string {
  return `/api${apiUrl}`;
}

export function turnAudioUrl(simulationId: string, turnId: string): string {
  return `/v1/simulations/${encodeURIComponent(simulationId)}/turns/${encodeURIComponent(turnId)}/audio`;
}

/**
 * One voice at a time. Whatever starts — a line being said, a line played
 * again, the browser reading one — stops the voice before it, so pressing
 * the speaker twice restarts the line instead of playing it twice over.
 */
let current: HTMLAudioElement | null = null;

export function stopCharacterVoice(): void {
  current?.pause();
  current = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** Makes this recording the only voice playing. */
export function claimVoice(audio: HTMLAudioElement): void {
  stopCharacterVoice();
  current = audio;
}

/** Stops this recording if it is still the one playing; a newer voice is left alone. */
export function releaseVoice(audio: HTMLAudioElement): void {
  audio.pause();
  if (current === audio) current = null;
}

/** The browser's own voice: the fallback when the recorded one cannot play. */
export function speakAloud(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  stopCharacterVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

export function playCharacterLine(apiUrl: string | null, text: string): void {
  if (typeof window === 'undefined') return;
  if (!apiUrl || typeof Audio === 'undefined') {
    speakAloud(text);
    return;
  }
  const audio = new Audio(characterAudioSrc(apiUrl));
  claimVoice(audio);
  audio.play().catch(() => speakAloud(text));
}
