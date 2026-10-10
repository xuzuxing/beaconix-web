<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { AppWindowIcon, LinkSquare02Icon } from '@/icons'

/** AI 开发工具：大模型 Token 与 MCP 两张卡 + 生态 logo 行 */
defineOptions({ name: 'AiToolSection' })

const { t } = useI18n()

/** logo 用「品牌色方块 + 首字母」表示，避免引入第三方商标资源 */
const models = [
  { key: 'hunyuan', letter: 'H', color: '#0052d9' },
  { key: 'deepseek', letter: 'D', color: '#4d6bfe' },
  { key: 'kimi', letter: 'K', color: '#1f2329' },
  { key: 'glm', letter: 'G', color: '#3b6ef6' },
  { key: 'qwen', letter: 'Q', color: '#7b5cff' },
  { key: 'minimax', letter: 'M', color: '#ff5c5c' },
]

const aiTools = [
  { key: 'cursor', letter: 'C', color: '#1f2329' },
  { key: 'windsurf', letter: 'W', color: '#0ea5e9' },
  { key: 'cline', letter: 'C', color: '#22c55e' },
  { key: 'claude', letter: 'A', color: '#d97757' },
  { key: 'gemini', letter: 'G', color: '#4285f4' },
  { key: 'more', letter: '···', color: '#8b8b8b' },
]
</script>

<template>
  <t-card :bordered="false" class="ai-tools">
    <template #title>
      <h3 class="ai-tools__heading">{{ t('overview.ai.title') }}</h3>
    </template>

    <div class="ai-tools__grid">
      <div class="ai-tools__card">
        <div class="ai-tools__head">
          <span class="ai-tools__bullet" />
          <span class="ai-tools__name">{{ t('overview.ai.tokenName') }}</span>
        </div>
        <p class="ai-tools__desc">{{ t('overview.ai.tokenDesc') }}</p>

        <div class="ai-tools__footer">
          <div class="ai-tools__actions">
            <t-button variant="outline" size="small">{{ t('overview.ai.enable') }}</t-button>
            <t-button variant="outline" size="small">
              {{ t('overview.ai.docs') }}
              <template #suffix>
                <AppIcon :icon="LinkSquare02Icon" />
              </template>
            </t-button>
          </div>

          <div class="ai-tools__logos">
            <span
              v-for="item in models"
              :key="item.key"
              class="ai-tools__logo"
              :style="{ backgroundColor: item.color }"
            >
              {{ item.letter }}
            </span>
          </div>
        </div>
      </div>

      <div class="ai-tools__card">
        <div class="ai-tools__head">
          <span class="ai-tools__bullet" />
          <span class="ai-tools__name">{{ t('overview.ai.mcpName') }}</span>
        </div>
        <p class="ai-tools__desc">{{ t('overview.ai.mcpDesc') }}</p>

        <div class="ai-tools__footer">
          <div class="ai-tools__actions">
            <t-button variant="outline" size="small">
              <template #icon>
                <AppIcon :icon="AppWindowIcon" />
              </template>
              {{ t('overview.ai.integrate') }}
            </t-button>
          </div>

          <div class="ai-tools__logos">
            <span
              v-for="item in aiTools"
              :key="item.key"
              class="ai-tools__logo"
              :style="{ backgroundColor: item.color }"
            >
              {{ item.letter }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.ai-tools {
  &__heading {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 22px;
    color: @beacon-text-primary;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }

  &__card {
    display: flex;
    flex-direction: column;
    padding: 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__bullet {
    width: 8px;
    height: 8px;
    background-color: @beacon-warning;
    transform: rotate(45deg);
  }

  &__name {
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__desc {
    flex: 1;
    margin: 0 0 16px;
    color: @beacon-text-secondary;
  }

  &__footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: @beacon-gap-l;
  }

  &__actions {
    display: flex;
    gap: 8px;
  }

  &__logos {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    font-size: 9px;
    font-weight: 600;
    color: var(--td-text-color-anti);
    border-radius: 4px;
  }
}
</style>
