import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: {
    __APP_VERSION__: JSON.stringify('acl-test'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'),
  },
  test: {
    environment: 'happy-dom',
    include: ['test/unit/**/*.spec.ts', 'test/components/**/*.spec.ts'],
    clearMocks: true,
  },
  css: {
    preprocessorOptions: {
      less: {
        modifyVars: {
          hack: `true; @import (reference) "${fileURLToPath(new URL('./src/assets/styles/variables.less', import.meta.url))}";`,
        },
      },
    },
  },
})
