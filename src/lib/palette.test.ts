import { describe, expect, it } from 'vitest';
import {
	TAU,
	hexToHsl,
	hslToHex,
	makeWheelPalette,
	normalizeAngle,
	randomInt,
	readableText,
	relativeLuminance
} from './palette';

describe('normalizeAngle', () => {
	it('keeps angles within a single turn', () => {
		expect(normalizeAngle(0)).toBe(0);
		expect(normalizeAngle(TAU)).toBeCloseTo(0);
		expect(normalizeAngle(TAU * 3.5)).toBeCloseTo(TAU * 0.5);
		expect(normalizeAngle(-TAU * 0.25)).toBeCloseTo(TAU * 0.75);
	});
});

describe('hexToHsl / hslToHex', () => {
	it('converts a known colour to HSL', () => {
		const [hue, saturation, lightness] = hexToHsl('#ff0000');
		expect(hue).toBeCloseTo(0);
		expect(saturation).toBeCloseTo(100);
		expect(lightness).toBeCloseTo(50);
	});

	it('round-trips hex colours', () => {
		for (const hex of ['#7c3aed', '#ea580c', '#0d9488', '#db2777', '#ffffff', '#000000']) {
			const [hue, saturation, lightness] = hexToHsl(hex);
			expect(hslToHex(hue, saturation, lightness)).toBe(hex);
		}
	});

	it('expands short hex values', () => {
		expect(hexToHsl('#f00')).toEqual(hexToHsl('#ff0000'));
	});
});

describe('makeWheelPalette', () => {
	it('returns one valid colour per slice', () => {
		const palette = makeWheelPalette('#7c3aed', 8, false);
		expect(palette).toHaveLength(8);
		for (const colour of palette) {
			expect(colour).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	it('returns an empty palette for an empty wheel', () => {
		expect(makeWheelPalette('#7c3aed', 0, false)).toEqual([]);
	});

	it('produces different colours for neighbouring slices', () => {
		const palette = makeWheelPalette('#ea580c', 6, true);
		expect(new Set(palette).size).toBeGreaterThan(4);
	});
});

describe('readableText', () => {
	it('picks dark text on light slices and light text on dark slices', () => {
		expect(readableText('#ffffff')).toBe('#1a1a22');
		expect(readableText('#000000')).toBe('#ffffff');
	});

	it('exposes relative luminance between 0 and 1', () => {
		for (const hex of ['#ffffff', '#000000', '#7c3aed']) {
			const luminance = relativeLuminance(hex);
			expect(luminance).toBeGreaterThanOrEqual(0);
			expect(luminance).toBeLessThanOrEqual(1);
		}
	});
});

describe('randomInt', () => {
	it('stays within bounds', () => {
		for (let index = 0; index < 200; index += 1) {
			const value = randomInt(7);
			expect(Number.isInteger(value)).toBe(true);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(7);
		}
	});

	it('returns 0 for an empty range', () => {
		expect(randomInt(0)).toBe(0);
		expect(randomInt(-3)).toBe(0);
	});
});
