'use client';

import { MicrophoneIcon, PhoneXMarkIcon, VideoCameraIcon, VideoCameraSlashIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import type { CallRoom } from '../../lib/call/useCallRoom';
import { AudioSink, VideoTile } from './VideoTile';

export interface StageCopy {
  other: string;
  you: string;
  otherCameraOff: string;
  mute: string;
  unmute: string;
  cameraOff: string;
  cameraOn: string;
  leave: string;
}

const control =
  'inline-flex items-center gap-1.5 rounded-control border border-border-strong px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated';

/**
 * The call itself: the other side large, yourself small in the corner, and
 * the three controls everyone expects. `notice` sits over the picture — the
 * wait for the other side, with its countdown.
 */
export function CallStage({ room, copy, notice }: { room: CallRoom; copy: StageCopy; notice?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="relative aspect-video overflow-hidden rounded-panel bg-[#131313]">
        <VideoTile track={room.otherVideo} label={copy.other} />
        {!room.otherVideo ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[#fffde9]/80">
            {room.otherHere ? copy.otherCameraOff : notice}
          </p>
        ) : null}
        <span className="absolute top-3 left-3 rounded-control bg-[#131313]/70 px-2 py-1 font-mono text-[0.65rem] text-[#fffde9]">{copy.other}</span>
        <div className="absolute right-3 bottom-3 aspect-video w-1/4 min-w-28 overflow-hidden rounded-control border border-[#fffde9]/30 bg-[#131313]">
          <VideoTile track={room.cameraOn ? room.localVideo : null} label={copy.you} mirror />
          <span className="absolute bottom-1 left-1.5 font-mono text-[0.6rem] text-[#fffde9]/80">{copy.you}</span>
        </div>
      </div>
      <AudioSink track={room.otherAudio} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={room.toggleMic} aria-pressed={!room.micOn} className={control}>
          <MicrophoneIcon aria-hidden="true" className={`h-4 w-4 ${room.micOn ? '' : 'text-status-low'}`} />
          {room.micOn ? copy.mute : copy.unmute}
        </button>
        <button type="button" onClick={room.toggleCamera} aria-pressed={!room.cameraOn} className={control}>
          {room.cameraOn ? <VideoCameraIcon aria-hidden="true" className="h-4 w-4" /> : <VideoCameraSlashIcon aria-hidden="true" className="h-4 w-4 text-status-low" />}
          {room.cameraOn ? copy.cameraOff : copy.cameraOn}
        </button>
        <button type="button" onClick={room.leave} className={`${control} ml-auto border-status-low text-status-low`}>
          <PhoneXMarkIcon aria-hidden="true" className="h-4 w-4" />
          {copy.leave}
        </button>
      </div>
    </section>
  );
}
