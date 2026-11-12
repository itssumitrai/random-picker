<script lang="ts">
	import '@fontsource-variable/plus-jakarta-sans';
	import '../app.css';

	import { browser } from '$app/env';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Moon, Settings, Sun } from '@lucide/svelte';
	import Logo from '#lib/components/Logo.svelte';
	import { randomizer } from '#lib/randomizer.svelte';
	import { theme } from '#lib/theme.svelte';

	let { children } = $props();

	if (browser) {
		theme.init();
		randomizer.init();
	}

	// Pick up edits made on other devices when the user comes back to this tab.
	function onVisibilityChange(): void {
		if (document.visibilityState === 'visible') randomizer.refresh();
	}

	const isSettings = $derived(page.url.pathname.startsWith('/settings'));
	const title = $derived(isSettings ? 'Settings · Spindle' : 'Spindle — Let chance decide');
</script>

<svelte:document onvisibilitychange={onVisibilityChange} />

<svelte:head>
	<title>{title}</title>
	<meta
		name="description"
		content="Spindle is a beautiful, physics-powered decision wheel. Spin to pick a movie, meal, plan, or anything else."
	/>
</svelte:head>

<div class="ambient" aria-hidden="true"></div>

<header class="site-header">
	<div class="header-inner">
		<a class="brand" href={resolve('/')} aria-label="Spindle home">
			<Logo size={26} />
			<span>Spindle</span>
		</a>

		<div class="header-actions">
			<button
				class="icon-btn"
				onclick={() => theme.toggle()}
				aria-label={theme.resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
				title={theme.resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
			>
				{#if theme.resolved === 'dark'}
					<Sun size={18} strokeWidth={2.1} />
				{:else}
					<Moon size={18} strokeWidth={2.1} />
				{/if}
			</button>

			<a
				class="icon-btn"
				class:is-active={isSettings}
				href={resolve('/settings')}
				aria-label="Settings"
				title="Settings"
			>
				<Settings size={18} strokeWidth={2.1} />
			</a>
		</div>
	</div>
</header>

<main class="app-main">
	{#if randomizer.ready}
		{@render children()}
	{:else}
		<div class="boot" role="status" aria-live="polite">
			<div class="boot-inner">
				<div class="boot-wheel"></div>
				<span>Shuffling your wheels…</span>
			</div>
		</div>
	{/if}
</main>

<footer class="site-footer">
	<span>Spindle</span>
	<span class="dot" aria-hidden="true"></span>
	<span>Let chance decide.</span>
</footer>
