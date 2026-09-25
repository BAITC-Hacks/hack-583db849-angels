import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';

/**
 * Every id in a path is a UUID. Anything else names nothing, so it is a 404 —
 * not a 500 from the database refusing to compare it with a uuid column.
 */
export const EntityId = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException({ code: 'NOT_FOUND', message: 'Not found.' }),
});
