<script lang="ts">
	import {
		ArrowDown,
		ArrowUp,
		ChevronDown,
		GripVertical,
		Plus,
		Trash2
	} from '@lucide/svelte';
	import {
		ACCENT_COLORS,
		MAX_LABEL_LENGTH,
		MAX_OPTIONS,
		randomizer,
		type WheelCategory
	} from '#lib/randomizer.svelte';

	interface Props {
		category: WheelCategory;
		index: number;
		total: number;
		expanded: boolean;
		ontoggle: () => void;
		onmove: (delta: number) => void;
	}

	let { category, index, total, expanded, ontoggle, onmove }: Props = $props();

	const QUICK_EMOJIS = ['🎬', '🍜', '🌤️', '🎧', '🎲', '🍕', '✈️', '🏆', '🎉', '💡', '❤️', '🎯'];

	let confirmDelete = $state(false);
	let newOption = $state('');

	const maxed = $derived(category.options.length >= MAX_OPTIONS);
	const displayName = $derived(category.name.trim() || 'Untitled wheel');

	function addOption(event: SubmitEvent): void {
		event.preventDefault();
		if (randomizer.addOption(category.id, newOption)) {
			newOption = '';
		}
	}

	function deleteCategory(): void {
		if (randomizer.deleteCategory(category.id)) {
			confirmDelete = false;
		}
	}

	function setColor(color: string): void {
		randomizer.updateCategory(category.id, { color });
	}
</script>

<article class="category-card" class:expanded style={`--accent: ${category.color}`}>
	<div class="card-head">
		<button
			class="summary"
			onclick={ontoggle}
			aria-expanded={expanded}
			aria-controls={`category-body-${category.id}`}
		>
			<span class="emoji-badge" aria-hidden="true">{category.emoji || '🎲'}</span>
			<span class="meta">
				<span class="name">{displayName}</span>
				<span class="sub">
					{category.options.length}
					{category.options.length === 1 ? 'option' : 'options'} · {category.prompt}
				</span>
			</span>
			<span class="chevron" class:open={expanded}>
				<ChevronDown size={18} strokeWidth={2.2} />
			</span>
		</button>

		<div class="head-actions">
			<button
				class="move"
				onclick={() => onmove(-1)}
				disabled={index === 0}
				aria-label={`Move ${displayName} up`}
				title="Move up"
			>
				<ArrowUp size={16} strokeWidth={2.2} />
			</button>
			<button
				class="move"
				onclick={() => onmove(1)}
				disabled={index === total - 1}
				aria-label={`Move ${displayName} down`}
				title="Move down"
			>
				<ArrowDown size={16} strokeWidth={2.2} />
			</button>
		</div>
	</div>

	{#if expanded}
		<div class="card-body" id={`category-body-${category.id}`}>
			<div class="fields">
				<label class="field">
					<span>Name</span>
					<input
						class="input"
						value={category.name}
						maxlength={48}
						placeholder="Wheel name"
						oninput={(event) =>
							randomizer.updateCategory(category.id, { name: event.currentTarget.value })}
					/>
				</label>

				<label class="field">
					<span>Prompt</span>
					<input
						class="input"
						value={category.prompt}
						maxlength={90}
						placeholder="What's the pick?"
						oninput={(event) =>
							randomizer.updateCategory(category.id, { prompt: event.currentTarget.value })}
					/>
				</label>
			</div>

			<div class="tuning">
				<div class="field emoji-field">
					<span>Emoji</span>
					<div class="emoji-row">
						<input
							class="input emoji-input"
							value={category.emoji}
							maxlength={8}
							aria-label="Wheel emoji"
							oninput={(event) =>
								randomizer.updateCategory(category.id, { emoji: event.currentTarget.value })}
						/>
						<div class="quick-emojis">
							{#each QUICK_EMOJIS as quick (quick)}
								<button
									type="button"
									class="quick"
									class:selected={category.emoji === quick}
									onclick={() => randomizer.updateCategory(category.id, { emoji: quick })}
									aria-label={`Use ${quick} as the wheel emoji`}
								>
									{quick}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<div class="field color-field">
					<span>Accent color</span>
					<div class="color-row">
						<input
							class="color-input"
							type="color"
							value={category.color}
							aria-label="Accent color"
							oninput={(event) =>
								randomizer.updateCategory(category.id, { color: event.currentTarget.value })}
						/>
						<div class="swatches">
							{#each ACCENT_COLORS as swatch (swatch)}
								<button
									type="button"
									class="swatch"
									class:selected={category.color.toLowerCase() === swatch}
									style={`--swatch: ${swatch}`}
									onclick={() => setColor(swatch)}
									aria-label={`Use ${swatch} as the accent color`}
								></button>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div class="options-section">
				<div class="section-head">
					<h3>Options</h3>
					<span class="count">{category.options.length} / {MAX_OPTIONS}</span>
				</div>

				{#if category.options.length === 0}
					<p class="empty-options">No options yet. Add at least one to spin this wheel.</p>
				{:else}
					<ul class="option-list">
						{#each category.options as item, optionIndex (item.id)}
							<li class="option-row">
								<span class="grip" aria-hidden="true">
									<GripVertical size={14} strokeWidth={2} />
								</span>
								<input
									class="option-input"
									value={item.label}
									maxlength={MAX_LABEL_LENGTH}
									placeholder="Option label"
									aria-label={`Option ${optionIndex + 1} label`}
									oninput={(event) =>
										randomizer.updateOption(category.id, item.id, event.currentTarget.value)}
								/>
								<button
									class="row-btn"
									onclick={() => randomizer.moveOption(category.id, item.id, -1)}
									disabled={optionIndex === 0}
									aria-label={`Move ${item.label || 'option'} up`}
									title="Move up"
								>
									<ArrowUp size={14} strokeWidth={2.2} />
								</button>
								<button
									class="row-btn"
									onclick={() => randomizer.moveOption(category.id, item.id, 1)}
									disabled={optionIndex === category.options.length - 1}
									aria-label={`Move ${item.label || 'option'} down`}
									title="Move down"
								>
									<ArrowDown size={14} strokeWidth={2.2} />
								</button>
								<button
									class="row-btn danger"
									onclick={() => randomizer.deleteOption(category.id, item.id)}
									aria-label={`Delete ${item.label || 'option'}`}
									title="Delete option"
								>
									<Trash2 size={14} strokeWidth={2.2} />
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				<form class="add-option" onsubmit={addOption}>
					<input
						class="input"
						bind:value={newOption}
						maxlength={MAX_LABEL_LENGTH}
						placeholder={maxed ? 'Maximum options reached' : 'Add an option…'}
						disabled={maxed}
						aria-label="New option label"
					/>
					<button
						class="btn btn-secondary btn-sm"
						type="submit"
						disabled={maxed || !newOption.trim()}
					>
						<Plus size={15} strokeWidth={2.4} />
						Add
					</button>
				</form>
			</div>

			<div class="danger-row">
				{#if confirmDelete}
					<div class="confirm">
						<p>
							Delete <strong>{displayName}</strong> and its {category.options.length}
							{category.options.length === 1 ? 'option' : 'options'}?
						</p>
						<div class="confirm-actions">
							<button class="btn btn-danger btn-sm" onclick={deleteCategory}>Delete wheel</button>
							<button class="btn btn-secondary btn-sm" onclick={() => (confirmDelete = false)}>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<button
						class="delete-link"
						onclick={() => (confirmDelete = true)}
						disabled={total <= 1}
						title={total <= 1 ? 'Keep at least one wheel' : 'Delete this wheel'}
					>
						<Trash2 size={14} strokeWidth={2.2} />
						Delete wheel
					</button>
					{#if total <= 1}
						<span class="hint">Keep at least one wheel.</span>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</article>

<style>
	.category-card {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.category-card.expanded {
		border-color: color-mix(in oklab, var(--accent) 26%, var(--border));
		box-shadow: var(--shadow-md);
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 10px 10px;
	}

	.summary {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 10px;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		text-align: left;
		transition: background 0.18s ease;
	}

	.summary:hover {
		background: var(--surface-hover);
	}

	.emoji-badge {
		width: 44px;
		height: 44px;
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in oklab, var(--accent) 24%, var(--border));
		border-radius: 14px;
		background: color-mix(in oklab, var(--accent) 13%, var(--surface));
		font-size: 22px;
		line-height: 1;
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.name {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.025em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sub {
		color: var(--text-tertiary);
		font-size: 12.5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chevron {
		margin-left: auto;
		flex: 0 0 auto;
		color: var(--text-tertiary);
		transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.3, 1);
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.head-actions {
		display: flex;
		gap: 2px;
	}

	.move {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--text-tertiary);
		transition:
			background 0.18s ease,
			color 0.18s ease;
	}

	.move:hover:not(:disabled) {
		background: var(--surface-hover);
		color: var(--text);
	}

	.move:disabled {
		opacity: 0.25;
	}

	.card-body {
		padding: 20px 22px 22px;
		border-top: 1px solid var(--border);
		animation: reveal 0.26s ease both;
	}

	.fields {
		display: grid;
		grid-template-columns: 1fr;
		gap: 14px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 7px;
		min-width: 0;
	}

	.field > span {
		color: var(--text-tertiary);
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.tuning {
		display: flex;
		flex-wrap: wrap;
		gap: 22px;
		margin-top: 18px;
	}

	.emoji-field {
		flex: 0 1 auto;
	}

	.color-field {
		flex: 1 1 260px;
	}

	.emoji-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.emoji-input {
		width: 64px;
		flex: 0 0 auto;
		padding: 0;
		text-align: center;
		font-size: 20px;
	}

	.quick-emojis {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.quick {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: 9px;
		background: transparent;
		font-size: 15px;
		line-height: 1;
		transition:
			background 0.16s ease,
			border-color 0.16s ease,
			transform 0.16s ease;
	}

	.quick:hover {
		background: var(--surface-hover);
		transform: translateY(-1px);
	}

	.quick.selected {
		background: color-mix(in oklab, var(--accent) 12%, var(--surface));
		border-color: color-mix(in oklab, var(--accent) 34%, var(--border));
	}

	.color-row {
		display: flex;
		align-items: center;
		gap: 9px;
		flex-wrap: wrap;
		min-height: 44px;
	}

	.color-input {
		width: 44px;
		height: 44px;
		flex: 0 0 auto;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		cursor: pointer;
	}

	.color-input::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.color-input::-webkit-color-swatch {
		border: 0;
		border-radius: 8px;
	}

	.color-input::-moz-color-swatch {
		border: 0;
		border-radius: 8px;
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.swatch {
		position: relative;
		width: 24px;
		height: 24px;
		border: 0;
		border-radius: 50%;
		background: var(--swatch);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
		transition:
			transform 0.16s ease,
			box-shadow 0.16s ease;
	}

	.swatch:hover {
		transform: scale(1.12);
	}

	.swatch.selected {
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 4px var(--swatch);
	}

	.options-section {
		margin-top: 24px;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 10px;
	}

	.section-head h3 {
		color: var(--text-tertiary);
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.count {
		color: var(--text-tertiary);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.option-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.option-row {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 3px 6px 3px 4px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		transition:
			background 0.18s ease,
			border-color 0.18s ease;
	}

	.option-row:focus-within {
		border-color: color-mix(in oklab, var(--accent) 45%, var(--border));
		background: var(--surface);
	}

	.grip {
		width: 22px;
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		color: var(--text-tertiary);
		opacity: 0.65;
	}

	.option-input {
		flex: 1;
		min-width: 0;
		height: 34px;
		padding: 0 4px;
		border: 0;
		background: transparent;
		font-size: 13.5px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.option-input:focus {
		outline: none;
	}

	.row-btn {
		width: 28px;
		height: 28px;
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--text-tertiary);
		transition:
			background 0.16s ease,
			color 0.16s ease;
	}

	.row-btn:hover:not(:disabled) {
		background: var(--surface-hover);
		color: var(--text);
	}

	.row-btn:disabled {
		opacity: 0.22;
	}

	.row-btn.danger:hover {
		background: var(--danger-soft);
		color: var(--danger);
	}

	.empty-options {
		padding: 16px;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-size: 13px;
		text-align: center;
	}

	.add-option {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}

	.add-option .input {
		height: 40px;
	}

	.add-option .btn {
		height: 40px;
	}

	.danger-row {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	.delete-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 0;
		border: 0;
		background: transparent;
		color: var(--text-tertiary);
		font-size: 12.5px;
		font-weight: 650;
		transition: color 0.18s ease;
	}

	.delete-link:hover:not(:disabled) {
		color: var(--danger);
	}

	.delete-link:disabled {
		opacity: 0.4;
	}

	.hint {
		margin-left: 10px;
		color: var(--text-tertiary);
		font-size: 12px;
	}

	.confirm {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.confirm p {
		color: var(--text-secondary);
		font-size: 13px;
	}

	.confirm strong {
		color: var(--text);
	}

	.confirm-actions {
		display: flex;
		gap: 7px;
	}

	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}

	@media (max-width: 520px) {
		.card-body {
			padding: 18px 15px 18px;
		}

		.grip {
			display: none;
		}

		.head-actions .move {
			display: none;
		}

		.confirm {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
