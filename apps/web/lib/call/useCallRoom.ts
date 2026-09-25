'use client';

import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallAccess } from '../slots/types';

export type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'failed';

/** What the screen draws, read from the room after every event. */
export interface CallSnapshot {
  localVideo: Track | null;
  localAudio: Track | null;
  /** The other side is in the room, with or without a camera. */
  otherHere: boolean;
  otherVideo: Track | null;
  otherAudio: Track | null;
  micOn: boolean;
  cameraOn: boolean;
}

export interface CallRoom extends CallSnapshot {
  state: CallState;
  connect: (access: CallAccess) => Promise<void>;
  toggleMic: () => void;
  toggleCamera: () => void;
  leave: () => void;
}

const empty: CallSnapshot = { localVideo: null, localAudio: null, otherHere: false, otherVideo: null, otherAudio: null, micOn: false, cameraOn: false };

function track(participant: Participant | undefined, source: Track.Source): Track | null {
  return participant?.getTrackPublication(source)?.track ?? null;
}

function read(room: Room): CallSnapshot {
  // Two people in a room: whoever is not this side is the other one.
  const other = [...room.remoteParticipants.values()][0];
  return {
    localVideo: track(room.localParticipant, Track.Source.Camera),
    localAudio: track(room.localParticipant, Track.Source.Microphone),
    otherHere: Boolean(other),
    otherVideo: track(other, Track.Source.Camera),
    otherAudio: track(other, Track.Source.Microphone),
    micOn: room.localParticipant.isMicrophoneEnabled,
    cameraOn: room.localParticipant.isCameraEnabled,
  };
}

const events = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
] as const;

/**
 * One side of the video interview, on LiveKit. The page asks the API for a
 * room token and hands it here; this connects, turns on the camera and the
 * microphone, and keeps a snapshot of who is in the room for the screen.
 * Leaving the page leaves the room.
 */
export function useCallRoom(): CallRoom {
  const room = useRef<Room | null>(null);
  const [state, setState] = useState<CallState>('idle');
  const [snapshot, setSnapshot] = useState<CallSnapshot>(empty);

  const leave = useCallback(() => {
    const current = room.current;
    room.current = null;
    if (current) void current.disconnect();
    setSnapshot(empty);
    setState((value) => (value === 'idle' ? value : 'ended'));
  }, []);

  useEffect(() => () => void room.current?.disconnect(), []);

  const connect = useCallback(async (access: CallAccess) => {
    room.current?.disconnect();
    const next = new Room({ adaptiveStream: true, dynacast: true });
    room.current = next;
    const refresh = () => {
      if (room.current === next) setSnapshot(read(next));
    };
    for (const event of events) next.on(event, refresh);
    next.on(RoomEvent.Disconnected, () => {
      if (room.current !== next) return;
      room.current = null;
      setSnapshot(empty);
      setState('ended');
    });

    setState('connecting');
    try {
      await next.connect(access.url, access.token);
      await next.localParticipant.enableCameraAndMicrophone();
      setState('connected');
      refresh();
    } catch {
      // No camera or microphone still lets the call go ahead; a failed connection does not.
      if (next.state === 'connected') {
        setState('connected');
        refresh();
      } else {
        room.current = null;
        setState('failed');
      }
    }
  }, []);

  const toggleMic = useCallback(() => {
    const current = room.current;
    if (!current) return;
    void current.localParticipant.setMicrophoneEnabled(!current.localParticipant.isMicrophoneEnabled).then(() => setSnapshot(read(current)));
  }, []);

  const toggleCamera = useCallback(() => {
    const current = room.current;
    if (!current) return;
    void current.localParticipant.setCameraEnabled(!current.localParticipant.isCameraEnabled).then(() => setSnapshot(read(current)));
  }, []);

  return { ...snapshot, state, connect, toggleMic, toggleCamera, leave };
}
