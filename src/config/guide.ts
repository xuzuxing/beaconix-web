/**
 * 接入指引数据（对应「接入指引」弹窗）。
 * 结构：一级分类 → 二级分类 → 场景（框架/工具）→ 步骤 → 代码页签。
 * 文案走 i18n（guide.*），代码与文件名等保持字面量。
 */

export interface GuideCodeTab {
  key: string
  /** 页签文案（npm、yarn、.env 等，保持字面量） */
  label: string
  code: string
  language: 'bash' | 'js' | 'text'
}

export interface GuideStep {
  key: string
  titleKey: string
  descKey?: string
  codeTabs: GuideCodeTab[]
}

export interface GuideScenario {
  key: string
  /** 场景名（Node.js、Cursor 等，参与 i18n） */
  nameKey: string
  docUrl: string
  steps: GuideStep[]
}

export interface GuideSubCategory {
  key: string
  labelKey: string
  scenarios: GuideScenario[]
}

export interface GuideCategory {
  key: string
  titleKey: string
  descKey: string
  subCategories: GuideSubCategory[]
}

const BEACON_INIT = `const beaconSDK = require('@beacon/node-sdk')
require('dotenv').config()

const beacon = beaconSDK.init({
  env: process.env.BEACON_ENV_ID,
  secretId: process.env.BEACON_SECRET_ID,
  secretKey: process.env.BEACON_SECRET_KEY,
})

module.exports = { beacon }`

const BEACON_ENV = `BEACON_ENV_ID=beacon-prod
BEACON_SECRET_ID=<your-secret-id>
BEACON_SECRET_KEY=<your-secret-key>`

const BEACON_QUERY = `const { beacon } = require('./utils/beacon')

// 查询 <YOUR_TABLE_NAME> 表前 10 条数据
const { data, error } = await beacon.rdb()
  .from('<YOUR_TABLE_NAME>')
  .select('*')
  .limit(10)

console.log('查询结果:', data)`

const BEACON_FUNCTION = `const { beacon } = require('./utils/beacon')

// 调用名为 hello 的云函数
const result = await beacon.callFunction({
  name: 'hello',
  data: { name: 'beacon' },
})

console.log('调用结果:', result)`

const BEACON_STORAGE = `const { beacon } = require('./utils/beacon')

// 上传文件到云存储
const { fileID } = await beacon.uploadFile({
  cloudPath: 'demo/hello.txt',
  fileContent: Buffer.from('hello beacon'),
})

console.log('文件 ID:', fileID)`

const INSTALL_TABS: GuideCodeTab[] = [
  { key: 'npm', label: 'npm', code: 'npm i @beacon/node-sdk dotenv', language: 'bash' },
  { key: 'yarn', label: 'yarn', code: 'yarn add @beacon/node-sdk dotenv', language: 'bash' },
  { key: 'pnpm', label: 'pnpm', code: 'pnpm add @beacon/node-sdk dotenv', language: 'bash' },
]

export const guideCategories: GuideCategory[] = [
  {
    key: 'framework',
    titleKey: 'guide.category.framework.title',
    descKey: 'guide.category.framework.desc',
    subCategories: [
      {
        key: 'mini',
        labelKey: 'guide.sub.mini',
        scenarios: [
          {
            key: 'weapp',
            nameKey: 'guide.scenario.weapp',
            docUrl: 'https://docs.example.com/beacon/quickstart/mini-program',
            steps: [
              {
                key: 'install',
                titleKey: 'guide.step.install',
                descKey: 'guide.desc.miniInstall',
                codeTabs: [
                  {
                    key: 'npm',
                    label: 'npm',
                    code: 'npm i @beacon/miniprogram-sdk',
                    language: 'bash',
                  },
                ],
              },
              {
                key: 'init',
                titleKey: 'guide.step.init',
                descKey: 'guide.desc.miniInit',
                codeTabs: [
                  {
                    key: 'app',
                    label: 'app.js',
                    code: `const beacon = require('@beacon/miniprogram-sdk')

App({
  onLaunch() {
    beacon.init({ env: 'beacon-prod' })
  },
})`,
                    language: 'js',
                  },
                ],
              },
              {
                key: 'usage',
                titleKey: 'guide.step.usage',
                codeTabs: [{ key: 'db', label: '数据库', code: BEACON_QUERY, language: 'js' }],
              },
            ],
          },
        ],
      },
      {
        key: 'frontend',
        labelKey: 'guide.sub.frontend',
        scenarios: [
          {
            key: 'vue',
            nameKey: 'guide.scenario.vue',
            docUrl: 'https://docs.example.com/beacon/quickstart/vue',
            steps: [
              {
                key: 'install',
                titleKey: 'guide.step.install',
                descKey: 'guide.desc.frontendInstall',
                codeTabs: [
                  { key: 'npm', label: 'npm', code: 'npm i @beacon/web-sdk', language: 'bash' },
                  {
                    key: 'pnpm',
                    label: 'pnpm',
                    code: 'pnpm add @beacon/web-sdk',
                    language: 'bash',
                  },
                ],
              },
              {
                key: 'init',
                titleKey: 'guide.step.init',
                descKey: 'guide.desc.frontendInit',
                codeTabs: [
                  {
                    key: 'main',
                    label: 'main.ts',
                    code: `import { createApp } from 'vue'
import { beacon } from '@beacon/web-sdk'

import App from './App.vue'

beacon.init({ env: 'beacon-prod' })
createApp(App).mount('#app')`,
                    language: 'js',
                  },
                ],
              },
              {
                key: 'usage',
                titleKey: 'guide.step.usage',
                codeTabs: [
                  { key: 'storage', label: '云存储', code: BEACON_STORAGE, language: 'js' },
                ],
              },
            ],
          },
        ],
      },
      {
        key: 'backend',
        labelKey: 'guide.sub.backend',
        scenarios: [
          {
            key: 'node',
            nameKey: 'guide.scenario.node',
            docUrl: 'https://docs.example.com/beacon/quickstart/node-sdk',
            steps: [
              {
                key: 'install',
                titleKey: 'guide.step.install',
                descKey: 'guide.desc.nodeInstall',
                codeTabs: INSTALL_TABS,
              },
              {
                key: 'init',
                titleKey: 'guide.step.init',
                descKey: 'guide.desc.nodeInit',
                codeTabs: [
                  { key: 'util', label: './utils/beacon.js', code: BEACON_INIT, language: 'js' },
                  { key: 'env', label: '.env', code: BEACON_ENV, language: 'text' },
                ],
              },
              {
                key: 'usage',
                titleKey: 'guide.step.usage',
                codeTabs: [
                  { key: 'db', label: 'PostgreSQL 数据库', code: BEACON_QUERY, language: 'js' },
                  { key: 'function', label: '云函数', code: BEACON_FUNCTION, language: 'js' },
                  { key: 'storage', label: '云存储', code: BEACON_STORAGE, language: 'js' },
                ],
              },
            ],
          },
        ],
      },
      {
        key: 'mobile',
        labelKey: 'guide.sub.mobile',
        scenarios: [
          {
            key: 'uni',
            nameKey: 'guide.scenario.uni',
            docUrl: 'https://docs.example.com/beacon/quickstart/uniapp',
            steps: [
              {
                key: 'install',
                titleKey: 'guide.step.install',
                codeTabs: [
                  {
                    key: 'npm',
                    label: 'npm',
                    code: 'npm i @beacon/uniapp-sdk',
                    language: 'bash',
                  },
                ],
              },
              {
                key: 'init',
                titleKey: 'guide.step.init',
                descKey: 'guide.desc.mobileInit',
                codeTabs: [
                  {
                    key: 'main',
                    label: 'main.js',
                    code: `import { beacon } from '@beacon/uniapp-sdk'

beacon.init({ env: 'beacon-prod' })`,
                    language: 'js',
                  },
                ],
              },
              {
                key: 'usage',
                titleKey: 'guide.step.usage',
                codeTabs: [{ key: 'db', label: '数据库', code: BEACON_QUERY, language: 'js' }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'mcp',
    titleKey: 'guide.category.mcp.title',
    descKey: 'guide.category.mcp.desc',
    subCategories: [
      {
        key: 'aiTool',
        labelKey: 'guide.sub.aiTool',
        scenarios: [
          {
            key: 'cursor',
            nameKey: 'guide.scenario.cursor',
            docUrl: 'https://docs.example.com/beacon/ai/mcp',
            steps: [
              {
                key: 'config',
                titleKey: 'guide.step.config',
                descKey: 'guide.desc.mcpConfig',
                codeTabs: [
                  {
                    key: 'mcp',
                    label: 'mcp.json',
                    code: `{
  "mcpServers": {
    "beacon": {
      "command": "npx",
      "args": ["-y", "@beacon/mcp@latest"],
      "env": { "BEACON_ENV_ID": "beacon-prod" }
    }
  }
}`,
                    language: 'text',
                  },
                ],
              },
              {
                key: 'use',
                titleKey: 'guide.step.use',
                descKey: 'guide.desc.mcpUse',
                codeTabs: [
                  {
                    key: 'prompt',
                    label: '提示词',
                    code: '帮我在 Beacon 里创建一个用户表，并提供查询接口',
                    language: 'text',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]
