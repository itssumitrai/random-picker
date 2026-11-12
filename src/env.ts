import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	SYNC_API_URL: {
		public: true,
		static: true,
		description:
			'Base URL of the PostgREST API that holds the shared wheels, e.g. "/api". ' +
			'Leave unset to keep data in this browser only. Not a secret: it ships in the bundle.',
		schema: (value) => value?.trim().replace(/\/+$/, '') || undefined
	}
});
