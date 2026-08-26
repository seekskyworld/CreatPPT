import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { handleProjectRequest } from './src/server/handlers'

const projectDir = resolve(process.env.CREATPPT_PROJECT || 'examples/demo-deck')

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'creatppt-project-api',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (!(await handleProjectRequest(request, response, projectDir))) next()
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'fs': fileURLToPath(new URL('./src/shims/browser-fs.ts', import.meta.url)),
      'node:fs': fileURLToPath(new URL('./src/shims/browser-fs.ts', import.meta.url)),
      'node:https': fileURLToPath(new URL('./src/shims/browser-https.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: true,
  },
})
