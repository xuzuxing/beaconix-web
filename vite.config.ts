import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type ConfigEnv, type UserConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// 注入应用版本号，供顶栏个人信息面板展示
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

// 接口前缀，dev server 的代理按此前缀匹配
const API_PREFIX = '/api'

// https://vite.dev/config/
export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const env = loadEnv(mode, process.cwd())
  const proxyTarget = env.VITE_PROXY_TARGET

  return {
    base: env.VITE_BASE_URL || '/',

    plugins: [vue(), vueDevTools()],

    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },

    resolve: {
      alias: {
        '@': resolvePath('./src'),
      },
    },

    css: {
      preprocessorOptions: {
        less: {
          // 全局注入 less 变量与 mixin，业务样式里无需重复 @import
          modifyVars: {
            hack: `true; @import (reference) "${resolvePath('./src/assets/styles/variables.less')}";`,
          },
        },
      },
    },

    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_DEV_PORT) || 5173,
      open: true,
      // 后端接口不带 /api 前缀时，在 rewrite 里去掉前缀
      proxy: proxyTarget
        ? {
            [API_PREFIX]: {
              target: proxyTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(new RegExp(`^${API_PREFIX}`), ''),
            },
          }
        : undefined,
    },

    build: {
      // 非生产构建保留 sourcemap 便于排错
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1500,
    },
  }
})
