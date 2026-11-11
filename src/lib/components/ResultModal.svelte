<script lang="ts">
	import { Check, RotateCw, X } from '@lucide/svelte';
	import type confetti from 'canvas-confetti';
	import { makeWheelPalette } from '#lib/palette';

	interface Props {
		open: boolean;
		label: string;
		emoji: string;
		categoryName: string;
		accent: string;
		onclose: () => void;
		onspinagain: () => void;
	}

	let { open, label, emoji, categoryName, accent, onclose, onspinagain }: Props = $props();

	type ConfettiInstance = ReturnType<typeof confetti.create>;

	let dialog: HTMLDialogElement;
	let confettiCanvas: HTMLCanvasElement;
	let spinAgainButton: HTMLButtonElement;
	let confettiInstance: ConfettiInstance | null = null;
	let timers: ReturnType<typeof setTimeout>[] = [];

	$effect(() => {
		if (!dialog) return;

		if (open && !dialog.open) {
			dialog.showModal();
			requestAnimationFrame(() => {
				spinAgainButton?.focus();
				celebrate();
			});
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	$effect(() => {
		return () => cleanup();
	});

	async function celebrate(): Promise<void> {
		if (!confettiCanvas || !dialog?.open) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const { default: confettiModule } = await import('canvas-confetti');
		if (!dialog.open || !confettiCanvas) return;

		confettiInstance = confettiModule.create(confettiCanvas, {
			resize: true,
			useWorker: false
		});

		const colors = [...makeWheelPalette(accent, 6, false), '#ffffff'];

		confettiInstance({
			particleCount: 110,
			spread: 78,
			startVelocity: 42,
			origin: { x: 0.5, y: 0.56 },
			colors,
			scalar: 1.05,
			ticks: 240,
			disableForReducedMotion: true
		});

		timers.push(
			setTimeout(() => {
				confettiInstance?.({
					particleCount: 55,
					angle: 60,
					spread: 55,
					origin: { x: 0, y: 0.82 },
					colors,
					ticks: 200
				});
			}, 140)
		);

		timers.push(
			setTimeout(() => {
				confettiInstance?.({
					particleCount: 55,
					angle: 120,
					spread: 55,
					origin: { x: 1, y: 0.82 },
					colors,
					ticks: 200
				});
			}, 210)
		);
	}

	function cleanup(): void {
		for (const timer of timers) clearTimeout(timer);
		timers = [];
		confettiInstance?.reset();
		confettiInstance = null;
	}

	function close(): void {
		onclose();
	}

	function handleClose(): void {
		cleanup();
		if (open) onclose();
	}

	function spinAgain(): void {
		close();
		onspinagain();
	}
</script>

<dialog
	bind:this={dialog}
	class="result-dialog"
	style={`--accent: ${accent}`}
	aria-labelledby="result-title"
	onclose={handleClose}
>
	<div class="backdrop" onclick={close} aria-hidden="true"></div>
	<canvas class="confetti" bind:this={confettiCanvas} aria-hidden="true"></canvas>

	<div class="result-card" role="document">
		<button class="close" onclick={close} aria-label="Close result">
			<X size={17} strokeWidth={2.2} />
		</button>

		<p class="kicker">The wheel has spoken</p>
		<div class="result-emoji" aria-hidden="true">{emoji}</div>
		<h2 id="result-title">{label}</h2>
		<p class="source">from <strong>{categoryName}</strong></p>

		<div class="actions">
			<button class="btn btn-primary" bind:this={spinAgainButton} onclick={spinAgain}>
				<RotateCw size={17} strokeWidth={2.2} />
				Spin again
			</button>
			<button class="btn btn-secondary" onclick={close}>
				<Check size={17} strokeWidth={2.2} />
				Done
			</button>
		</div>
	</div>
</dialog>

<style>
	.result-dialog {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 16px;
		border: 0;
		background: transparent;
		color: var(--text);
		overflow: hidden;
	}

	.result-dialog::backdrop {
		background: transparent;
	}

	.result-dialog[open] {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		background: rgba(8, 8, 14, 0.48);
		backdrop-filter: blur(16px) saturate(120%);
		-webkit-backdrop-filter: blur(16px) saturate(120%);
		animation: backdrop-in 0.3s ease both;
	}

	.confetti {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 2;
	}

	.result-card {
		position: relative;
		z-index: 3;
		width: min(100%, 450px);
		max-height: calc(100dvh - 32px);
		overflow: auto;
		padding: 38px 34px 30px;
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		background: linear-gradient(
			180deg,
			color-mix(in oklab, var(--surface) 90%, var(--accent)) 0%,
			var(--surface) 58%
		);
		box-shadow: var(--shadow-lg);
		text-align: center;
		animation: card-in 0.5s cubic-bezier(0.16, 0.84, 0.3, 1.04) both;
	}

	.result-card::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(
			120% 58% at 50% 0%,
			color-mix(in oklab, var(--accent) 20%, transparent),
			transparent 68%
		);
		pointer-events: none;
	}

	.result-card > * {
		position: relative;
		z-index: 1;
	}

	.close {
		position: absolute;
		top: 14px;
		right: 14px;
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: 50%;
		background: transparent;
		color: var(--text-tertiary);
		transition:
			background 0.18s ease,
			color 0.18s ease;
	}

	.close:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	.kicker {
		color: var(--text-tertiary);
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	.result-emoji {
		width: 86px;
		height: 86px;
		margin: 20px auto 18px;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in oklab, var(--accent) 24%, var(--border));
		border-radius: 27px;
		background: color-mix(in oklab, var(--accent) 12%, var(--surface));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.18),
			0 16px 30px -18px color-mix(in oklab, var(--accent) 60%, transparent);
		font-size: 42px;
		line-height: 1;
	}

	h2 {
		font-size: clamp(30px, 7vw, 43px);
		font-weight: 800;
		letter-spacing: -0.055em;
		overflow-wrap: anywhere;
	}

	.source {
		margin-top: 10px;
		color: var(--text-secondary);
		font-size: 14px;
	}

	.source strong {
		color: var(--text);
		font-weight: 700;
	}

	.actions {
		display: flex;
		gap: 9px;
		margin-top: 28px;
	}

	.actions .btn {
		flex: 1;
		min-width: 0;
	}

	@keyframes backdrop-in {
		from {
			opacity: 0;
		}
	}

	@keyframes card-in {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.94);
		}
	}

	@media (max-width: 420px) {
		.result-card {
			padding: 34px 22px 24px;
		}

		.actions {
			flex-direction: column-reverse;
		}
	}
</style>
