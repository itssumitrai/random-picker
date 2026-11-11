<script lang="ts">
	import { browser } from '$app/env';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { Dices, LoaderCircle } from '@lucide/svelte';
	import ResultModal from '#lib/components/ResultModal.svelte';
	import TabBar from '#lib/components/TabBar.svelte';
	import Wheel from '#lib/components/Wheel.svelte';
	import { randomizer, type WheelOption } from '#lib/randomizer.svelte';

	const LAST_CATEGORY_KEY = 'spindle.lastCategory';

	let wheelComponent = $state.raw<{ spin(): Promise<number> }>();
	let spinning = $state(false);
	let modalOpen = $state(false);
	let result = $state<WheelOption | null>(null);
	let spinTimer: ReturnType<typeof setTimeout> | undefined;

	const lastCategoryId = browser ? sessionStorage.getItem(LAST_CATEGORY_KEY) : null;

	const category = $derived(
		randomizer.getCategory(page.url.searchParams.get('c')) ??
			randomizer.categories.find((entry) => entry.id === lastCategoryId) ??
			randomizer.categories[0]
	);

	const selectedId = $derived(category?.id ?? '');
	const playableOptions = $derived(
		category?.options.filter((option) => option.label.trim().length > 0) ?? []
	);

	$effect(() => {
		if (!category) return;
		document.documentElement.style.setProperty('--accent', category.color);
	});

	$effect(() => {
		if (!browser || !category) return;
		try {
			sessionStorage.setItem(LAST_CATEGORY_KEY, category.id);
		} catch {
			// Session storage is a convenience only.
		}

		if (page.url.searchParams.get('c') !== category.id) {
			replaceState(`/?c=${category.id}`, {});
		}
	});

	$effect(() => {
		function handleKeydown(event: KeyboardEvent): void {
			if (event.code !== 'Space' || event.repeat || event.defaultPrevented) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;

			const target = event.target as HTMLElement | null;
			if (target?.closest('input, textarea, select, button, a, dialog, [contenteditable="true"]')) {
				return;
			}
			if (spinning || modalOpen || playableOptions.length < 2) return;

			event.preventDefault();
			void spin();
		}

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	$effect(() => {
		return () => clearTimeout(spinTimer);
	});

	async function spin(): Promise<void> {
		if (spinning || modalOpen || !category || playableOptions.length < 2) return;

		modalOpen = false;
		result = null;
		spinning = true;

		const index = await wheelComponent?.spin();
		spinning = false;

		if (index === undefined || index < 0) return;
		const picked = playableOptions[index];
		if (!picked) return;

		result = picked;
		modalOpen = true;
	}

	function closeResult(): void {
		modalOpen = false;
	}

	function spinAgain(): void {
		modalOpen = false;
		clearTimeout(spinTimer);
		spinTimer = setTimeout(() => {
			void spin();
		}, 180);
	}
</script>

<svelte:head>
	<title>{category ? `${category.prompt} · Spindle` : 'Spindle'}</title>
</svelte:head>

{#if !category}
	<section class="empty">
		<div class="empty-card">
			<div class="empty-icon" aria-hidden="true">🎡</div>
			<h1>No wheels yet</h1>
			<p>Create your first wheel and start letting chance decide.</p>
			<a class="btn btn-primary" href="/settings">Open settings</a>
		</div>
	</section>
{:else}
	<section class="stage">
		<TabBar categories={randomizer.categories} selectedId={selectedId} />

		<div class="stage-head">
			<p class="eyebrow">
				<span class="emoji" aria-hidden="true">{category.emoji || '🎲'}</span>
				{category.name.trim() || 'Untitled wheel'}
			</p>
			<h1>{category.prompt.trim() || "What's the pick?"}</h1>
			<p class="sub">
				{playableOptions.length}
				{playableOptions.length === 1 ? 'option' : 'options'} on the wheel
			</p>
		</div>

		<div class="wheel-wrap">
			{#key category.id}
				<Wheel
					bind:this={wheelComponent}
					options={playableOptions}
					accent={category.color}
					emoji={category.emoji}
				/>
			{/key}
		</div>

		<div class="spin-area">
			<button
				class="spin-btn"
				onclick={spin}
				disabled={spinning || playableOptions.length < 2}
				aria-busy={spinning}
			>
				<span class="icon-wrap" aria-hidden="true">
					{#if spinning}
						<span class="loader">
							<LoaderCircle size={21} strokeWidth={2.2} />
						</span>
					{:else}
						<Dices size={21} strokeWidth={2.1} />
					{/if}
				</span>
				<span>{spinning ? 'Spinning…' : 'Spin the wheel'}</span>
			</button>

			{#if playableOptions.length < 2}
				<p class="hint warning">
					{#if category.options.length === 0}
						This wheel has no options yet.
					{:else}
						Add at least two options to make it a real choice.
					{/if}
					<a class="text-link" href="/settings">Edit wheel</a>
				</p>
			{:else}
				<p class="hint">
					<span class="desktop-hint">or press</span>
					<kbd>Space</kbd>
				</p>
			{/if}
		</div>

		<p class="sr-only" aria-live="polite">
			{#if spinning}
				Spinning the wheel
			{:else if result}
				Result: {result.label}
			{/if}
		</p>
	</section>
{/if}

<ResultModal
	open={modalOpen}
	label={result?.label ?? ''}
	emoji={category?.emoji ?? '🎲'}
	categoryName={category?.name ?? ''}
	accent={category?.color ?? '#7c3aed'}
	onclose={closeResult}
	onspinagain={spinAgain}
/>

<style>
	.stage {
		padding: 2px 0 28px;
	}

	.stage-head {
		margin-top: 28px;
		text-align: center;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 6px 13px 6px 9px;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		color: var(--text-secondary);
		font-size: 12.5px;
		font-weight: 700;
		letter-spacing: -0.005em;
	}

	.eyebrow .emoji {
		font-size: 14px;
		line-height: 1;
	}

	h1 {
		max-width: 760px;
		margin: 14px auto 0;
		font-size: clamp(30px, 5.2vw, 48px);
		font-weight: 800;
		letter-spacing: -0.055em;
	}

	.sub {
		margin-top: 10px;
		color: var(--text-tertiary);
		font-size: 13.5px;
	}

	.wheel-wrap {
		margin-top: 34px;
		display: flex;
		justify-content: center;
	}

	.spin-area {
		margin-top: 30px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.spin-btn {
		display: inline-flex;
		align-items: center;
		gap: 14px;
		height: 60px;
		padding: 0 30px 0 8px;
		border: 0;
		border-radius: var(--radius-full);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--accent) 76%, white) 0%,
			var(--accent) 48%,
			color-mix(in oklab, var(--accent) 82%, black) 100%
		);
		color: #fff;
		font-size: 16px;
		font-weight: 750;
		letter-spacing: -0.02em;
		box-shadow:
			0 16px 34px -12px color-mix(in oklab, var(--accent) 72%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.26);
		transition:
			transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1),
			box-shadow 0.25s ease,
			opacity 0.2s ease;
	}

	.spin-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow:
			0 22px 44px -14px color-mix(in oklab, var(--accent) 78%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
	}

	.spin-btn:active:not(:disabled) {
		transform: translateY(0) scale(0.985);
	}

	.spin-btn:disabled {
		opacity: 0.45;
		box-shadow: none;
	}

	.icon-wrap {
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.17);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
	}

	.loader {
		display: grid;
		place-items: center;
		animation: rotate 0.8s linear infinite;
	}

	.hint {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--text-tertiary);
		font-size: 12.5px;
		font-weight: 550;
	}

	.hint.warning {
		flex-wrap: wrap;
		justify-content: center;
		text-align: center;
	}

	kbd {
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-bottom-width: 2px;
		border-radius: 6px;
		background: var(--surface);
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 10.5px;
		font-weight: 700;
	}

	.empty {
		min-height: calc(100dvh - 220px);
		display: grid;
		place-items: center;
		padding: 48px 0;
	}

	.empty-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		max-width: 380px;
		text-align: center;
	}

	.empty-icon {
		width: 92px;
		height: 92px;
		display: grid;
		place-items: center;
		border: 1px solid var(--border);
		border-radius: 30px;
		background: var(--surface);
		box-shadow: var(--shadow-md);
		font-size: 42px;
	}

	.empty-card h1 {
		font-size: clamp(28px, 6vw, 38px);
	}

	.empty-card p {
		color: var(--text-secondary);
		font-size: 14.5px;
		line-height: 1.55;
	}

	.empty-card .btn {
		margin-top: 6px;
	}

	@keyframes rotate {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 640px) {
		.stage-head {
			margin-top: 22px;
		}

		.wheel-wrap {
			margin-top: 28px;
		}

		.spin-area {
			margin-top: 24px;
		}

		.spin-btn {
			height: 56px;
			padding-right: 26px;
			font-size: 15px;
		}

		.icon-wrap {
			width: 42px;
			height: 42px;
		}

		.desktop-hint {
			display: none;
		}

		.hint:not(.warning) {
			display: none;
		}
	}

	/* Short landscape phones: put the prompt beside the wheel so the spin
	   action stays on screen without scrolling. */
	@media (min-width: 700px) and (max-height: 560px) {
		.stage {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-areas:
				'tabs tabs'
				'head wheel'
				'spin wheel';
			column-gap: 32px;
			align-items: center;
			padding-bottom: 12px;
		}

		.stage > :global(.tabs) {
			grid-area: tabs;
			padding: 6px 0 2px;
		}

		.stage-head {
			grid-area: head;
			margin-top: 0;
			text-align: left;
			align-self: end;
		}

		.stage-head h1 {
			margin-left: 0;
			margin-right: 0;
			font-size: clamp(24px, 3.6vw, 34px);
		}

		.wheel-wrap {
			grid-area: wheel;
			margin-top: 10px;
			--wheel-size: min(42vw, 58vh);
		}

		.spin-area {
			grid-area: spin;
			margin-top: 16px;
			align-items: flex-start;
			align-self: start;
		}

		.spin-btn {
			height: 50px;
			padding-right: 22px;
			font-size: 14.5px;
		}

		.icon-wrap {
			width: 38px;
			height: 38px;
		}

		.hint {
			display: none;
		}
	}
</style>
