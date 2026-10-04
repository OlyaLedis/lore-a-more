import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // convex-test runs Convex functions in the same runtime they use when deployed.
    environment: 'edge-runtime',
    include: ['convex/**/*.test.ts'],
  },
})
