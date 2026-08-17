import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Giving migration suites intentionally share one guarded disposable database.
    fileParallelism: !process.env.GIVING_MIGRATION_TEST_DATABASE_URL,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@payload-config': fileURLToPath(
        new URL('./payload.config.ts', import.meta.url),
      ),
    },
  },
})
