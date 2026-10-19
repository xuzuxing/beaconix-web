<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import {
  AiMagicIcon,
  AppWindowIcon,
  CodeIcon,
  DashboardSquare01Icon,
  Download01Icon,
  Github01Icon,
  GlobalIcon,
  LinkSquare02Icon,
} from '@/icons'

/** 示例模板：5 列卡片网格 */
defineOptions({ name: 'TemplateGallery' })

const { t } = useI18n()

const templates = computed(() => [
  {
    key: 'vue',
    icon: CodeIcon,
    color: '#41b883',
    name: t('overview.templates.vueName'),
    desc: t('overview.templates.vueDesc'),
  },
  {
    key: 'console',
    icon: DashboardSquare01Icon,
    color: '#0052d9',
    name: t('overview.templates.consoleName'),
    desc: t('overview.templates.consoleDesc'),
  },
  {
    key: 'h5',
    icon: GlobalIcon,
    color: '#7b5cff',
    name: t('overview.templates.h5Name'),
    desc: t('overview.templates.h5Desc'),
  },
  {
    key: 'uni',
    icon: AppWindowIcon,
    color: '#0cbf5b',
    name: t('overview.templates.uniName'),
    desc: t('overview.templates.uniDesc'),
  },
  {
    key: 'rules',
    icon: AiMagicIcon,
    color: '#ff7800',
    name: t('overview.templates.rulesName'),
    desc: t('overview.templates.rulesDesc'),
  },
])
</script>

<template>
  <section class="templates">
    <h3 class="templates__title">{{ t('overview.templates.title') }}</h3>

    <div class="templates__list">
      <div
        v-for="item in templates"
        :key="item.key"
        class="templates__card"
      >
        <div class="templates__card-head">
          <AppIcon
            class="templates__card-icon"
            :icon="item.icon"
            :size="28"
            :style="{ color: item.color }"
          />
          <div class="templates__card-info">
            <div class="templates__card-name">{{ item.name }}</div>
            <div class="templates__card-desc">{{ item.desc }}</div>
          </div>
        </div>

        <div class="templates__card-actions">
          <t-button
            variant="outline"
            size="small"
          >
            <template #icon>
              <AppIcon :icon="Download01Icon" />
            </template>
            {{ t('overview.templates.download') }}
          </t-button>
          <t-button
            variant="outline"
            size="small"
            shape="square"
          >
            <template #icon>
              <AppIcon :icon="Github01Icon" />
            </template>
          </t-button>
          <t-button
            variant="outline"
            size="small"
            shape="square"
          >
            <template #icon>
              <AppIcon :icon="LinkSquare02Icon" />
            </template>
          </t-button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="less">
.templates {
  &__title {
    margin: 0 0 16px;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }

  &__card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 154px;
    padding: 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__card-head {
    display: flex;
    gap: 12px;
    min-width: 0;
  }

  &__card-icon {
    flex: none;
  }

  &__card-info {
    min-width: 0;
  }

  &__card-name {
    margin-bottom: 4px;
    overflow: hidden;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__card-desc {
    display: -webkit-box;
    overflow: hidden;
    color: @beacon-text-tertiary;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__card-actions {
    display: flex;
    gap: 4px;
  }
}
</style>
