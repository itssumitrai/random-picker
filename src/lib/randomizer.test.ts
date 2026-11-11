import { describe, expect, it } from 'vitest';
import {
	MAX_OPTIONS,
	createExport,
	parseImport,
	parseWheelData,
	slugify
} from './randomizer.svelte';

const validCategory = {
	id: 'movies',
	name: 'Movies',
	prompt: 'What should we watch?',
	emoji: '🎬',
	color: '#7c3aed',
	options: [
		{ id: 'movies-1', label: 'Inception' },
		{ id: 'movies-2', label: 'The Matrix' }
	]
};

describe('slugify', () => {
	it('normalises names into ids', () => {
		expect(slugify('Movie Night')).toBe('movie-night');
		expect(slugify('  Café  &  Crêpes  ')).toBe('cafe-crepes');
	});

	it('falls back when nothing usable remains', () => {
		expect(slugify('🎬🎬')).toBe('wheel');
	});
});

describe('parseWheelData', () => {
	it('accepts an export envelope', () => {
		const parsed = parseWheelData({ categories: [validCategory] });
		expect(parsed).toHaveLength(1);
		expect(parsed?.[0].name).toBe('Movies');
		expect(parsed?.[0].options.map((option) => option.label)).toEqual([
			'Inception',
			'The Matrix'
		]);
	});

	it('accepts a bare category array', () => {
		expect(parseWheelData([validCategory])).toHaveLength(1);
	});

	it('returns null for unreadable payloads', () => {
		expect(parseWheelData(null)).toBeNull();
		expect(parseWheelData({ nope: true })).toBeNull();
		expect(parseWheelData([])).toBeNull();
	});

	it('drops categories without a name and options without a label', () => {
		const parsed = parseWheelData([
			{ ...validCategory, name: '   ' },
			{
				...validCategory,
				options: [{ id: 'a', label: '  ' }, { id: 'b', label: 'Kept' }, 'Also kept']
			}
		]);
		expect(parsed).toHaveLength(1);
		expect(parsed?.[0].options.map((option) => option.label)).toEqual(['Kept', 'Also kept']);
	});

	it('rejects invalid colours and falls back to a palette accent', () => {
		const parsed = parseWheelData([{ ...validCategory, color: 'red' }]);
		expect(parsed?.[0].color).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('de-duplicates ids and generates missing ones', () => {
		const parsed = parseWheelData([
			validCategory,
			{ ...validCategory, name: 'Movies again' }
		]);
		expect(parsed?.[0].id).not.toBe(parsed?.[1].id);

		const options = parseWheelData([
			{
				...validCategory,
				options: [
					{ id: 'same', label: 'One' },
					{ id: 'same', label: 'Two' },
					{ label: 'Three' }
				]
			}
		])?.[0].options;
		expect(new Set(options?.map((option) => option.id)).size).toBe(3);
	});

	it('caps the number of options', () => {
		const options = Array.from({ length: MAX_OPTIONS + 10 }, (_, index) => ({
			id: `option-${index}`,
			label: `Option ${index}`
		}));
		expect(parseWheelData([{ ...validCategory, options }])?.[0].options).toHaveLength(MAX_OPTIONS);
	});
});

describe('export / import', () => {
	it('round-trips categories through JSON', () => {
		const parsed = parseWheelData([validCategory]);
		expect(parsed).not.toBeNull();

		const exported = createExport(parsed!);
		const envelope = JSON.parse(exported) as Record<string, unknown>;
		expect(envelope.app).toBe('spindle');
		expect(envelope.version).toBe(1);
		expect(typeof envelope.exportedAt).toBe('string');

		const imported = parseImport(exported);
		expect(imported[0].name).toBe('Movies');
		expect(imported[0].options).toHaveLength(2);
	});

	it('rejects invalid JSON', () => {
		expect(() => parseImport('not json')).toThrow(/valid JSON/i);
	});

	it('rejects JSON without wheels', () => {
		expect(() => parseImport('{"hello":"world"}')).toThrow(/no valid wheels/i);
	});
});
