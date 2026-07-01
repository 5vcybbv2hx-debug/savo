/**
 * adaptiveFetch.js
 * Self-scaling pagination helper for date-sorted (descending) entity queries.
 *
 * Problem this solves: hardcoded limits (e.g. `.list('-date', 500)`) silently
 * truncate older data once a table grows past that number — we hit this for
 * real with TimeEntry (634 records) and ClockEntry (461 records). Bumping the
 * number (500 -> 3000) is a band-aid that will break again in a year or two.
 *
 * This helper instead starts with a modest limit and DOUBLES it automatically
 * until either (a) there's simply no more data left, or (b) the fetched batch
 * already reaches back further than the date range we need. That means it
 * scales forever without ever needing a manual number bump again — recent
 * months stay cheap (one fetch), and it only pays the cost of extra fetches
 * for old months on a huge table, which is rare and appropriate.
 *
 * @param {(limit: number) => Promise<any[]>} fetchFn
 *   Calls the entity's `.list(...)` / `.filter(...)` with the given limit,
 *   sorted descending by the date field (e.g. `(limit) => TimeEntry.list('-date', limit)`).
 * @param {string} from - inclusive lower bound, ISO date string (e.g. '2026-06-01')
 * @param {string} to   - inclusive upper bound, ISO date string (e.g. '2026-06-30')
 * @param {object} [opts]
 * @param {number} [opts.startLimit=500]   - first batch size to try
 * @param {number} [opts.maxLimit=20000]   - hard safety cap (~20k records)
 * @param {(item:any) => string} [opts.getDate] - extracts the date string from a record (default: item.date)
 * @returns {Promise<any[]>} all records with date in [from, to]
 */
export async function fetchUntilDateCovered(fetchFn, from, to, opts = {}) {
    const {
        startLimit = 500,
        maxLimit = 20000,
        getDate = (item) => item.date,
    } = opts;

    let limit = startLimit;
    let batch = [];

    while (limit <= maxLimit) {
        batch = await fetchFn(limit);

        const noMoreData = batch.length < limit; // fetched everything there is
        const oldestDate = batch.length ? getDate(batch[batch.length - 1]) : null;
        const rangeCovered = oldestDate != null && oldestDate < from; // batch already reaches before target range

        if (noMoreData || rangeCovered) break;

        limit *= 2;
    }

    return batch.filter((item) => {
        const d = getDate(item);
        return d != null && d >= from && d <= to;
    });
}
