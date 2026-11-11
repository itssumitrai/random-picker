export type StorageSource = 'indexeddb' | 'localstorage' | 'memory';

export interface LoadResult {
	data: unknown;
	source: StorageSource;
}

const DB_NAME = 'spindle';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const DATA_KEY = 'wheels';
const LOCAL_KEY = 'spindle.data.v1';

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
 * Loads the saved state, preferring IndexedDB. A previous localStorage save is
 * migrated automatically, and localStorage remains the fallback when
 * IndexedDB is blocked (private browsing, strict storage policies, etc.).
 */
export async function loadData(): Promise<LoadResult> {
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

export async function saveData(
	data: unknown,
	preferred: StorageSource
): Promise<StorageSource> {
	if (preferred !== 'localstorage') {
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

export function storageLabel(source: StorageSource): string {
	switch (source) {
		case 'indexeddb':
			return 'IndexedDB';
		case 'localstorage':
			return 'local storage';
		default:
			return 'temporary memory';
	}
}
