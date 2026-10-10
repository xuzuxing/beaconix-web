# Beacon Web

Beacon Web 前端项目模板：Vue 3 全家桶 + TDesign + Hugeicons，开箱即用（请求封装、国际化、状态持久化、多环境构建均已接好）。

## 技术栈

| 分类   | 选型                                          |
| ------ | --------------------------------------------- |
| 框架   | Vue 3.5（Composition API + `<script setup>`） |
| 构建   | Vite 8 + TypeScript 6                         |
| 路由   | Vue Router 5                                  |
| 状态   | Pinia 4 + pinia-plugin-persistedstate         |
| UI     | TDesign 1.20                                  |
| 图标   | Hugeicons（@hugeicons/vue + 免费图标集）      |
| 国际化 | vue-i18n 11                                   |
| 请求   | Axios 1.20（统一封装）                        |
| 工具   | @vueuse/core、dayjs                           |
| 样式   | Less（全局变量自动注入）                      |
| 规范   | ESLint 10 + oxlint + Prettier + EditorConfig  |
| 包管理 | pnpm 12（唯一 lockfile：`pnpm-lock.yaml`）    |

## 快速开始

```bash
pnpm install
pnpm dev           # http://localhost:5173
```

## 常用命令

| 命令              | 说明                                        |
| ----------------- | ------------------------------------------- |
| `pnpm dev`        | 启动开发服务器（development 环境）          |
| `pnpm build`      | 类型检查 + 生产构建（输出 dist/，串行执行） |
| `pnpm build:test` | 测试环境构建                                |
| `pnpm preview`    | 预览构建产物                                |
| `pnpm type-check` | 仅做类型检查（`vue-tsc --build`）           |
| `pnpm lint`       | oxlint + ESLint 检查并自动修复              |
| `pnpm format`     | Prettier 格式化整个仓库                     |

## 目录结构

```
src/
├── api/                  # 接口层：modules/ 下按业务拆分，统一从 @/api 引入
│   ├── modules/user.ts
│   ├── index.ts
│   └── types.ts          # ApiResult / PageQuery / 业务实体类型
├── assets/styles/        # 全局样式
│   ├── index.less        # 基础样式，main.ts 中引入
│   └── variables.less    # less 变量与 mixin，vite 自动注入，无需 @import
├── config/               # 应用配置：标题、默认语言、首页路径、超时、业务成功码
├── components/           # 通用组件：LanguageSwitcher、overview/ 下的概览区块
├── layouts/              # 布局：index.vue 主布局、blank.vue 空白布局、components/ 下是菜单与顶部栏
├── locales/              # vue-i18n 语言包与 setupI18n
├── router/               # 路由实例、路由表（routes.ts）与菜单生成（menu.ts）
├── stores/               # pinia 实例 + modules/ 下的 store
├── types/                # 全局共享类型
├── utils/request.ts      # axios 封装
├── views/                # 页面组件
├── App.vue
└── main.ts
```

## 布局与菜单

路由按布局分两类（见 `src/router/routes.ts`）：

| 布局     | 文件                    | 说明                                                                                                    |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| 主布局   | `src/layouts/index.vue` | 挂在 `/` 下，含侧边菜单、顶部栏（折叠按钮 + 语言切换）、页面标题栏（标题 + 评价卡）与 keep-alive 内容区 |
| 空白布局 | `src/layouts/blank.vue` | 整屏无框架，用于 404（`/blank` 下还有一个示例页面，演示这种布局）                                       |

侧边菜单由前端路由表生成（`buildMenu`，见 `src/router/menu.ts`），路由 `meta` 约定：

| meta          | 说明                                                             |
| ------------- | ---------------------------------------------------------------- |
| `titleKey`    | 标题的 i18n key，用于菜单、页面标题栏与 `document.title`         |
| `icon`        | 菜单图标（Hugeicons 图标对象，如 `DashboardSquare01Icon`）       |
| `group`       | 菜单分组，相邻分组之间自动渲染一条分隔线                         |
| `subTitleKey` | 在二级菜单里显示的标题（默认取 `titleKey`）                      |
| `subGroup`    | 二级菜单分组，值即分组标题的 i18n key，变化处渲染分组标签        |
| `hideHeader`  | 为 `true` 时不渲染内容区标题栏（页面自带头部，如概览页）         |
| `badge`       | 菜单项右侧徽标，如 `{ textKey: 'badge.beta', theme: 'primary' }` |
| `hidden`      | 为 `true` 时不出现在菜单里（如 404）                             |
| `keepAlive`   | 为 `false` 时该页面不参与 keep-alive 缓存（默认缓存）            |

新增主布局页面：在 `src/views/` 建组件，加进 `routes.ts` 的 `layoutChildren` 并写好 `meta`，菜单会自动出现：

```ts
{
  path: 'system',
  name: 'system',
  component: () => import('@/views/SystemView.vue'),
  meta: { titleKey: 'menu.system', icon: 'setting', group: 'service' },
}
```

菜单顺序即路由声明顺序；该路由再挂 `children` 即可变成多级菜单（父级自动渲染为 `t-submenu`）。
尚未接入的页面可先复用 `src/views/PlaceholderView.vue`。参考工程（腾讯云 CloudBase 控制台）的概览页实现见
`src/views/OverviewView.vue` 与 `src/components/overview/`。

### 二级菜单

一级菜单项只要有子路由（`path` 含多段），就会自动出现二级菜单（180px 的第三栏，见
`src/layouts/components/SecondaryNav.vue`），例如云存储：

```ts
// 一级项：subTitleKey 是它在二级菜单里的名称，subGroup 是它所在的分组
{ path: 'storage', meta: { titleKey: 'menu.storage', subTitleKey: 'submenu.storage.manage', subGroup: 'submenu.storage.overview' } },
// 二级项：按路径第一段归到对应的一级项
{ path: 'storage/permission', meta: { titleKey: 'submenu.storage.permission', subGroup: 'submenu.storage.overview' } },
{ path: 'storage/ci', meta: { titleKey: 'submenu.storage.ci', subGroup: 'submenu.storage.advanced' } },
```

`subGroup` 变化处会渲染一条分组标签（值即标题的 i18n key，如 `submenu.storage.overview`）；
只有一个「自身」项时不会渲染二级菜单，所以没有子路由的模块不会多出一栏。

### 图标

图标统一使用 [Hugeicons](https://hugeicons.com/docs/integrations/vue/quick-start)（stroke-rounded 免费集），
从 `src/icons` 具名引入、用 `AppIcon` 渲染：

```vue
<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import { Search01Icon } from '@/icons'
</script>

<template>
  <AppIcon :icon="Search01Icon" :size="16" />
</template>
```

`AppIcon`（`src/components/AppIcon.vue`）默认 16px、描边 1.5、颜色跟随 `currentColor`，
需要其它尺寸时传 `size`。新增图标先在 `src/icons/index.ts` 里具名导出，便于统一管理与 tree-shaking。

### 主题与设计令牌

样式取值走 TDesign 的设计令牌（`--td-*`，共 241 个，分 primitive / semantic / component 三层）：

- `src/assets/styles/variables.less` —— 业务变量（`@beacon-*`）的取值引用 `var(--td-*)`，切换主题或品牌色时自动跟随
- `src/assets/styles/theme.less` —— **唯一的令牌覆写入口**：把 TDesign 对齐到参考实现（直角体系、`#f2f4f8` 页面底、两级边框色、占位文案色），并给出更换品牌色的整套色阶示例
- 布局专有尺寸（顶栏 48、侧栏 190/180/48、最小宽度 1440）与 tea 的字号档位（12/13/16/28）保留字面量，TDesign 没有一一对应的令牌

主题模式存在 `useAppStore().theme`（`light` / `dark` / `auto`，已持久化），`App.vue` 解析后写入 `<html theme-mode>`，
暗色沿用 TDesign 的 `[theme-mode='dark']` 作用域；顶栏右侧的图标按钮可切换（图标随模式变化）。

> 覆写令牌时注意**特异性**：TDesign 把变量定义在 `:root[theme-mode='light']`（0,2,0）上，
> 覆写选择器需要同等特异性（如 `:root:root`、`:root:not([theme-mode='dark'])`）才能生效，
> 只写 `:root` 或 `html:not(...)` 会被压过去。

侧边栏折叠状态存在 `useAppStore().collapsed`（已持久化），窗口宽度 ≤991px 时会自动折叠。

## 环境变量

变量按环境放在根目录的 `.env`（公共）、`.env.development`、`.env.test`、`.env.production`，
类型声明见 `env.d.ts`。本地个人配置写 `.env.local`（已被 git 忽略）。

| 变量                                  | 说明                                  |
| ------------------------------------- | ------------------------------------- |
| `VITE_APP_TITLE`                      | 应用标题，`index.html` 与页面标题使用 |
| `VITE_APP_LOCALE`                     | 默认语言：`zh-CN` / `en-US`           |
| `VITE_API_SUCCESS_CODE`               | 业务成功状态码，默认 `0`              |
| `VITE_API_BASE_URL`                   | 接口基础路径（默认 `/api`）           |
| `VITE_API_TIMEOUT`                    | 请求超时毫秒数，默认 `15000`          |
| `VITE_BASE_URL`                       | 打包路径，部署到子路径时修改          |
| `VITE_DEV_PORT` / `VITE_PROXY_TARGET` | 开发服务器端口与代理目标              |

## 请求层用法

`src/utils/request.ts` 统一处理 baseURL、超时、token 注入、响应解包与错误提示，
默认把 `{ code, message, data }` 中的 `data` 解包后返回，非该结构（文件流、第三方接口）原样返回。

```ts
import { get, post } from '@/utils/request'

interface User {
  id: string
  name: string
}

// Promise<User>，业务失败会自动弹提示并 reject
const user = await get<User>('/user/profile')

await post('/user/profile', { name: 'beacon' })
```

新增接口写在 `src/api/modules/*.ts` 并从 `@/api` 统一导出：

```ts
// src/api/modules/user.ts
export function getUserInfo() {
  return get<UserInfo>('/user/profile')
}
```

Token 来源与 401 处理在 `main.ts` 中接线（`setupRequestToken` / `setupRequestUnauthorized`），
请求层不直接依赖 store，避免循环依赖。

## 国际化

- 语言包：`src/locales/zh-CN.ts`、`src/locales/en-US.ts`
- 组件内：`const { t } = useI18n()`，模板中也可直接使用 `$t('nav.home')`
- 切换语言：`useAppStore().setLocale('en-US')`（顶部下拉框已实现），会同步 vue-i18n、dayjs 与 `<html lang>`

新增文案时两种语言都要补齐。

## 状态管理

```ts
// src/stores/modules/xxx.ts
export const useXxxStore = defineStore(
  'xxx',
  () => {
    const list = ref<string[]>([])
    return { list }
  },
  { persist: { key: 'beacon-web:xxx', pick: ['list'] } }, // 需要持久化时
)
```

persist 的 `key` 统一使用 `beacon-web:` 前缀；`pick` 只持久化需要的字段。

## 样式

`src/assets/styles/variables.less` 中的变量与 mixin 由 vite 通过 `modifyVars` 注入到所有 less 文件
（含 SFC 的 `<style lang="less">`），直接使用即可：

```less
.card {
  color: @beacon-text-color;
  border-radius: @beacon-radius;
}
```

## 目录约定与后续扩展

- 新增页面：`src/views/` 下建单文件组件，加进 `src/router/routes.ts` 的 `layoutChildren`（主布局，自动进菜单）或其他布局路由下，`meta.titleKey` 填 i18n key
- 新增 store：`src/stores/modules/` 下建文件，并在 `src/stores/index.ts` 导出
- 新增接口模块：`src/api/modules/` 下建文件，并在 `src/api/index.ts` 导出
