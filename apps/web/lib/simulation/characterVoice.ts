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

function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function playCharacterLine(apiUrl: string | null, text: string): void {
  if (typeof window === 'undefined') return;
  if (!apiUrl || typeof Audio === 'undefined') {
    speak(text);
    return;
  }
  const audio = new Audio(characterAudioSrc(apiUrl));
  audio.play().catch(() => speak(text));
}
