import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SimulationPage from '../app/(product)/simulation/[sessionId]/page';
import type { WireSimulation, WireTurnResult } from '../lib/api/contract';
import { applyTurnResult } from '../lib/api/mappers/simulation';
import type { SimulationTurn } from '../lib/simulation/types';
import { useSpokenLines } from '../lib/simulation/useSpokenLines';
import { example, json, mockApi, withQuery } from './apiHarness';

/**
 * The conversation is heard before it is read: nothing plays until the
 * candidate presses Start, then each of the character's lines is spoken in
 * turn while its words appear, and the candidate answers once it has ended.
 */
const created = example<WireSimulation>('simulation-created.json');
const turn = example<WireTurnResult>('simulation-turn.json');
const id = created.simulationId;
const opening = created.turns[0].text;
const audioOf = (turnId: string) => `/api/v1/simulations/${id}/turns/${turnId}/audio`;

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: id }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
}));

let voices: FakeAudio[] = [];
let playable = true;
class FakeAudio {
  onloadedmetadata: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  duration = Number.NaN;
  constructor(readonly src: string) {
    voices.push(this);
  }
  play() {
    return playable ? Promise.resolve() : Promise.reject(new Error('blocked'));
  }
  pause() {}
}
const spokenByBrowser: string[] = [];

beforeEach(() => {
  voices = [];
  playable = true;
  spokenByBrowser.length = 0;
  vi.stubGlobal('Audio', FakeAudio);
  // jsdom does not lay the page out; the transcript follows each new word with this.
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    lang = '';
    constructor(readonly text: string) {}
  });
  vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: (utterance: { text: string }) => spokenByBrowser.push(utterance.text) });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the simulation screen', () => {
  it('waits for Start, then speaks the opening line before the candidate can answer', async () => {
    mockApi({ [`GET /api/v1/simulations/${id}`]: () => json(created) });
    withQuery(<SimulationPage />);

    const start = await screen.findByRole('button', { name: /start the conversation/i });
    expect(screen.queryByText(opening)).toBeNull();
    expect(voices).toHaveLength(0);

    fireEvent.click(start);
    expect(voices.map((voice) => voice.src)).toEqual([audioOf('turn_01')]);
    // The line is being said: not yet whole on screen, and the microphone waits.
    expect(screen.queryByText(opening)).toBeNull();
    expect(screen.getByText('Wait for the reply')).toBeTruthy();

    act(() => voices[0].onended?.());
    expect(screen.getByText(opening)).toBeTruthy();
    expect(screen.getByText('Hold to speak')).toBeTruthy();
  });

  it('goes straight back to a conversation already under way, without replaying it', async () => {
    const underWay = applyTurnResult(created, turn);
    mockApi({ [`GET /api/v1/simulations/${id}`]: () => json(underWay) });
    withQuery(<SimulationPage />);

    await waitFor(() => expect(screen.getByText(turn.characterTurn.text)).toBeTruthy());
    expect(screen.queryByRole('button', { name: /start the conversation/i })).toBeNull();
    expect(screen.getByText(opening)).toBeTruthy();
    expect(voices).toHaveLength(0);
  });
});

describe('the lines, one after another', () => {
  const line = (turnId: string, speaker: SimulationTurn['speaker'], text: string): SimulationTurn => ({ turnId, speaker, text });
  const first = [line('turn_01', 'character', 'Hello there, where do we start?')];
  const reply = [...first, line('turn_02', 'candidate', 'With the plan.'), line('turn_03', 'character', 'Fine, walk me through it.')];

  it('speaks a reply only after the line before it has ended', () => {
    const { result, rerender } = renderHook(({ turns }) => useSpokenLines(id, turns, false), { initialProps: { turns: first } });
    expect(result.current.visible).toEqual([]);

    act(() => result.current.start());
    expect(result.current.speaking).toEqual({ turnId: 'turn_01', words: 0 });

    rerender({ turns: reply });
    expect(voices.map((voice) => voice.src)).toEqual([audioOf('turn_01')]);
    expect(result.current.visible.map((item) => item.turnId)).toEqual(['turn_01']);

    act(() => voices[0].onended?.());
    expect(voices.map((voice) => voice.src)).toEqual([audioOf('turn_01'), audioOf('turn_03')]);
    expect(result.current.visible.map((item) => item.turnId)).toEqual(['turn_01', 'turn_02', 'turn_03']);
    expect(result.current.speaking?.turnId).toBe('turn_03');

    act(() => voices[1].onended?.());
    expect(result.current.speaking).toBeNull();
  });

  it('shows the words as they are said, and reads the line aloud itself when the voice cannot play', async () => {
    vi.useFakeTimers();
    playable = false;
    const { result } = renderHook(() => useSpokenLines(id, first, false));

    act(() => result.current.start());
    await act(async () => {
      await Promise.resolve();
    });
    expect(spokenByBrowser).toEqual([first[0].text]);

    act(() => vi.advanceTimersByTime(800));
    expect(result.current.speaking?.words).toBe(2);

    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.speaking).toBeNull();
    expect(result.current.visible).toEqual(first);
  });
});
