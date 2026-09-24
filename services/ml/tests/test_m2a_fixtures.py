import asyncio
import base64
from decimal import Decimal
import json
from pathlib import Path
import socket
import wave

from pydantic import BaseModel, ConfigDict, Field

from services.ml.app.gateway.canonical import cassette_key
from services.ml.app.gateway.cassettes import CassetteEnvelope, FileCassetteStore
from services.ml.app.gateway.config import Provider, TaskName, load_models_configuration
from services.ml.app.gateway.media import (
    FileMediaCassetteStore,
    MediaCassetteEnvelope,
    MediaGateway,
    MediaRequest,
)
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import GatewayRequest
from services.ml.app.modules.actor import ActorOutput, ROOT_PROMPT, ScenarioActor
from services.ml.app.modules.director import ScenarioDirector
from services.ml.app.modules.simulation import SimulationService
from services.ml.app.modules.speech import SpeechService
from services.ml.app.modules.transcription import TurnTranscriptionService
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository
from services.ml.app.schemas.contracts import SpeechRequest, TranscribeRequest, TurnRequest, TurnState
from services.ml.scripts.build_m2a_cassettes import SeedMatcher, _turn


ROOT = Path(__file__).resolve().parents[3]
AUDIO = ROOT / "fixtures" / "audio"
CASSETTES = ROOT / "fixtures" / "cassettes"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SessionTurn(Strict):
    audioRef: str = Field(pattern=r"^m2a/candidate-[abc]/turn-0[1-4]\.wav$")
    text: str = Field(min_length=1)
    expectedAnswerType: str = Field(min_length=1)
    expectedNextBeat: str = Field(min_length=1)
    characterLine: str = Field(min_length=1)


class Session(Strict):
    version: int
    candidateId: str = Field(pattern=r"^candidate-[abc]$")
    scenarioId: str
    openingLine: str = Field(min_length=1)
    turns: list[SessionTurn] = Field(min_length=4, max_length=4)


def sessions() -> list[Session]:
    result = []
    for candidate in ("a", "b", "c"):
        path = ROOT / "seed" / "candidates" / candidate / "m2a-session.json"
        result.append(Session.model_validate_json(path.read_text(encoding="utf-8")))
    return result


def replay_services(session: Session):
    configuration = load_models_configuration()
    scenarios = ScenarioRepository.load(ROOT_SCENARIOS)
    media = MediaGateway(
        mode="replay",
        configuration=configuration,
        providers={},
        cassettes=FileMediaCassetteStore(CASSETTES),
    )
    model = ModelGateway(
        mode="replay",
        configuration=configuration,
        providers={},
        cassettes=FileCassetteStore(CASSETTES),
    )
    expected = {item.text: item.expectedAnswerType for item in session.turns}
    simulation = SimulationService(
        scenarios,
        ScenarioDirector(SeedMatcher(expected)),
        ScenarioActor(model),
    )
    return simulation, TurnTranscriptionService(media), SpeechService(media, scenarios)


def test_sessions_and_generated_audio_are_complete_and_distinct() -> None:
    hashes = set()
    for session in sessions():
        assert session.version == 1
        assert session.scenarioId == "conflict-resolution"
        assert len(session.openingLine.split()) <= 60
        for item in session.turns:
            assert len(item.characterLine.split()) <= 60
            path = AUDIO / item.audioRef
            with wave.open(str(path), "rb") as source:
                assert source.getnchannels() == 1
                assert source.getsampwidth() == 2
                assert source.getnframes() > 0
            content = path.read_bytes()
            assert content[:4] == b"RIFF"
            hashes.add(__import__("hashlib").sha256(content).hexdigest())
    assert len(hashes) == 12
    provenance = (AUDIO / "m2a" / "README.md").read_text(encoding="utf-8")
    assert "eSpeak" in provenance
    assert "no recording or voice of a real person" in provenance


def test_all_committed_cassette_envelopes_and_outputs_validate() -> None:
    actor_files = list((CASSETTES / "simulation_actor").glob("*.json"))
    transcription_files = list((CASSETTES / "transcription").glob("*.json"))
    speech_files = list((CASSETTES / "speech").glob("*.json"))
    assert (len(actor_files), len(transcription_files), len(speech_files)) == (13, 12, 13)

    for path in actor_files:
        envelope = CassetteEnvelope.model_validate_json(path.read_text(encoding="utf-8"))
        ActorOutput.model_validate_json(envelope.response)
        assert path.stem == envelope.request_hash
        assert envelope.task == TaskName.SIMULATION_ACTOR
    for path in (*transcription_files, *speech_files):
        envelope = MediaCassetteEnvelope.model_validate_json(
            path.read_text(encoding="utf-8")
        )
        content = base64.b64decode(envelope.response_base64, validate=True)
        assert content
        assert path.stem == envelope.request_hash
        if envelope.task == TaskName.SPEECH:
            assert envelope.media_type == "audio/mpeg"
            assert content.startswith((b"ID3", b"\xff"))
        else:
            assert envelope.media_type == "application/json"
            assert json.loads(content)["results"]["channels"]


def test_candidate_audio_is_not_stored_in_transcription_cassettes() -> None:
    cassette_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (CASSETTES / "transcription").glob("*.json")
    )
    for session in sessions():
        for item in session.turns:
            audio = (AUDIO / item.audioRef).read_bytes()
            assert base64.b64encode(audio).decode("ascii") not in cassette_text


def test_a_b_c_sessions_replay_to_completion_without_network(monkeypatch) -> None:
    def forbidden_socket(*args, **kwargs):
        del args, kwargs
        raise AssertionError("replay attempted network access")

    async def replay_all() -> None:
        with monkeypatch.context() as blocked:
            blocked.setattr(socket, "socket", forbidden_socket)
            for session in sessions():
                simulation, transcription, speech = replay_services(session)
                transcript = []
                result = await simulation.turn(
                    TurnRequest(scenarioId=session.scenarioId, turns=[])
                )
                assert result.text == session.openingLine
                assert await speech.synthesize(
                    SpeechRequest(text=result.text, scenarioId=session.scenarioId)
                )
                transcript.append(_turn(1, "character", result.text, 0))
                next_beat = result.director.nextBeat

                for index, item in enumerate(session.turns, start=1):
                    recognised = await transcription.transcribe(
                        TranscribeRequest(
                            purpose="turn",
                            audioRef=item.audioRef,
                            language="en",
                            speakers=1,
                        ),
                        AUDIO / item.audioRef,
                    )
                    assert recognised.turns[0].text == item.text
                    assert recognised.turns[0].confidence == 0.99
                    transcript.append(
                        _turn(index * 2, "candidate", item.text, index * 10)
                    )
                    result = await simulation.turn(
                        TurnRequest(
                            scenarioId=session.scenarioId,
                            turns=transcript,
                            state=TurnState(beat=next_beat, candidateTurns=index),
                        )
                    )
                    assert result.text == item.characterLine
                    assert result.director.matchedAnswerType == item.expectedAnswerType
                    assert result.director.nextBeat == item.expectedNextBeat
                    assert await speech.synthesize(
                        SpeechRequest(text=result.text, scenarioId=session.scenarioId)
                    )
                    transcript.append(
                        _turn(index * 2 + 1, "character", result.text, index * 10 + 5)
                    )
                    next_beat = result.director.nextBeat
                assert result.ended is True
                assert result.stage == "finished"

    asyncio.run(replay_all())


def test_cassette_keys_change_with_every_relevant_input() -> None:
    base = GatewayRequest(
        task=TaskName.SIMULATION_ACTOR,
        prompt=ROOT_PROMPT.read_text(encoding="utf-8"),
        payload={"state": {"beat": "opening", "candidateTurns": 1}},
        output_schema=ActorOutput,
    )
    changed_state = GatewayRequest(
        task=base.task,
        prompt=base.prompt,
        payload={"state": {"beat": "trust", "candidateTurns": 2}},
        output_schema=ActorOutput,
    )
    assert cassette_key(base, Provider.OPENAI, "gpt-6-luna") != cassette_key(
        changed_state, Provider.OPENAI, "gpt-6-luna"
    )
    assert cassette_key(base, Provider.OPENAI, "gpt-6-luna") != cassette_key(
        base, Provider.OPENAI, "gpt-6-sol"
    )

    media = MediaRequest(
        task=TaskName.SPEECH,
        operation="speech",
        content=b"first synthetic line",
        content_type="text/plain; charset=utf-8",
        parameters={"voice": "aura-asteria-en"},
        estimated_units=Decimal("0.02"),
    )
    changed_text = MediaRequest(
        task=media.task,
        operation=media.operation,
        content=b"second synthetic line",
        content_type=media.content_type,
        parameters=media.parameters,
        estimated_units=media.estimated_units,
    )
    assert cassette_key(media, Provider.DEEPGRAM, "aura-2-thalia-en") != cassette_key(
        changed_text, Provider.DEEPGRAM, "aura-2-thalia-en"
    )
