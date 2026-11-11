import { browser } from '$app/env';
import { loadData, saveData, type StorageSource } from '#lib/storage';

export const MAX_OPTIONS = 30;
export const MAX_CATEGORIES = 40;
export const MAX_LABEL_LENGTH = 80;

export interface WheelOption {
	id: string;
	label: string;
}

export interface WheelCategory {
	id: string;
	name: string;
	prompt: string;
	emoji: string;
	color: string;
	options: WheelOption[];
}

interface WheelData {
	version: 1;
	categories: WheelCategory[];
}

export const ACCENT_COLORS = [
	'#7c3aed',
	'#4f46e5',
	'#0284c7',
	'#0891b2',
	'#0d9488',
	'#059669',
	'#d97706',
	'#ea580c',
	'#e11d48',
	'#db2777'
];

function option(id: string, label: string): WheelOption {
	return { id, label };
}

export const DEFAULT_CATEGORIES: WheelCategory[] = [
	{
		id: 'movies',
		name: 'Movies',
		prompt: 'What should we watch?',
		emoji: '🎬',
		color: '#7c3aed',
		options: [
			option('movies-1', 'Inception'),
			option('movies-2', 'The Matrix'),
			option('movies-3', 'Interstellar'),
			option('movies-4', 'Parasite'),
			option('movies-5', 'Spirited Away'),
			option('movies-6', 'Whiplash'),
			option('movies-7', 'La La Land'),
			option('movies-8', 'Everything Everywhere')
		]
	},
	{
		id: 'food',
		name: 'Food',
		prompt: 'What should we eat?',
		emoji: '🍜',
		color: '#ea580c',
		options: [
			option('food-1', 'Sushi'),
			option('food-2', 'Tacos'),
			option('food-3', 'Ramen'),
			option('food-4', 'Pizza'),
			option('food-5', 'Thai curry'),
			option('food-6', 'Burgers'),
			option('food-7', 'Shawarma'),
			option('food-8', 'Pasta')
		]
	},
	{
		id: 'weekend',
		name: 'Weekend',
		prompt: 'What should we do?',
		emoji: '🌤️',
		color: '#0d9488',
		options: [
			option('weekend-1', 'Beach day'),
			option('weekend-2', 'Go for a hike'),
			option('weekend-3', 'Road trip'),
			option('weekend-4', 'Visit a museum'),
			option('weekend-5', 'Picnic in the park'),
			option('weekend-6', 'Movie marathon'),
			option('weekend-7', 'Board games'),
			option('weekend-8', 'Sleep in')
		]
	},
	{
		id: 'music',
		name: 'Music',
		prompt: 'What should we listen to?',
		emoji: '🎧',
		color: '#db2777',
		options: [
			option('music-1', 'Lo-fi beats'),
			option('music-2', 'Jazz'),
			option('music-3', 'Synthwave'),
			option('music-4', 'Indie rock'),
			option('music-5', 'Classical'),
			option('music-6', 'Hip-hop'),
			option('music-7', 'Ambient'),
			option('music-8', 'Disco')
		]
	}
];

function cloneDefaults(): WheelCategory[] {
	return structuredClone(DEFAULT_CATEGORIES);
}

export function uid(prefix = 'opt'): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function slugify(input: string): string {
	const slug = input
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return slug || 'wheel';
}

function cleanString(value: unknown, maxLength: number): string {
	return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function sanitizeId(value: unknown): string {
	return cleanString(value, 64)
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function uniqueId(base: string, used: Set<string>): string {
	const root = slugify(base);
	let candidate = root;
	let suffix = 2;
	while (used.has(candidate)) {
		candidate = `${root}-${suffix}`;
		suffix += 1;
	}
	used.add(candidate);
	return candidate;
}

function uniqueOptionId(value: unknown, used: Set<string>): string {
	const candidate = sanitizeId(value);
	if (candidate && !used.has(candidate)) {
		used.add(candidate);
		return candidate;
	}
	let generated = uid('opt');
	while (used.has(generated)) generated = uid('opt');
	used.add(generated);
	return generated;
}

function parseOptions(input: unknown): WheelOption[] {
	if (!Array.isArray(input)) return [];

	const used = new Set<string>();
	const options: WheelOption[] = [];

	for (const raw of input.slice(0, MAX_OPTIONS)) {
		let label = '';
		let id: unknown = '';

		if (typeof raw === 'string') {
			label = raw;
		} else if (raw && typeof raw === 'object') {
			const item = raw as Record<string, unknown>;
			label = cleanString(item.label, MAX_LABEL_LENGTH);
			id = item.id;
		}

		label = label.trim();
		if (!label) continue;

		options.push({ id: uniqueOptionId(id, used), label });
	}

	return options;
}

/**
 * Accepts either a bare category array or an export envelope. Returns null when
 * the payload cannot be understood, so callers can fall back safely.
 */
export function parseWheelData(input: unknown): WheelCategory[] | null {
	let rawCategories: unknown[] | null = null;

	if (Array.isArray(input)) {
		rawCategories = input;
	} else if (input && typeof input === 'object') {
		const container = input as Record<string, unknown>;
		if (Array.isArray(container.categories)) {
			rawCategories = container.categories;
		}
	}

	if (!rawCategories) return null;

	const usedCategoryIds = new Set<string>();
	const categories: WheelCategory[] = [];

	for (const raw of rawCategories.slice(0, MAX_CATEGORIES)) {
		if (!raw || typeof raw !== 'object') continue;

		const item = raw as Record<string, unknown>;
		const name = cleanString(item.name, 48).trim();
		if (!name) continue;

		const id = uniqueId(sanitizeId(item.id) || name, usedCategoryIds);
		const color = cleanString(item.color, 7);
		const emoji = cleanString(item.emoji, 8).trim();

		categories.push({
			id,
			name,
			prompt: cleanString(item.prompt, 90).trim() || "What's the pick?",
			emoji: emoji || '🎲',
			color: /^#[0-9a-f]{6}$/i.test(color)
				? color
				: ACCENT_COLORS[categories.length % ACCENT_COLORS.length],
			options: parseOptions(item.options)
		});
	}

	return categories.length > 0 ? categories : null;
}

export function createExport(categories: WheelCategory[]): string {
	return JSON.stringify(
		{
			app: 'spindle',
			version: 1,
			exportedAt: new Date().toISOString(),
			categories
		},
		null,
		2
	);
}

export function parseImport(text: string): WheelCategory[] {
	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch {
		throw new Error('That file is not valid JSON.');
	}

	const categories = parseWheelData(payload);
	if (!categories) {
		throw new Error('No valid wheels were found in that file.');
	}
	return categories;
}

class RandomizerStore {
	categories = $state<WheelCategory[]>([]);
	ready = $state(false);
	storage = $state<StorageSource>('memory');

	#initPromise: Promise<void> | null = null;
	#writeChain: Promise<void> = Promise.resolve();

	init(): Promise<void> {
		if (!browser || this.ready) return Promise.resolve();
		if (!this.#initPromise) {
			this.#initPromise = this.#load();
		}
		return this.#initPromise;
	}

	async #load(): Promise<void> {
		try {
			const { data, source } = await loadData();
			this.storage = source;

			const parsed = data === undefined ? null : parseWheelData(data);
			if (parsed) {
				this.categories = parsed;
			} else {
				this.categories = cloneDefaults();
				this.persist();
			}
		} catch {
			this.categories = cloneDefaults();
			this.storage = 'memory';
		} finally {
			this.ready = true;
		}
	}

	persist(): void {
		if (!browser) return;

		const payload: WheelData = {
			version: 1,
			categories: $state.snapshot(this.categories)
		};

		this.#writeChain = this.#writeChain
			.then(async () => {
				this.storage = await saveData(payload, this.storage);
			})
			.catch(() => {
				this.storage = 'memory';
			});
	}

	getCategory(id: string | null | undefined): WheelCategory | undefined {
		if (!id) return undefined;
		return this.categories.find((category) => category.id === id);
	}

	addCategory(): WheelCategory {
		const used = new Set(this.categories.map((category) => category.id));
		const id = uniqueId('new-wheel', used);

		const category: WheelCategory = {
			id,
			name: 'New wheel',
			prompt: "What's the pick?",
			emoji: '🎲',
			color: ACCENT_COLORS[this.categories.length % ACCENT_COLORS.length],
			options: [option(uid('opt'), 'Option 1'), option(uid('opt'), 'Option 2')]
		};

		this.categories = [...this.categories, category];
		this.persist();
		return category;
	}

	updateCategory(
		id: string,
		patch: Partial<Pick<WheelCategory, 'name' | 'prompt' | 'emoji' | 'color'>>
	): void {
		const category = this.getCategory(id);
		if (!category) return;
		Object.assign(category, patch);
		this.persist();
	}

	deleteCategory(id: string): boolean {
		if (this.categories.length <= 1) return false;
		const next = this.categories.filter((category) => category.id !== id);
		if (next.length === this.categories.length) return false;
		this.categories = next;
		this.persist();
		return true;
	}

	moveCategory(id: string, delta: number): void {
		const index = this.categories.findIndex((category) => category.id === id);
		const target = index + delta;
		if (index < 0 || target < 0 || target >= this.categories.length) return;

		const next = [...this.categories];
		[next[index], next[target]] = [next[target], next[index]];
		this.categories = next;
		this.persist();
	}

	addOption(categoryId: string, label: string): boolean {
		const category = this.getCategory(categoryId);
		const trimmed = label.trim();
		if (!category || !trimmed || category.options.length >= MAX_OPTIONS) return false;

		category.options.push(option(uid('opt'), trimmed));
		this.persist();
		return true;
	}

	updateOption(categoryId: string, optionId: string, label: string): void {
		const category = this.getCategory(categoryId);
		const target = category?.options.find((entry) => entry.id === optionId);
		if (!target) return;
		target.label = label;
		this.persist();
	}

	deleteOption(categoryId: string, optionId: string): void {
		const category = this.getCategory(categoryId);
		if (!category) return;
		category.options = category.options.filter((entry) => entry.id !== optionId);
		this.persist();
	}

	moveOption(categoryId: string, optionId: string, delta: number): void {
		const category = this.getCategory(categoryId);
		if (!category) return;

		const index = category.options.findIndex((entry) => entry.id === optionId);
		const target = index + delta;
		if (index < 0 || target < 0 || target >= category.options.length) return;

		const next = [...category.options];
		[next[index], next[target]] = [next[target], next[index]];
		category.options = next;
		this.persist();
	}

	replaceAll(categories: WheelCategory[]): void {
		this.categories = categories;
		this.persist();
	}

	reset(): void {
		this.categories = cloneDefaults();
		this.persist();
	}
}

export const randomizer = new RandomizerStore();
