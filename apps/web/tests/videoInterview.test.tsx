import type { components } from '@invision/api-client';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CandidateHome from '../app/(product)/candidate/page';
import { CandidateCall } from '../components/call/CandidateCall';
import { InterviewerCall } from '../components/call/InterviewerCall';
import { CandidateInterview } from '../components/schedule/CandidateInterview';
import { InterviewerSchedule } from '../components/schedule/InterviewerSchedule';
import type { WireCandidate } from '../lib/api/contract';
import { DemoRoleProvider } from '../lib/DemoRoleProvider';
import { DEMO_INTERVIEWER_REF } from '../lib/interview/queries';
import type { InterviewSlot } from '../lib/slots/types';
import { apiError, example, json, mockApi, withQuery, type Call } from './apiHarness';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => '/' }));

/** A stand-in for LiveKit's room: it connects at once, and a test brings the other side in. */
const livekit = vi.hoisted(() => {
  type Handler = () => void;
  class FakeTrack {
    readonly mediaStreamTrack: { id: string; kind: string };
    attach = () => undefined;
    detach = () => undefined;
    constructor(readonly source: string, id: string) {
      this.mediaStreamTrack = { id, kind: source === 'camera' ? 'video' : 'audio' };
    }
  }
  class FakeParticipant {
    tracks = new Map<string, FakeTrack>();
    isMicrophoneEnabled = false;
    isCameraEnabled = false;
    constructor(readonly identity: string) {}
    getTrackPublication(source: string) {
      const track = this.tracks.get(source);
      return track ? { track } : undefined;
    }
    async enableCameraAndMicrophone() {
      this.tracks.set('camera', new FakeTrack('camera', `${this.identity}-camera`));
      this.tracks.set('microphone', new FakeTrack('microphone', `${this.identity}-mic`));
      this.isMicrophoneEnabled = true;
      this.isCameraEnabled = true;
    }
    async setMicrophoneEnabled(on: boolean) {
      this.isMicrophoneEnabled = on;
    }
    async setCameraEnabled(on: boolean) {
      this.isCameraEnabled = on;
    }
  }
  const rooms: FakeRoom[] = [];
  class FakeRoom {
    handlers = new Map<string, Handler[]>();
    localParticipant = new FakeParticipant('me');
    remoteParticipants = new Map<string, FakeParticipant>();
    state = 'disconnected';
    connected: { url: string; token: string } | null = null;
    constructor() {
      rooms.push(this);
    }
    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }
    emit(event: string) {
      this.handlers.get(event)?.forEach((handler) => handler());
    }
    async connect(url: string, token: string) {
      this.connected = { url, token };
      this.state = 'connected';
    }
    async disconnect() {
      this.state = 'disconnected';
      this.emit('disconnected');
    }
    /** The other side joins with camera and microphone. */
    arrive(identity: string) {
      const other = new FakeParticipant(identity);
      other.tracks.set('camera', new FakeTrack('camera', `${identity}-camera`));
      other.tracks.set('microphone', new FakeTrack('microphone', `${identity}-mic`));
      this.remoteParticipants.set(identity, other);
      this.emit('participantConnected');
    }
  }
  return { FakeRoom, rooms };
});

vi.mock('livekit-client', () => ({
  Room: livekit.FakeRoom,
  RoomEvent: {
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
    Disconnected: 'disconnected',
  },
  Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
}));

const list = example<{ items: WireCandidate[] }>('candidates.json');
const candidateId = list.items[0].candidateId;
const wireSlot = example<InterviewSlot>('interview-slot.json');
const access = example<components['schemas']['CallAccessDto']>('call-access.json');
const wireInterview = example<components['schemas']['InterviewDto']>('interview.json');
const brief = example<components['schemas']['BriefDto']>('brief.json');
const MINUTE = 60_000;

/** A slot starting `minutes` from now, with whatever else a test needs. */
function slotIn(minutes: number, fields: Partial<InterviewSlot> = {}): InterviewSlot {
  const startsAt = new Date(Date.now() + minutes * MINUTE);
  return {
    ...wireSlot,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 30 * MINUTE).toISOString(),
    waitUntil: new Date(startsAt.getTime() + 5 * MINUTE).toISOString(),
    ...fields,
  };
}

const slotPath = `/api/v1/interview-slots/${wireSlot.slotId}`;
const posts = (calls: Call[], path: string) => calls.filter((call) => call.method === 'POST' && call.path.startsWith(path));

beforeEach(() => {
  livekit.rooms.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the interviewer’s schedule', () => {
  it('adds a time typed in Almaty time, as the demo’s interviewer', async () => {
    const calls = mockApi({
      'GET /api/v1/interview-slots': () => json({ items: [] }),
      'POST /api/v1/interview-slots': () => json(slotIn(60 * 24, { status: 'open', candidateId: null, candidateLabel: null }), 201),
    });
    withQuery(
      <DemoRoleProvider role="interviewer">
        <InterviewerSchedule />
      </DemoRoleProvider>,
    );
    fireEvent.change(await screen.findByLabelText('Date'), { target: { value: '2026-09-29' } });
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(posts(calls, '/api/v1/interview-slots')).toHaveLength(1));
    const post = posts(calls, '/api/v1/interview-slots')[0];
    // 10:00 in Almaty is 05:00 UTC.
    expect(JSON.parse(post.body as string)).toEqual({ startsAt: '2026-09-29T05:00:00.000Z', interviewerRef: DEMO_INTERVIEWER_REF, durationMin: 30 });
    expect(post.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('opens the call ten minutes before the start, not earlier, and says why a time was refused', async () => {
    mockApi({
      'GET /api/v1/interview-slots': () =>
        json({ items: [slotIn(5, { slotId: 'slot-soon' }), slotIn(120, { slotId: 'slot-later' }), slotIn(180, { slotId: 'slot-free', status: 'open', candidateId: null, candidateLabel: null })] }),
      'POST /api/v1/interview-slots': () => apiError(409, 'SLOT_OVERLAPS'),
    });
    withQuery(
      <DemoRoleProvider role="interviewer">
        <InterviewerSchedule />
      </DemoRoleProvider>,
    );
    const join = await screen.findByRole('link', { name: 'Join the call' });
    expect(join.getAttribute('href')).toBe('/interviewer/schedule/call/slot-soon');
    expect(screen.getAllByRole('link', { name: 'Join the call' })).toHaveLength(1);
    expect(screen.getByText(/^Opens at/)).toBeTruthy();
    // Only a time nobody booked can be removed.
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('You already have a slot at that time.')).toBeTruthy();
  });

  it('lets the commission look, not add', async () => {
    mockApi({ 'GET /api/v1/interview-slots': () => json({ items: [slotIn(60)] }) });
    withQuery(
      <DemoRoleProvider role="commission">
        <InterviewerSchedule />
      </DemoRoleProvider>,
    );
    expect(await screen.findByText('Candidate A')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Join the call' })).toBeNull();
  });
});

describe('the candidate booking', () => {
  it('chooses a time, then books it, and then shows it', async () => {
    let booked = false;
    const open = slotIn(60 * 24, { status: 'open', candidateId: null, candidateLabel: null });
    const calls = mockApi({
      'GET /api/v1/candidates': () => json(list),
      'GET /api/v1/interview-slots': () => json({ items: [booked ? { ...open, status: 'booked', candidateId, candidateLabel: 'Candidate A' } : open] }),
      [`POST ${slotPath}/booking`]: () => {
        booked = true;
        return json({ ...open, status: 'booked', candidateId });
      },
    });
    withQuery(<CandidateInterview />);

    const time = await screen.findByRole('button', { name: /^\d\d:\d\d–\d\d:\d\d$/ });
    expect(posts(calls, slotPath)).toHaveLength(0);
    fireEvent.click(time);
    expect(time.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Book / }));

    expect(await screen.findByText('Your interview')).toBeTruthy();
    expect(JSON.parse(posts(calls, slotPath)[0].body as string)).toEqual({ candidateId });
    expect(screen.getByText(/The call opens at/)).toBeTruthy();
  });

  it('after a missed time, does not offer the same day again', async () => {
    // 09:00 in Almaty: the missed time was at 08:00, and another is open at 15:00 the same day.
    vi.useFakeTimers({ now: new Date('2026-09-28T04:00:00Z'), shouldAdvanceTime: true });
    const missed = slotIn(-60, { slotId: 'slot-missed', status: 'missed', missedBy: 'candidate', candidateId });
    const sameDay = slotIn(6 * 60, { slotId: 'slot-same-day', status: 'open', candidateId: null, candidateLabel: null });
    const nextDay = slotIn(25 * 60, { slotId: 'slot-next-day', status: 'open', candidateId: null, candidateLabel: null });
    mockApi({
      'GET /api/v1/candidates': () => json(list),
      'GET /api/v1/interview-slots': () => json({ items: [missed, sameDay, nextDay] }),
    });
    withQuery(<CandidateInterview />);

    expect(await screen.findByText('Your last interview time closed')).toBeTruthy();
    const [sameDayTime, nextDayTime] = screen.getAllByRole('button', { name: /^\d\d:\d\d–\d\d:\d\d$/ }) as HTMLButtonElement[];
    expect(sameDayTime.disabled).toBe(true);
    expect(nextDayTime.disabled).toBe(false);
    expect(screen.getByText(/not available after the missed time/)).toBeTruthy();
  });

  it('is the fifth step on the candidate home', async () => {
    mockApi({ 'GET /api/v1/candidates': () => json(list) });
    withQuery(<CandidateHome />);
    expect((await screen.findByRole('link', { name: 'Book your interview' })).getAttribute('href')).toBe('/candidate/interview');
  });
});

describe('the candidate in the call', () => {
  it('asks about recording, joins LiveKit with the API’s token, and waits for the interviewer', async () => {
    const calls = mockApi({
      [`GET ${slotPath}`]: () => json(slotIn(-1, { candidateJoinedAt: new Date().toISOString() })),
      [`POST ${slotPath}/join`]: () => json({ ...access, side: 'candidate', interviewId: null }),
    });
    withQuery(<CandidateCall slotId={wireSlot.slotId} />);

    fireEvent.click(await screen.findByLabelText(/recorded as audio and transcribed/));
    fireEvent.click(screen.getByRole('button', { name: 'Join the interview' }));

    expect(await screen.findByText(/The interviewer will be with you in a moment/)).toBeTruthy();
    expect(JSON.parse(posts(calls, `${slotPath}/join`)[0].body as string)).toEqual({ consentRecording: true });
    const room = livekit.rooms[0];
    expect(room.connected).toEqual({ url: access.url, token: access.token });

    act(() => room.arrive('interviewer'));
    await waitFor(() => expect(screen.queryByText(/will be with you in a moment/)).toBeNull());
    expect(screen.getByLabelText('Interviewer')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByText(/You have left the call/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join again' })).toBeTruthy();
  });

  it('joins without recording when the box is left empty', async () => {
    const calls = mockApi({
      [`GET ${slotPath}`]: () => json(slotIn(2)),
      [`POST ${slotPath}/join`]: () => json({ ...access, side: 'candidate', interviewId: null }),
    });
    withQuery(<CandidateCall slotId={wireSlot.slotId} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Join the interview' }));
    await waitFor(() => expect(posts(calls, `${slotPath}/join`)).toHaveLength(1));
    expect(JSON.parse(posts(calls, `${slotPath}/join`)[0].body as string)).toEqual({ consentRecording: false });
  });

  it('says so when video calls are not set up, and connects to nothing', async () => {
    mockApi({
      [`GET ${slotPath}`]: () => json(slotIn(2)),
      [`POST ${slotPath}/join`]: () => apiError(503, 'VIDEO_UNAVAILABLE'),
    });
    withQuery(<CandidateCall slotId={wireSlot.slotId} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Join the interview' }));
    expect(await screen.findByText('Video calls are not set up on this server yet.')).toBeTruthy();
    expect(livekit.rooms).toHaveLength(0);
  });

  it('closes a time the interviewer missed, without blame, and sends the candidate to book another day', async () => {
    mockApi({ [`GET ${slotPath}`]: () => json(slotIn(-10, { status: 'missed', missedBy: 'interviewer' })) });
    withQuery(<CandidateCall slotId={wireSlot.slotId} />);
    expect(await screen.findByText('This interview time has closed')).toBeTruthy();
    expect(screen.getByText(/this does not count against you/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Book another day' }).getAttribute('href')).toBe('/candidate/interview');
  });
});

describe('the interviewer in the call', () => {
  const interviewPath = `/api/v1/interviews/${access.interviewId}`;

  class FakeAudioRecorder {
    static isTypeSupported = () => true;
    state: 'inactive' | 'recording' = 'inactive';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    readonly mimeType = 'audio/webm';
    constructor(readonly stream: unknown) {}
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['both voices'], { type: 'audio/webm' }) });
      this.onstop?.();
    }
  }

  function withAudio() {
    const sources: string[] = [];
    vi.stubGlobal('MediaRecorder', FakeAudioRecorder);
    vi.stubGlobal('MediaStream', class {
      constructor(readonly tracks: { id: string }[]) {}
    });
    vi.stubGlobal('AudioContext', class {
      createMediaStreamDestination() {
        return { stream: {} };
      }
      createMediaStreamSource(stream: { tracks: { id: string }[] }) {
        sources.push(stream.tracks[0].id);
        return { connect: () => undefined };
      }
      async close() {}
    });
    return sources;
  }

  function interviewerServer(slot: InterviewSlot) {
    return mockApi({
      [`GET ${slotPath}`]: () => json(slot),
      [`POST ${slotPath}/join`]: () => json(access),
      'GET /api/v1/candidates': () => json(list),
      [`GET /api/v1/candidates/${candidateId}/brief`]: () => json(brief),
      [`GET ${interviewPath}`]: () => json({ ...wireInterview, interviewId: access.interviewId, notes: [], interviewerScores: null }),
      [`PUT ${interviewPath}/notes`]: (call: Call) =>
        json({ ...wireInterview, notes: (JSON.parse(call.body as string).notes as string[]).map((text, index) => ({ id: `note_${index + 1}`, text })) }),
      [`POST ${interviewPath}/recording`]: () => json({ ...wireInterview, transcriptStatus: 'transcribing', transcript: null }, 202),
    });
  }

  async function joinCall() {
    withQuery(
      <DemoRoleProvider role="interviewer">
        <InterviewerCall slotId={wireSlot.slotId} />
      </DemoRoleProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Join the call' }));
    await screen.findByRole('tab', { name: 'Questions' });
  }

  it('has the brief’s questions, notes and blind scores beside the call — and no draft', async () => {
    const calls = interviewerServer(slotIn(-1, { candidateJoinedAt: new Date().toISOString(), consentRecording: false }));
    await joinCall();

    expect(await screen.findByText(brief.questions[0].question)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Scores' }));
    const group = screen.getAllByRole('radiogroup')[0];
    fireEvent.click(within(group).getByRole('radio', { name: '3' }));
    // A look at the notes does not lose a score that is not saved yet.
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    fireEvent.change(screen.getByLabelText('Add note'), { target: { value: 'Split the robotics team into two groups.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    expect(JSON.parse(calls.find((call) => call.method === 'PUT')!.body as string)).toEqual({ notes: ['Split the robotics team into two groups.'] });
    fireEvent.click(screen.getByRole('tab', { name: 'Scores' }));
    expect(within(screen.getAllByRole('radiogroup')[0]).getByRole('radio', { name: '3' }).getAttribute('aria-checked')).toBe('true');

    expect(calls.some((call) => call.path.includes('assessment-draft'))).toBe(false);
  });

  it('records nothing when the candidate did not agree', async () => {
    interviewerServer(slotIn(-1, { candidateJoinedAt: new Date().toISOString(), consentRecording: false }));
    await joinCall();
    expect(await screen.findByText(/did not agree to recording/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start recording' })).toBeNull();
  });

  it('records both voices with consent, and sends them to the interview’s transcription', async () => {
    const sources = withAudio();
    const calls = interviewerServer(slotIn(-1, { candidateJoinedAt: new Date().toISOString(), consentRecording: true }));
    await joinCall();
    act(() => livekit.rooms[0].arrive('candidate'));

    fireEvent.click(await screen.findByRole('button', { name: 'Start recording' }));
    expect(await screen.findByText(/Recording both voices/)).toBeTruthy();
    expect(sources).toEqual(['me-mic', 'candidate-mic']);

    fireEvent.click(screen.getByRole('button', { name: 'Stop and transcribe' }));
    expect(await screen.findByText(/Sent for transcription/)).toBeTruthy();
    const form = posts(calls, `${interviewPath}/recording`)[0].body as FormData;
    expect(form.get('consent')).toBe('true');
    expect((form.get('audio') as Blob).type).toBe('audio/webm');
  });

  it('sends the recording when the interviewer leaves the call mid-recording', async () => {
    withAudio();
    const calls = interviewerServer(slotIn(-1, { candidateJoinedAt: new Date().toISOString(), consentRecording: true }));
    await joinCall();
    act(() => livekit.rooms[0].arrive('candidate'));
    fireEvent.click(await screen.findByRole('button', { name: 'Start recording' }));
    await screen.findByText(/Recording both voices/);

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByText(/Sent for transcription/)).toBeTruthy();
    expect(posts(calls, `${interviewPath}/recording`)).toHaveLength(1);
  });
});
