# Synthetic candidate A interview audio

`candidate-a.ogg` is generated offline by
`services/ml/scripts/build_m4_transcription_fixture.py` using eSpeak NG
(`en-us` lower pitch for interviewer and `en-gb` higher pitch for candidate)
and FFmpeg.
Its spoken lines are the synthetic candidate A ML contract example. It is not
a recording of any person. The script also records a deterministic, synthetic
Deepgram-shaped diarization cassette; it never calls a speech provider.
