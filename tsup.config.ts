import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts'
  },
  target: 'node20',
  format: ['esm'],
  platform: 'node',
  clean: true,
  dts: true,
  bundle: true,
  splitting: true,
  minify: true,
  sourcemap: true,
  treeshake: true
})
