'use client';

import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { MAX_TURN_LENGTH } from '../../lib/simulation/types';

/**
 * Typing a turn, which happens only when staff switched it on for this
 * candidate — no microphone, or a speech difficulty. Everything else is the
 * same, including the rule that pasting is refused: a prepared answer says
 * nothing about how someone leads.
 */
export function Composer({
  disabled,
  waiting,
  onSend,
}: {
  disabled: boolean;
  waiting: boolean;
  onSend: (text: string) => boolean;
}) {
  const [text, setText] = useState('');
  const canSend = !disabled && !waiting && text.trim().length > 0 && text.length <= MAX_TURN_LENGTH;

  function submit() {
    if (canSend && onSend(text)) setText('');
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2 rounded-panel border border-border-subtle bg-bg-surface p-3 focus-within:border-border-strong"
    >
      <label htmlFor="turn" className="sr-only">
        Your reply
      </label>
      <textarea
        id="turn"
        rows={3}
        onPaste={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
        value={text}
        disabled={disabled}
        maxLength={MAX_TURN_LENGTH}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={disabled ? 'The conversation has ended.' : 'Type your reply in English…'}
        className="w-full resize-none bg-transparent px-1 text-sm text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.6rem] tabular-nums text-text-muted">
          {text.length}/{MAX_TURN_LENGTH} · Enter to send · pasting is off · typing is on for you by request
        </span>
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex items-center gap-1.5 rounded-control bg-brand-green px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
          <PaperAirplaneIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}
