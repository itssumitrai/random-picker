<script lang="ts">
	import { browser } from '$app/env';
	import {
		ArrowLeft,
		Download,
		FileJson,
		HardDrive,
		Monitor,
		Moon,
		Plus,
		RotateCcw,
		Sun,
		Upload
	} from '@lucide/svelte';
	import { tick } from 'svelte';
	import CategoryEditor from '#lib/components/CategoryEditor.svelte';
	import {
		MAX_CATEGORIES,
		createExport,
		parseImport,
		randomizer,
		type WheelCategory
	} from '#lib/randomizer.svelte';
	import { storageLabel } from '#lib/storage';
	import { theme, type ThemePreference } from '#lib/theme.svelte';

	const THEMES: { value: ThemePreference; label: string; icon: typeof Monitor }[] = [
		{ value: 'system', label: 'System', icon: Monitor },
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon }
	];

	const lastCategoryId = browser ? sessionStorage.getItem('spindle.lastCategory') : null;
	const backHref = lastCategoryId ? `/?c=${encodeURIComponent(lastCategoryId)}` : '/';

	let expandedId = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined;
	let pendingImport = $state<{ categories: WheelCategory[]; fileName: string } | null>(null);
	let importError = $state('');
	let notice = $state('');
	let confirmingReset = $state(false);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	const totalOptions = $derived(
		randomizer.categories.reduce((sum, category) => sum + category.options.length, 0)
	);
	const maxed = $derived(randomizer.categories.length >= MAX_CATEGORIES);
	const pendingCounts = $derived.by(() => {
		if (!pendingImport) return { wheels: 0, options: 0 };
		return {
			wheels: pendingImport.categories.length,
			options: pendingImport.categories.reduce(
				(sum, category) => sum + category.options.length,
				0
			)
		};
	});

	$effect(() => {
		return () => clearTimeout(noticeTimer);
	});

	function flash(message: string): void {
		notice = message;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => {
			notice = '';
		}, 4500);
	}

	function exportBackup(): void {
		importError = '';
		const payload = createExport($state.snapshot(randomizer.categories));
		const blob = new Blob([payload], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');

		anchor.href = url;
		anchor.download = `spindle-wheels-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);

		flash('Backup downloaded.');
	}

	async function handleFileChange(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';

		pendingImport = null;
		importError = '';
		notice = '';

		if (!file) return;

		if (file.size > 2 * 1024 * 1024) {
			importError = 'That backup is larger than 2 MB.';
			return;
		}

		try {
			const text = await file.text();
			pendingImport = { categories: parseImport(text), fileName: file.name };
		} catch (error) {
			importError = error instanceof Error ? error.message : 'Could not read that backup.';
		}
	}

	function confirmImport(): void {
		if (!pendingImport) return;

		const { categories } = pendingImport;
		randomizer.replaceAll(categories);
		pendingImport = null;
		expandedId = null;
		importError = '';
		flash(`Imported ${categories.length} ${categories.length === 1 ? 'wheel' : 'wheels'}.`);
	}

	async function addWheel(): Promise<void> {
		if (maxed) return;

		const category = randomizer.addCategory();
		expandedId = category.id;
		importError = '';
		await tick();

		const element = document.getElementById(`category-body-${category.id}`);
		element?.scrollIntoView({
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
				? 'auto'
				: 'smooth',
			block: 'center'
		});
	}

	function resetAll(): void {
		randomizer.reset();
		expandedId = null;
		confirmingReset = false;
		pendingImport = null;
		importError = '';
		flash('Wheels reset to defaults.');
	}
</script>

<div class="settings">
	<a class="back" href={backHref}>
		<ArrowLeft size={15} strokeWidth={2.2} />
		Back to the wheel
	</a>

	<header class="page-head">
		<h1>Settings</h1>
		<p>Shape your wheels, tune the look, and keep a backup of everything.</p>
	</header>

	<div class="panels">
		<section class="panel">
			<div class="panel-head">
				<h2>Appearance</h2>
				<p>Follow your device, or pin Spindle to light or dark mode.</p>
			</div>

			<div class="theme-switch" role="group" aria-label="Color theme">
				{#each THEMES as choice (choice.value)}
					<button
						class="theme-option"
						class:active={theme.preference === choice.value}
						aria-pressed={theme.preference === choice.value}
						onclick={() => theme.set(choice.value)}
					>
						<choice.icon size={16} strokeWidth={2.1} />
						<span>{choice.label}</span>
					</button>
				{/each}
			</div>
		</section>

		<section class="panel">
			<div class="panel-head">
				<h2>Your data</h2>
				<p>
					Wheels are stored in this browser only. Export a backup to move them to another
					device or keep them safe.
				</p>
			</div>

			<div class="data-stats">
				<div class="stat">
					<strong>{randomizer.categories.length}</strong>
					<span>{randomizer.categories.length === 1 ? 'wheel' : 'wheels'}</span>
				</div>
				<div class="stat-divider" aria-hidden="true"></div>
				<div class="stat">
					<strong>{totalOptions}</strong>
					<span>{totalOptions === 1 ? 'option' : 'options'}</span>
				</div>
			</div>

			<p class="storage-note" class:warn={randomizer.storage === 'memory'}>
				<HardDrive size={15} strokeWidth={2} />
				{#if randomizer.storage === 'memory'}
					This browser is blocking storage. Export a backup before closing.
				{:else}
					Saved automatically in {storageLabel(randomizer.storage)}.
				{/if}
			</p>

			<div class="data-actions">
				<button class="btn btn-secondary" onclick={exportBackup}>
					<Download size={16} strokeWidth={2.1} />
					Export backup
				</button>
				<button class="btn btn-secondary" onclick={() => fileInput?.click()}>
					<Upload size={16} strokeWidth={2.1} />
					Import backup
				</button>
			</div>

			<input
				bind:this={fileInput}
				class="file-input"
				type="file"
				accept=".json,application/json"
				onchange={handleFileChange}
				tabindex="-1"
				aria-hidden="true"
			/>

			{#if pendingImport}
				<div class="pending" role="status">
					<div class="pending-icon" aria-hidden="true">
						<FileJson size={18} strokeWidth={2.1} />
					</div>
					<div class="pending-copy">
						<strong>Ready to import</strong>
						<span>
							{pendingCounts.wheels}
							{pendingCounts.wheels === 1 ? 'wheel' : 'wheels'} · {pendingCounts.options}
							{pendingCounts.options === 1 ? 'option' : 'options'} from
							{pendingImport.fileName}. This replaces your current wheels.
						</span>
					</div>
					<div class="pending-actions">
						<button class="btn btn-primary btn-sm" onclick={confirmImport}>Import</button>
						<button
							class="btn btn-secondary btn-sm"
							onclick={() => (pendingImport = null)}>Cancel</button
						>
					</div>
				</div>
			{/if}

			{#if importError}
				<p class="alert error" role="alert">{importError}</p>
			{/if}
			{#if notice}
				<p class="alert success" role="status">{notice}</p>
			{/if}
		</section>
	</div>

	<section class="wheels-section">
		<div class="wheels-head">
			<div>
				<h2>Wheels</h2>
				<p>Edit labels, add options, and reorder your tabs.</p>
			</div>
			<button class="btn btn-primary btn-sm" onclick={addWheel} disabled={maxed}>
				<Plus size={15} strokeWidth={2.4} />
				New wheel
			</button>
		</div>

		{#if maxed}
			<p class="limit">You've reached the {MAX_CATEGORIES}-wheel limit.</p>
		{/if}

		{#if randomizer.categories.length === 0}
			<div class="no-wheels">
				<p>No wheels yet. Create one to get started.</p>
				<button class="btn btn-primary btn-sm" onclick={addWheel}>
					<Plus size={15} strokeWidth={2.4} />
					New wheel
				</button>
			</div>
		{:else}
			<div class="category-list">
				{#each randomizer.categories as entry, index (entry.id)}
					<CategoryEditor
						category={entry}
						{index}
						total={randomizer.categories.length}
						expanded={expandedId === entry.id}
						ontoggle={() => (expandedId = expandedId === entry.id ? null : entry.id)}
						onmove={(delta) => randomizer.moveCategory(entry.id, delta)}
					/>
				{/each}
			</div>
		{/if}
	</section>

	<section class="panel danger-panel">
		<div class="panel-head">
			<h2>Reset</h2>
			<p>Restore the four starter wheels and discard all of your current changes.</p>
		</div>

		{#if confirmingReset}
			<div class="reset-confirm">
				<p>This can't be undone. Export a backup first if you might want your wheels back.</p>
				<div class="confirm-actions">
					<button class="btn btn-danger btn-sm" onclick={resetAll}>Yes, reset everything</button>
					<button class="btn btn-secondary btn-sm" onclick={() => (confirmingReset = false)}>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<div class="reset-row">
				<span>Start fresh with the original wheels.</span>
				<button class="btn btn-secondary btn-sm" onclick={() => (confirmingReset = true)}>
					<RotateCcw size={15} strokeWidth={2.2} />
					Reset to defaults
				</button>
			</div>
		{/if}
	</section>
</div>

<style>
	.settings {
		max-width: 820px;
		margin: 0 auto;
		padding: 28px 0 46px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 22px;
		color: var(--text-tertiary);
		font-size: 13px;
		font-weight: 650;
		transition: color 0.18s ease;
	}

	.back:hover {
		color: var(--text);
	}

	.page-head h1 {
		font-size: clamp(34px, 6vw, 48px);
		font-weight: 800;
		letter-spacing: -0.055em;
	}

	.page-head p {
		max-width: 560px;
		margin-top: 10px;
		color: var(--text-secondary);
		font-size: 14.5px;
		line-height: 1.55;
	}

	.panels {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 30px;
	}

	.panel {
		padding: 22px 24px;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}

	.panel-head h2 {
		font-size: 16px;
		font-weight: 750;
		letter-spacing: -0.03em;
	}

	.panel-head p {
		max-width: 570px;
		margin-top: 6px;
		color: var(--text-secondary);
		font-size: 13px;
		line-height: 1.55;
	}

	.theme-switch {
		display: inline-flex;
		gap: 3px;
		margin-top: 16px;
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface-2);
	}

	.theme-option {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 36px;
		padding: 0 14px;
		border: 1px solid transparent;
		border-radius: 10px;
		background: transparent;
		color: var(--text-secondary);
		font-size: 13px;
		font-weight: 650;
		transition:
			background 0.18s ease,
			color 0.18s ease,
			border-color 0.18s ease,
			box-shadow 0.18s ease;
	}

	.theme-option:hover {
		color: var(--text);
	}

	.theme-option.active {
		border-color: var(--border);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}

	.data-stats {
		display: flex;
		align-items: center;
		gap: 18px;
		margin-top: 18px;
	}

	.stat {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.stat strong {
		font-size: 24px;
		font-weight: 800;
		letter-spacing: -0.05em;
		font-variant-numeric: tabular-nums;
	}

	.stat span {
		color: var(--text-tertiary);
		font-size: 12.5px;
		font-weight: 600;
	}

	.stat-divider {
		width: 1px;
		height: 22px;
		background: var(--border);
	}

	.storage-note {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-top: 14px;
		color: var(--text-tertiary);
		font-size: 12.5px;
		font-weight: 550;
	}

	.storage-note.warn {
		color: var(--danger);
	}

	.data-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 18px;
	}

	.file-input {
		display: none;
	}

	.pending {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: 16px;
		padding: 13px;
		border: 1px solid color-mix(in oklab, var(--accent) 28%, var(--border));
		border-radius: var(--radius-md);
		background: color-mix(in oklab, var(--accent) 6%, var(--surface));
	}

	.pending-icon {
		width: 38px;
		height: 38px;
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		border-radius: 11px;
		background: color-mix(in oklab, var(--accent) 14%, var(--surface));
		color: var(--accent);
	}

	.pending-copy {
		flex: 1 1 240px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.pending-copy strong {
		font-size: 13px;
		font-weight: 700;
	}

	.pending-copy span {
		color: var(--text-secondary);
		font-size: 12px;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.pending-actions {
		display: flex;
		gap: 6px;
		flex: 0 0 auto;
	}

	.alert {
		margin-top: 14px;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		font-size: 12.5px;
		font-weight: 600;
		line-height: 1.45;
	}

	.alert.error {
		border: 1px solid color-mix(in oklab, var(--danger) 26%, transparent);
		background: var(--danger-soft);
		color: var(--danger);
	}

	.alert.success {
		border: 1px solid color-mix(in oklab, var(--success) 24%, transparent);
		background: var(--success-soft);
		color: var(--success);
	}

	.wheels-section {
		margin-top: 36px;
	}

	.wheels-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 14px;
	}

	.wheels-head h2 {
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.04em;
	}

	.wheels-head p {
		margin-top: 6px;
		color: var(--text-secondary);
		font-size: 13px;
	}

	.limit {
		margin: -4px 0 12px;
		color: var(--text-tertiary);
		font-size: 12.5px;
	}

	.category-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.no-wheels {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding: 22px;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-lg);
		color: var(--text-secondary);
		font-size: 13.5px;
	}

	.danger-panel {
		margin-top: 30px;
		border-color: color-mix(in oklab, var(--danger) 20%, var(--border));
	}

	.danger-panel h2 {
		color: var(--danger);
	}

	.reset-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
		margin-top: 16px;
	}

	.reset-row span {
		color: var(--text-secondary);
		font-size: 13px;
	}

	.reset-confirm {
		margin-top: 16px;
		padding: 13px;
		border: 1px solid color-mix(in oklab, var(--danger) 24%, transparent);
		border-radius: var(--radius-md);
		background: var(--danger-soft);
	}

	.reset-confirm p {
		color: var(--text-secondary);
		font-size: 12.5px;
		line-height: 1.5;
	}

	.confirm-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		margin-top: 10px;
	}

	@media (max-width: 640px) {
		.settings {
			padding-top: 22px;
		}

		.panel {
			padding: 19px 17px;
		}

		.theme-switch {
			display: flex;
			width: 100%;
		}

		.theme-option {
			flex: 1;
			justify-content: center;
			padding: 0 8px;
		}

		.wheels-head {
			align-items: flex-start;
		}
	}
</style>
