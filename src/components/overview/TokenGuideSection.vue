<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { ApiIcon, BlocksIcon, CodeIcon, Copy01Icon, GlobalIcon, ServerIcon } from '@/icons'

/** 在 AI 工具中使用 Token：凭据行 + 集成方法 + CLI */
defineOptions({ name: 'TokenGuideSection' })

const { t } = useI18n()

const baseUrl = 'https://beacon-gateway.example.com/v1/ai/beacon'
const apiKeyName = 'Beacon'

const docLinks = computed(() => [
  'Codebuddy',
  'Workbuddy',
  'Claude Code',
  'Cursor',
  t('overview.tokenGuide.more'),
])

const methods = computed(() => [
  { key: 'sdk', icon: CodeIcon, name: t('overview.integration.sdk') },
  { key: 'mini', icon: GlobalIcon, name: t('overview.integration.miniprogram') },
  { key: 'js', icon: BlocksIcon, name: t('overview.integration.jsSdk') },
  { key: 'node', icon: ServerIcon, name: t('overview.integration.nodeSdk') },
  { key: 'http', icon: ApiIcon, name: t('overview.integration.httpApi') },
])

const cliCommands = ['npm install -g @beacon/cli@latest', t('overview.integration.cliVerify')]
</script>

<template>
  <t-card :bordered="false" class="token-guide">
    <template #title>
      <h3 class="token-guide__heading">{{ t('overview.tokenGuide.title') }}</h3>
    </template>

    <div class="token-guide__rows">
      <t-alert theme="info" :message="t('access.patHint')" />
      <div class="token-guide__row">
        <span class="token-guide__label">{{ t('overview.tokenGuide.baseUrl') }}</span>
        <code class="token-guide__value">{{ baseUrl }}</code>
        <t-button variant="outline" size="small">
          <template #icon>
            <AppIcon :icon="Copy01Icon" />
          </template>
          {{ t('overview.tokenGuide.copy') }}
        </t-button>
      </div>

      <div class="token-guide__row">
        <span class="token-guide__label">{{ t('overview.tokenGuide.apiKey') }}</span>
        <span class="token-guide__key">{{ apiKeyName }}</span>
        <t-button variant="outline" size="small">{{ t('overview.tokenGuide.copyKey') }}</t-button>
      </div>

      <div class="token-guide__row">
        <span class="token-guide__label">{{ t('overview.tokenGuide.docs') }}</span>
        <span class="token-guide__links">
          <a v-for="link in docLinks" :key="link" class="token-guide__link" href="#">{{ link }}</a>
        </span>
      </div>
    </div>

    <div class="token-guide__divider" />

    <h4 class="token-guide__subtitle">{{ t('overview.integration.title') }}</h4>
    <div class="token-guide__methods">
      <div v-for="method in methods" :key="method.key" class="token-guide__method">
        <AppIcon class="token-guide__method-icon" :icon="method.icon" />
        <span>{{ method.name }}</span>
      </div>
    </div>

    <div class="token-guide__divider" />

    <div class="token-guide__cli-head">
      <div>
        <span class="token-guide__cli-name">{{ t('overview.integration.cli') }}</span>
        <span class="token-guide__cli-desc">{{ t('overview.integration.cliDesc') }}</span>
      </div>
      <a class="token-guide__link" href="#">{{ t('overview.integration.cliDocs') }}</a>
    </div>

    <div class="token-guide__commands">
      <div v-for="command in cliCommands" :key="command" class="token-guide__command">
        <code>{{ command }}</code>
        <AppIcon class="token-guide__copy" :icon="Copy01Icon" />
      </div>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.token-guide {
  &__heading {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 22px;
    color: @beacon-text-primary;
  }

  &__rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__label {
    flex: none;
    width: 64px;
    color: @beacon-text-secondary;
  }

  &__value {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    overflow: hidden;
    font-family: sfmono-regular, consolas, 'liberation mono', menlo, monospace;
    line-height: 28px;
    color: @beacon-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__key {
    flex: none;
    padding: 0 8px;
    line-height: 28px;
    color: @beacon-text-primary;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;
  }

  &__links {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  &__link {
    color: @beacon-brand;
    cursor: pointer;

    &:hover {
      color: @beacon-brand-hover;
    }
  }

  &__divider {
    height: 1px;
    margin: 20px 0;
    background-color: @beacon-border;
  }

  &__subtitle {
    margin: 0 0 12px;
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__methods {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 32px;
  }

  &__method {
    display: flex;
    align-items: center;
    gap: 8px;
    color: @beacon-text-secondary;
  }

  &__method-icon {
    font-size: 16px;
    color: @beacon-text-primary;
  }

  &__cli-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__cli-name {
    margin-right: 12px;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__cli-desc {
    color: @beacon-text-tertiary;
  }

  &__commands {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__command {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 32px;
    padding: 0 12px;
    background-color: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;

    code {
      overflow: hidden;
      font-family: sfmono-regular, consolas, 'liberation mono', menlo, monospace;
      color: @beacon-text-secondary;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__copy {
    flex: none;
    color: @beacon-text-tertiary;
    cursor: pointer;

    &:hover {
      color: @beacon-brand;
    }
  }
}
</style>
