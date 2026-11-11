export const TAU = Math.PI * 2;

export function normalizeAngle(angle: number): number {
	return ((angle % TAU) + TAU) % TAU;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function hexToHsl(hex: string): [number, number, number] {
	const clean = hex.replace('#', '').trim();
	const full =
		clean.length === 3
			? clean
					.split('')
					.map((char) => char + char)
					.join('')
			: clean.padEnd(6, '0').slice(0, 6);

	const r = parseInt(full.slice(0, 2), 16) / 255;
	const g = parseInt(full.slice(2, 4), 16) / 255;
	const b = parseInt(full.slice(4, 6), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	const lightness = (max + min) / 2;

	let hue = 0;
	let saturation = 0;

	if (delta !== 0) {
		saturation = delta / (1 - Math.abs(2 * lightness - 1));
		switch (max) {
			case r:
				hue = ((g - b) / delta) % 6;
				break;
			case g:
				hue = (b - r) / delta + 2;
				break;
			default:
				hue = (r - g) / delta + 4;
		}
		hue *= 60;
		if (hue < 0) hue += 360;
	}

	return [hue, saturation * 100, lightness * 100];
}

export function hslToHex(hue: number, saturation: number, lightness: number): string {
	const h = ((hue % 360) + 360) % 360;
	const s = clamp(saturation, 0, 100) / 100;
	const l = clamp(lightness, 0, 100) / 100;

	const a = s * Math.min(l, 1 - l);
	const channel = (n: number) => {
		const k = (n + h / 30) % 12;
		const value = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
		return Math.round(value * 255)
			.toString(16)
			.padStart(2, '0');
	};

	return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * Builds a cohesive, high-contrast palette for the wheel. Hues are spread with
 * the golden angle so neighbouring slices always stay distinguishable.
 */
export function makeWheelPalette(accent: string, count: number, dark: boolean): string[] {
	if (count <= 0) return [];

	const [baseHue, baseSaturation] = hexToHsl(accent);
	const saturation = dark
		? clamp(baseSaturation, 50, 74)
		: clamp(baseSaturation, 56, 80);
	const lightness = dark ? 47 : 61;

	return Array.from({ length: count }, (_, index) => {
		const hue = (baseHue + index * 137.508) % 360;
		const variation = index % 2 === 0 ? 3 : -3;
		const satVariation = index % 4 === 0 ? -4 : 0;
		return hslToHex(hue, saturation + satVariation, lightness + variation);
	});
}

export function relativeLuminance(hex: string): number {
	const clean = hex.replace('#', '');
	const full =
		clean.length === 3
			? clean
					.split('')
					.map((char) => char + char)
					.join('')
			: clean.padEnd(6, '0').slice(0, 6);

	const channels = [0, 2, 4].map((offset) => {
		const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function readableText(hex: string): '#ffffff' | '#1a1a22' {
	return relativeLuminance(hex) > 0.46 ? '#1a1a22' : '#ffffff';
}

export function randomFloat(): number {
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		const buffer = new Uint32Array(1);
		crypto.getRandomValues(buffer);
		return buffer[0] / 2 ** 32;
	}
	return Math.random();
}

export function randomInt(max: number): number {
	if (max <= 0) return 0;
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		const buffer = new Uint32Array(1);
		crypto.getRandomValues(buffer);
		return buffer[0] % max;
	}
	return Math.floor(Math.random() * max);
}
