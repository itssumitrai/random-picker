import { browser } from '$app/env';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'spindle.theme';

class ThemeStore {
	preference = $state<ThemePreference>('system');
	resolved = $state<ResolvedTheme>('light');

	#media: MediaQueryList | null = null;
	#initialized = false;

	init(): void {
		if (!browser || this.#initialized) return;
		this.#initialized = true;

		let stored: string | null = null;
		try {
			stored = localStorage.getItem(STORAGE_KEY);
		} catch {
			// Storage may be blocked; fall back to the device preference.
		}
		this.preference = stored === 'light' || stored === 'dark' ? stored : 'system';

		this.#media = window.matchMedia('(prefers-color-scheme: dark)');
		this.#media.addEventListener('change', this.#handleMediaChange);
		this.#apply();
	}

	set(preference: ThemePreference): void {
		this.preference = preference;
		try {
			localStorage.setItem(STORAGE_KEY, preference);
		} catch {
			// The preference still applies for this session.
		}
		this.#apply();
	}

	toggle(): void {
		this.set(this.resolved === 'dark' ? 'light' : 'dark');
	}

	#handleMediaChange = (): void => {
		if (this.preference === 'system') this.#apply();
	};

	#apply(): void {
		const isDark =
			this.preference === 'dark' ||
			(this.preference === 'system' && Boolean(this.#media?.matches));

		this.resolved = isDark ? 'dark' : 'light';

		const root = document.documentElement;
		root.dataset.theme = this.resolved;
		root.style.colorScheme = this.resolved;

		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', isDark ? '#0a0a0e' : '#f4f4f7');
	}
}

export const theme = new ThemeStore();
