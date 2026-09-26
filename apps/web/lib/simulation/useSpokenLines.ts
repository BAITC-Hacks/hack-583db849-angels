'use client';

import { useEffect, useState } from 'react';
import { characterAudioSrc, speakAloud, turnAudioUrl } from './characterVoice';
import type { SimulationTurn } from './types';

/** About 155 words a minute: the pace words appear at until the voice's own length is known. */
const WORD_MS = 390;

export interface SpokenLines {
  /** The candidate pressed Start (or came back to a conversation already under way). */
  started: boolean;
  /** A click, so the browser lets the voice play: then the first line is spoken. */
  start: () => void;
  /** The character's line being spoken now, and how many of its words are on screen. */
  speaking: { turnId: string; words: number } | null;
  /** The turns to show: everything up to the line being spoken, nothing before Start. */
  visible: SimulationTurn[];
}

function wordsIn(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * The conversation as it is heard. After Start, each of the character's
 * lines is played in their voice and its words appear as they are said; the
 * next line waits for this one. A conversation already under way when the
 * page opens is shown whole, and only new lines are spoken.
 *
 * A browser that will not play the recorded voice reads the line with its
 * own voice instead, at the same pace. The words always end up on screen.
 */
export function useSpokenLines(simulationId: string, turns: SimulationTurn[], underWay: boolean): SpokenLines {
  const [started, setStarted] = useState(underWay);
  // Lines already spoken — or shown whole because they were said before this page opened.
  const [spoken, setSpoken] = useState<string[]>(() =>
    underWay ? turns.filter((turn) => turn.speaker === 'character').map((turn) => turn.turnId) : [],
  );
  const [progress, setProgress] = useState<{ turnId: string; words: number } | null>(null);

  const next = started ? (turns.find((turn) => turn.speaker === 'character' && !spoken.includes(turn.turnId)) ?? null) : null;
  const nextId = next?.turnId ?? null;
  const nextText = next?.text ?? '';

  useEffect(() => {
    if (!nextId) return;
    const total = wordsIn(nextText);
    let words = 0;
    let ticker: ReturnType<typeof setInterval> | undefined;
    let done = false;
    let fellBack = false;
    const reveal = (ms: number) => {
      clearInterval(ticker);
      ticker = setInterval(() => {
        words = Math.min(total, words + 1);
        setProgress({ turnId: nextId, words });
        if (words >= total) clearInterval(ticker);
      }, ms);
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(ticker);
      setProgress(null);
      setSpoken((ids) => (ids.includes(nextId) ? ids : [...ids, nextId]));
    };
    // If the voice never ends — a stalled stream — the conversation still moves on.
    const safety = setTimeout(finish, total * 700 + 5_000);
    const withBrowserVoice = () => {
      if (done || fellBack) return;
      fellBack = true;
      speakAloud(nextText);
      reveal(WORD_MS);
      setTimeout(finish, total * WORD_MS + 400);
    };

    reveal(WORD_MS);
    const audio = typeof Audio === 'undefined' ? null : new Audio(characterAudioSrc(turnAudioUrl(simulationId, nextId)));
    if (!audio) {
      withBrowserVoice();
    } else {
      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) reveal(Math.min(700, Math.max(150, (audio.duration * 1000) / Math.max(total, 1))));
      };
      audio.onended = finish;
      audio.onerror = withBrowserVoice;
      void audio.play()?.catch(withBrowserVoice);
    }
    return () => {
      done = true;
      clearInterval(ticker);
      clearTimeout(safety);
      audio?.pause();
      if (fellBack && typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [nextId, nextText, simulationId]);

  const speaking = nextId ? { turnId: nextId, words: progress?.turnId === nextId ? progress.words : 0 } : null;
  const at = nextId ? turns.findIndex((turn) => turn.turnId === nextId) : -1;
  const visible = !started ? [] : at >= 0 ? turns.slice(0, at + 1) : turns;
  return { started, start: () => setStarted(true), speaking, visible };
}
