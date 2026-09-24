# Synthetic M2a candidate audio

Every Ogg Opus file in this directory is generated from the candidate lines in
`seed/candidates/{a,b,c}/transcript.json` with open-source eSpeak NG and FFmpeg.
`services/ml/scripts/generate_m2a_audio.py` derives each M2a session from that
transcript before encoding the speech. They contain no recording or voice of a real person.
They exist to make API-compatible M2a record/replay
deterministic and must never be replaced with human audio.
