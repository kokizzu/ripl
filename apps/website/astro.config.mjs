import svelte from '@astrojs/svelte';

import {
    defineConfig,
} from 'astro/config';

// https://astro.build/config
export default defineConfig({
    server: {
        port: 6565,
    },
    integrations: [
        svelte(),
    ],
});