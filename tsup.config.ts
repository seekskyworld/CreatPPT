import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts', 'src/domain/index.ts', 'src/dsh-plugin.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  dts: true,
  outDir: 'dist/node',
  clean: true,
  noExternal: ['zod'],
})
