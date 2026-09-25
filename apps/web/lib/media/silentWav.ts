/**
 * A few seconds of silence as a 16 kHz mono WAV — the demo's stand-in for a
 * recording when there is no microphone. It goes through the same upload,
 * consent and deletion as a real one; in the demo the transcription service
 * answers with the recorded interview.
 */
export function silentWav(seconds = 2, sampleRate = 16_000): Blob {
  const samples = seconds * sampleRate;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return new Blob([buffer], { type: 'audio/wav' });
}
