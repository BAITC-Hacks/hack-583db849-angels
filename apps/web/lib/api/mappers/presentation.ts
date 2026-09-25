import type { components } from '@invision/api-client';
import type { Presentation } from '../../presentation/types';

type WirePresentation = components['schemas']['PresentationDto'];

/** The staff fields arrive only for staff, and stay absent here otherwise. */
export function toPresentation(wire: WirePresentation): Presentation {
  const presentation: Presentation = {
    presentationId: wire.presentationId,
    candidateId: wire.candidateId,
    status: wire.status,
    prompt: wire.prompt,
    durationSec: wire.durationSec,
    submittedAt: wire.submittedAt,
  };
  if (wire.segments !== undefined) presentation.segments = wire.segments;
  if (wire.videoAvailable !== undefined) presentation.videoAvailable = wire.videoAvailable;
  return presentation;
}
