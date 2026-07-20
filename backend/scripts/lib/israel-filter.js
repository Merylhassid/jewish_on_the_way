'use strict';

/*
 * Shared Israel-only scope for the restaurant enrichment pipeline.
 * A restaurant is "in Israel" if its destination.country = 'Israel', or (when it
 * has no destination) restaurants.country = 'Israel'.
 *
 * Usage in a query: alias restaurants as `r`, LEFT JOIN destinations as `d`:
 *   select ... from restaurants r ${ISRAEL_JOIN} where ${ISRAEL_WHERE} ...
 */
const ISRAEL_JOIN = `left join destinations d on d.id = r."destinationId"`;
const ISRAEL_WHERE = `(d.country = 'Israel' OR (r."destinationId" IS NULL AND r.country = 'Israel'))`;

module.exports = { ISRAEL_JOIN, ISRAEL_WHERE };
