import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
	data: undefined as unknown,
	online: true,
	writes: [] as unknown[]
}));

vi.mock('#lib/remote', () => ({
	remoteEnabled: true,
	readRemote: async () => {
		if (!server.online) throw new Error('offline');
		return server.data;
	},
	writeRemote: async (data: unknown) => {
		if (!server.online) throw new Error('offline');
		server.writes.push(data);
		server.data = data;
	}
}));

const { hasUnsyncedChanges, loadData, saveData } = await import('./storage');

const LOCAL_KEY = 'spindle.data.v1';
const localCopy = { version: 1, categories: ['local'] };
const sharedCopy = { version: 1, categories: ['shared'] };

beforeEach(() => {
	const items = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
		removeItem: (key: string) => void items.delete(key)
	});
	server.data = undefined;
	server.online = true;
	server.writes = [];
});

describe('shared database sync', () => {
	it('prefers the server copy and caches it locally', async () => {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(localCopy));
		server.data = sharedCopy;

		expect(await loadData()).toEqual({ data: sharedCopy, source: 'server' });
		expect(JSON.parse(localStorage.getItem(LOCAL_KEY)!)).toEqual(sharedCopy);
		expect(server.writes).toEqual([]);
	});

	it('seeds an empty server with this browser’s wheels', async () => {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(localCopy));

		expect(await loadData()).toEqual({ data: localCopy, source: 'server' });
		expect(server.writes).toEqual([localCopy]);
	});

	it('falls back to the local copy when the server is unreachable', async () => {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(localCopy));
		server.online = false;

		expect(await loadData()).toEqual({ data: localCopy, source: 'offline' });
	});

	it('pushes edits made offline once the server is back', async () => {
		server.data = sharedCopy;
		server.online = false;

		expect(await saveData(localCopy)).toBe('offline');
		expect(hasUnsyncedChanges()).toBe(true);

		server.online = true;
		expect(await loadData()).toEqual({ data: localCopy, source: 'server' });
		expect(server.data).toEqual(localCopy);
		expect(hasUnsyncedChanges()).toBe(false);
	});
});
