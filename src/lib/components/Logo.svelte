<script lang="ts">
	interface Props {
		size?: number;
	}

	let { size = 28 }: Props = $props();
</script>

<span class="logo" style={`--size: ${size}px`} aria-hidden="true"></span>

<style>
	.logo {
		position: relative;
		display: inline-block;
		flex: 0 0 auto;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		background: repeating-conic-gradient(
			from 0deg,
			var(--accent) 0deg 45deg,
			color-mix(in oklab, var(--accent) 26%, var(--surface)) 45deg 90deg
		);
		box-shadow:
			inset 0 0 0 1px color-mix(in oklab, var(--accent) 38%, var(--border)),
			0 4px 12px -5px color-mix(in oklab, var(--accent) 60%, transparent);
		transition: transform 0.55s cubic-bezier(0.2, 0.8, 0.3, 1);
	}

	.logo::before {
		content: '';
		position: absolute;
		inset: 31%;
		border-radius: 50%;
		background: var(--surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.logo::after {
		content: '';
		position: absolute;
		top: 3%;
		left: 50%;
		width: 18%;
		height: 18%;
		border-radius: 50%;
		background: var(--accent);
		transform: translateX(-50%);
		box-shadow: 0 0 0 1.5px var(--surface);
	}

	@media (max-width: 640px) {
		.logo {
			width: 22px;
			height: 22px;
		}
	}
</style>
