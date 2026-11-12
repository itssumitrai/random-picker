import { readRemote, remoteEnabled, writeRemote } from '#lib/remote';

type LocalSource = 'indexeddb' | 'localstorage' | 'memory';

/**
 * Where the wheels are saved. `server` and `offline` only occur when a shared
 * database is configured (SYNC_API_URL); `offline` means the server could not be
 * reached and changes are waiting in this browser.
 */
export type StorageSource = LocalSource | 'server' | 'offline';

export interface LoadResult {
	data: unknown;
	source: StorageSource;
}

const DB_NAME = 'spindle';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const DATA_KEY = 'wheels';
const LOCAL_KEY = 'spindle.data.v1';
const UNSYNCED_KEY = 'spindle.unsynced';

let localSource: LocalSource = 'indexeddb';

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
	if (typeof indexedDB === 'undefined') {
		return Promise.reject(new Error('IndexedDB is not available'));
	}

	if (!databasePromise) {
		databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onupgradeneeded = () => {
				const database = request.result;
				if (!database.objectStoreNames.contains(STORE_NAME)) {
					database.createObjectStore(STORE_NAME);
				}
			};

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
			request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked'));
		}).catch((error) => {
			databasePromise = null;
			throw error;
		});
	}

	return databasePromise!;
}

async function readFromIndexedDb(): Promise<unknown> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAME, 'readonly');
		const request = transaction.objectStore(STORE_NAME).get(DATA_KEY);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Could not read data'));
	});
}

async function writeToIndexedDb(value: unknown): Promise<void> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAME, 'readwrite');
		transaction.objectStore(STORE_NAME).put(value, DATA_KEY);
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('Could not save data'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('Could not save data'));
	});
}

function readFromLocalStorage(): unknown {
	if (typeof localStorage === 'undefined') return undefined;
	const raw = localStorage.getItem(LOCAL_KEY);
	if (!raw) return undefined;
	return JSON.parse(raw);
}

function writeToLocalStorage(value: unknown): void {
	if (typeof localStorage === 'undefined') {
		throw new Error('localStorage is not available');
	}
	localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
}

/**
 * Loads this browser's copy, preferring IndexedDB. A previous localStorage save is
 * migrated automatically, and localStorage remains the fallback when
 * IndexedDB is blocked (private browsing, strict storage policies, etc.).
 */
async function loadLocal(): Promise<{ data: unknown; source: LocalSource }> {
	try {
		const data = await readFromIndexedDb();
		if (data !== undefined) {
			return { data, source: 'indexeddb' };
		}

		const fallback = readFromLocalStorage();
		if (fallback !== undefined) {
			await writeToIndexedDb(fallback).catch(() => undefined);
			return { data: fallback, source: 'indexeddb' };
		}

		return { data: undefined, source: 'indexeddb' };
	} catch {
		try {
			return { data: readFromLocalStorage(), source: 'localstorage' };
		} catch {
			return { data: undefined, source: 'memory' };
		}
	}
}

async function saveLocal(data: unknown): Promise<LocalSource> {
	if (localSource !== 'localstorage') {
		try {
			await writeToIndexedDb(data);
			return 'indexeddb';
		} catch {
			// Fall through to localStorage.
		}
	}

	try {
		writeToLocalStorage(data);
		return 'localstorage';
	} catch {
		return 'memory';
	}
}

/** True when this browser holds edits the shared database has not received yet. */
export function hasUnsyncedChanges(): boolean {
	try {
		return localStorage.getItem(UNSYNCED_KEY) === '1';
	} catch {
		return false;
	}
}

function setUnsynced(unsynced: boolean): void {
	try {
		if (unsynced) localStorage.setItem(UNSYNCED_KEY, '1');
		else localStorage.removeItem(UNSYNCED_KEY);
	} catch {
		// Without storage the flag only lives as long as the page does.
	}
}

/**
 * Loads the wheels. With a shared database configured, the server copy wins and is
 * cached locally; this browser's copy is used when the server is unreachable, and
 * is pushed instead when it holds unsynced edits or the server is still empty.
 */
export async function loadData(): Promise<LoadResult> {
	const local = await loadLocal();
	localSource = local.source;
	if (!remoteEnabled) return local;

	try {
		const shared = await readRemote();
		if (local.data !== undefined && (shared === undefined || hasUnsyncedChanges())) {
			await writeRemote(local.data);
			setUnsynced(false);
			return { data: local.data, source: 'server' };
		}
		if (shared !== undefined) {
			localSource = await saveLocal(shared);
		}
		return { data: shared, source: 'server' };
	} catch {
		return { data: local.data, source: 'offline' };
	}
}

/** Fetches the shared copy again, e.g. when the tab regains focus. Throws when offline. */
export async function pullShared(): Promise<unknown> {
	const shared = await readRemote();
	if (shared !== undefined) {
		localSource = await saveLocal(shared);
	}
	return shared;
}

/** Saves locally, then to the shared database when one is configured. */
export async function saveData(data: unknown): Promise<StorageSource> {
	localSource = await saveLocal(data);
	if (!remoteEnabled) return localSource;

	try {
		await writeRemote(data);
		setUnsynced(false);
		return 'server';
	} catch {
		setUnsynced(true);
		return 'offline';
	}
}

export function storageLabel(source: StorageSource): string {
	switch (source) {
		case 'server':
			return 'the shared database';
		case 'offline':
			return 'this browser until the server is back';
		case 'indexeddb':
			return 'IndexedDB';
		case 'localstorage':
			return 'local storage';
		default:
			return 'temporary memory';
	}
}
