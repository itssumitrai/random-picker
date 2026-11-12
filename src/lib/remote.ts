import { SYNC_API_URL } from '$app/env/public';

/** Row key for the single shared document in `api.app_state`. */
const STATE_KEY = 'wheels';
const TIMEOUT_MS = 6000;

export const remoteEnabled = Boolean(SYNC_API_URL);

function endpoint(query = ''): string {
	return `${SYNC_API_URL}/app_state${query}`;
}

/** Returns the stored document, or undefined when the server has none yet. Throws if unreachable. */
export async function readRemote(): Promise<unknown> {
	const response = await fetch(endpoint(`?key=eq.${STATE_KEY}&select=data`), {
		headers: { Accept: 'application/json' },
		cache: 'no-store',
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (!response.ok) throw new Error(`Server returned ${response.status}`);

	const rows = (await response.json()) as Array<{ data: unknown }>;
	return rows[0]?.data;
}

/** Upserts the whole document. Last write wins. */
export async function writeRemote(data: unknown): Promise<void> {
	const response = await fetch(endpoint(), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Prefer: 'resolution=merge-duplicates,return=minimal'
		},
		body: JSON.stringify({ key: STATE_KEY, data }),
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (!response.ok) throw new Error(`Server returned ${response.status}`);
}
