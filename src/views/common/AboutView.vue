<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

/** 目录说明，替换业务代码时按此放置文件 */
const structure = [
  { path: 'src/api', desc: '接口定义与类型，统一从 @/api 引入' },
  { path: 'src/assets/styles', desc: '全局样式与 less 变量（vite 自动注入）' },
  { path: 'src/config', desc: '应用配置：标题、默认语言、超时、成功码' },
  { path: 'src/locales', desc: 'vue-i18n 语言包与安装逻辑' },
  { path: 'src/router', desc: '路由实例与路由表' },
  { path: 'src/stores', desc: 'pinia 实例与按模块拆分的 store' },
  { path: 'src/types', desc: '全局共享类型' },
  {
    path: 'src/utils/request.ts',
    desc: 'axios 封装：token 注入、统一解包与错误提示',
  },
  { path: 'src/views/<domain>', desc: '页面组件，按业务域分目录' },
]
</script>

<template>
  <t-card
    :title="t('about.title')"
    :bordered="false"
  >
    <p class="about__desc">{{ t('about.desc') }}</p>
    <h3 class="about__subtitle">{{ t('about.structure') }}</h3>
    <ul class="about__list">
      <li
        v-for="item in structure"
        :key="item.path"
      >
        <code>{{ item.path }}</code>
        <span>{{ item.desc }}</span>
      </li>
    </ul>
  </t-card>
</template>

<style scoped lang="less">
.about {
  &__desc {
    margin: 0 0 16px;
    color: @beacon-text-color-secondary;
  }

  &__subtitle {
    margin: 0 0 12px;
    font-size: 16px;
  }

  &__list {
    li {
      display: flex;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px dashed @beacon-border-color;
    }

    code {
      min-width: 200px;
      color: @beacon-primary-color;
    }
  }
}
</style>
