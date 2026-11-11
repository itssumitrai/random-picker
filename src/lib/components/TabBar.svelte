<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus } from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { WheelCategory } from '#lib/randomizer.svelte';

	interface Props {
		categories: WheelCategory[];
		selectedId: string;
	}

	let { categories, selectedId }: Props = $props();

	let track = $state<HTMLDivElement>();

	$effect(() => {
		// Keep the active tab visible when the strip overflows on small screens.
		selectedId;
		categories.length;
		void tick().then(() => {
			if (!track) return;
			const active = track.querySelector<HTMLElement>('.tab.active');
			if (!active) return;

			const activeRect = active.getBoundingClientRect();
			const trackRect = track.getBoundingClientRect();
			const target =
				track.scrollLeft +
				(activeRect.left - trackRect.left) -
				(track.clientWidth - activeRect.width) / 2;

			track.scrollTo({
				left: Math.max(0, target),
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
					? 'auto'
					: 'smooth'
			});
		});
	});
</script>

<nav class="tabs" aria-label="Wheel categories">
	<div class="track" bind:this={track}>
		{#each categories as category (category.id)}
			<a
				href={resolve(`/?c=${category.id}`)}
				class="tab"
				class:active={category.id === selectedId}
				aria-current={category.id === selectedId ? 'page' : undefined}
			>
				<span class="emoji" aria-hidden="true">{category.emoji}</span>
				<span class="name">{category.name.trim() || 'Untitled'}</span>
			</a>
		{/each}
		<a class="tab add" href={resolve('/settings')} aria-label="Add or edit wheels" title="Add or edit wheels">
			<Plus size={16} strokeWidth={2.2} />
		</a>
	</div>
</nav>

<style>
	.tabs {
		padding: 14px 0 4px;
	}

	.track {
		display: flex;
		align-items: center;
		gap: 7px;
		overflow-x: auto;
		padding: 4px;
		scrollbar-width: none;
	}

	.track::-webkit-scrollbar {
		display: none;
	}

	.tab {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 40px;
		padding: 0 15px;
		border: 1px solid transparent;
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		font-size: 13.5px;
		font-weight: 650;
		letter-spacing: -0.01em;
		transition:
			background 0.18s ease,
			color 0.18s ease,
			border-color 0.18s ease,
			box-shadow 0.18s ease;
	}

	.tab:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	.tab.active {
		background: var(--surface);
		border-color: color-mix(in oklab, var(--accent) 30%, var(--border));
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}

	.emoji {
		font-size: 15px;
		line-height: 1;
	}

	.add {
		width: 40px;
		padding: 0;
		justify-content: center;
		border: 1px dashed var(--border-strong);
		color: var(--text-tertiary);
	}

	.add:hover {
		border-color: color-mix(in oklab, var(--accent) 55%, var(--border));
		color: var(--accent);
	}

	@media (max-width: 640px) {
		.tabs {
			margin-inline: -16px;
		}

		.track {
			padding: 4px 16px;
			scroll-padding-inline: 16px;
		}
	}

	@media (min-width: 900px) {
		.track {
			justify-content: center;
		}
	}
</style>
