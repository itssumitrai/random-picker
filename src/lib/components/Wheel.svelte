<script lang="ts">
	import {
		TAU,
		makeWheelPalette,
		normalizeAngle,
		randomFloat,
		randomInt,
		readableText
	} from '#lib/palette';
	import type { WheelOption } from '#lib/randomizer.svelte';

	interface Props {
		options: WheelOption[];
		accent: string;
		emoji: string;
	}

	let { options, accent, emoji }: Props = $props();

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let pointer: HTMLDivElement;

	let size = $state(0);
	let rotation = $state(0);
	let isDark = $state(false);
	let fontsReady = $state(false);

	let animating = false;
	let frame = 0;
	let cancelSpin: ((index: number) => void) | null = null;

	const palette = $derived(makeWheelPalette(accent, options.length, isDark));

	$effect(() => {
		const root = document.documentElement;
		const sync = () => {
			isDark = root.dataset.theme === 'dark';
		};
		sync();

		const observer = new MutationObserver(sync);
		observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) size = entry.contentRect.width;
		});
		observer.observe(container);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (typeof document === 'undefined' || !document.fonts) {
			fontsReady = true;
			return;
		}
		document.fonts.ready.then(() => {
			fontsReady = true;
		});
	});

	$effect(() => {
		// Track every input that changes the drawing.
		size;
		palette;
		rotation;
		isDark;
		fontsReady;
		draw();
	});

	$effect(() => {
		return () => {
			cancelAnimationFrame(frame);
			cancelSpin?.(-1);
			cancelSpin = null;
		};
	});

	function fitText(
		context: CanvasRenderingContext2D,
		text: string,
		maxWidth: number
	): string {
		if (maxWidth <= 0) return '';
		if (context.measureText(text).width <= maxWidth) return text;

		let low = 0;
		let high = text.length;
		while (low < high) {
			const middle = Math.ceil((low + high) / 2);
			const candidate = `${text.slice(0, middle).trimEnd()}…`;
			if (context.measureText(candidate).width <= maxWidth) {
				low = middle;
			} else {
				high = middle - 1;
			}
		}

		return low > 0 ? `${text.slice(0, low).trimEnd()}…` : '…';
	}

	function draw(): void {
		if (!canvas || size < 20) return;

		const context = canvas.getContext('2d');
		if (!context) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 3);
		const pixelSize = Math.round(size * dpr);

		if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
			canvas.width = pixelSize;
			canvas.height = pixelSize;
		}

		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.clearRect(0, 0, size, size);

		const center = size / 2;
		const radius = size / 2 - Math.max(5, size * 0.015);
		const styles = getComputedStyle(document.documentElement);
		const background = styles.getPropertyValue('--bg').trim() || '#f4f4f7';
		const surface = styles.getPropertyValue('--surface').trim() || '#ffffff';
		const border =
			styles.getPropertyValue('--border-strong').trim() || 'rgba(0, 0, 0, 0.16)';
		const count = options.length;

		context.beginPath();
		context.arc(center, center, radius, 0, TAU);
		context.fillStyle = surface;
		context.fill();

		if (count === 0) {
			context.beginPath();
			context.arc(center, center, radius * 0.55, 0, TAU);
			context.strokeStyle = border;
			context.lineWidth = 2;
			context.setLineDash([6, 8]);
			context.stroke();
			context.setLineDash([]);
			return;
		}

		const segment = TAU / count;
		const wheelRadius = radius - Math.max(3, size * 0.008);

		for (let index = 0; index < count; index += 1) {
			const start = rotation + index * segment;
			context.beginPath();
			context.moveTo(center, center);
			context.arc(center, center, wheelRadius, start, start + segment);
			context.closePath();
			context.fillStyle = palette[index] ?? accent;
			context.fill();
		}

		context.strokeStyle = background;
		context.lineWidth = Math.max(1.5, size * 0.0045);
		for (let index = 0; index < count; index += 1) {
			const angle = rotation + index * segment;
			context.beginPath();
			context.moveTo(center, center);
			context.lineTo(
				center + Math.cos(angle) * wheelRadius,
				center + Math.sin(angle) * wheelRadius
			);
			context.stroke();
		}

		const gloss = context.createRadialGradient(
			center,
			center,
			wheelRadius * 0.12,
			center,
			center,
			wheelRadius
		);
		gloss.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
		gloss.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
		gloss.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
		context.beginPath();
		context.arc(center, center, wheelRadius, 0, TAU);
		context.fillStyle = gloss;
		context.fill();

		context.beginPath();
		context.arc(center, center, radius - 0.75, 0, TAU);
		context.strokeStyle = border;
		context.lineWidth = 1;
		context.stroke();

		const hubRadius = wheelRadius * 0.19;
		const labelInset = Math.max(10, size * 0.03);
		const labelMax = wheelRadius - hubRadius - labelInset - 6;
		const fontSize = Math.min(20, Math.max(9.5, wheelRadius * 0.062));

		context.font = `600 ${fontSize}px "Plus Jakarta Sans Variable", system-ui, sans-serif`;
		context.textBaseline = 'middle';

		for (let index = 0; index < count; index += 1) {
			const color = palette[index] ?? accent;
			const label = options[index]?.label.trim() || 'Untitled';
			const fitted = fitText(context, label, Math.max(24, labelMax));
			const middle = rotation + index * segment + segment / 2;
			const flip = Math.cos(middle) < 0;
			const edge = wheelRadius - labelInset;

			context.save();
			context.translate(center, center);
			context.rotate(middle + (flip ? Math.PI : 0));
			context.fillStyle = readableText(color);
			context.textAlign = flip ? 'left' : 'right';
			context.shadowColor = 'rgba(0, 0, 0, 0.22)';
			context.shadowBlur = 3;
			context.shadowOffsetY = 1;
			context.fillText(fitted, flip ? -edge : edge, 0);
			context.restore();
		}

		context.save();
		context.shadowColor = 'rgba(0, 0, 0, 0.22)';
		context.shadowBlur = size * 0.035;
		context.shadowOffsetY = size * 0.008;
		context.beginPath();
		context.arc(center, center, hubRadius, 0, TAU);
		context.fillStyle = surface;
		context.fill();
		context.restore();

		context.beginPath();
		context.arc(center, center, hubRadius, 0, TAU);
		context.strokeStyle = border;
		context.lineWidth = 1.5;
		context.stroke();

		context.font = `${hubRadius * 0.92}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(emoji || '🎲', center, center + hubRadius * 0.05);
	}

	export function spin(): Promise<number> {
		const count = options.length;
		if (animating || count < 2) return Promise.resolve(-1);

		animating = true;

		const segment = TAU / count;
		const winner = randomInt(count);
		const jitter = (randomFloat() - 0.5) * segment * 0.62;
		const pointerAngle = -Math.PI / 2;
		const targetCenter = winner * segment + segment / 2 + jitter;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const turns = reducedMotion ? 1 : 4 + randomInt(3);
		const targetRotation = pointerAngle - targetCenter;
		const delta = normalizeAngle(targetRotation - rotation) + TAU * turns;
		const duration = reducedMotion ? 750 : 3100 + randomFloat() * 500;
		const startRotation = rotation;
		const startedAt = performance.now();

		let lastIndex = -1;
		let kick = 0;

		return new Promise<number>((resolve) => {
			cancelSpin = resolve;

			const step = (now: number) => {
				const progress = Math.min(1, (now - startedAt) / duration);
				const eased = 1 - (1 - progress) ** 2;
				rotation = startRotation + delta * eased;

				const index =
					Math.floor(normalizeAngle(pointerAngle - rotation) / segment) % count;
				if (index !== lastIndex) {
					lastIndex = index;
					kick = 1;
				} else {
					kick *= 0.86;
				}
				if (pointer) pointer.style.setProperty('--kick', kick.toFixed(3));

				if (progress < 1) {
					frame = requestAnimationFrame(step);
				} else {
					rotation = normalizeAngle(startRotation + delta);
					animating = false;
					cancelSpin = null;
					pointer?.style.setProperty('--kick', '0');
					resolve(winner);
				}
			};

			frame = requestAnimationFrame(step);
		});
	}

	const ariaLabel = $derived(
		options.length
			? `Wheel with ${options.length} options: ${options.map((item) => item.label).join(', ')}`
			: 'Empty wheel'
	);
</script>

<div class="wheel" bind:this={container} role="img" aria-label={ariaLabel}>
	<canvas bind:this={canvas}></canvas>
	<div class="pointer" bind:this={pointer} aria-hidden="true">
		<svg viewBox="0 0 36 48" focusable="false">
			<defs>
				<linearGradient id="spindle-pointer" x1="0" y1="0" x2="1" y2="1">
					<stop
						offset="0%"
						stop-color="color-mix(in oklab, var(--accent) 72%, white)"
					/>
					<stop offset="100%" stop-color="var(--accent)" />
				</linearGradient>
			</defs>
			<path
				d="M18 46 L3.5 16.5 A14.5 14.5 0 1 1 32.5 16.5 Z"
				fill="url(#spindle-pointer)"
				stroke="var(--surface)"
				stroke-width="2.5"
			/>
			<circle cx="18" cy="15" r="4" fill="#fff" fill-opacity="0.9" />
		</svg>
	</div>
</div>

<style>
	.wheel {
		position: relative;
		width: var(--wheel-size);
		max-width: 100%;
		aspect-ratio: 1;
		margin: 0 auto;
		filter: drop-shadow(
			0 26px 52px color-mix(in oklab, var(--accent) 22%, transparent)
		);
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.pointer {
		position: absolute;
		top: -1.2%;
		left: 50%;
		width: clamp(26px, 7.2%, 40px);
		transform: translateX(-50%) rotate(calc(var(--kick, 0) * -7deg));
		transform-origin: 50% 16%;
		z-index: 2;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.24));
		will-change: transform;
	}

	.pointer svg {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
