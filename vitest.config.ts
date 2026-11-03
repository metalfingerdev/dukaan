import { defineConfig } from 'vitest/config';

// Tests sit next to the code as *.test.ts. Convex ignores file names with more than one dot, so
// they are never bundled into a deploy. `edge-runtime` matches where Convex functions run.
export default defineConfig({
	test: {
		environment: 'edge-runtime',
		server: { deps: { inline: ['convex-test'] } },
		include: ['src/**/*.test.ts'],
		// Stand-ins for the access guards, for every test: src/convex/vitest.setup.ts
		setupFiles: ['src/convex/vitest.setup.ts']
	}
});
