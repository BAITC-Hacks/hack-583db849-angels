'use client';

import type { Track } from 'livekit-client';
import { useEffect, useRef } from 'react';

/** A camera picture from the call; `mirror` for your own, the way a mirror shows you. */
export function VideoTile({ track, label, mirror = false, className = '' }: { track: Track | null; label: string; mirror?: boolean; className?: string }) {
  const element = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = element.current;
    if (!track || !video) return;
    track.attach(video);
    return () => {
      track.detach(video);
    };
  }, [track]);

  return (
    <video
      ref={element}
      aria-label={label}
      autoPlay
      playsInline
      muted
      className={`h-full w-full bg-[#131313] object-cover ${mirror ? '-scale-x-100' : ''} ${track ? '' : 'invisible'} ${className}`}
    />
  );
}

/** The other side's voice. Your own is never played back to you. */
export function AudioSink({ track }: { track: Track | null }) {
  const element = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = element.current;
    if (!track || !audio) return;
    track.attach(audio);
    return () => {
      track.detach(audio);
    };
  }, [track]);

  return <audio ref={element} autoPlay className="hidden" />;
}
