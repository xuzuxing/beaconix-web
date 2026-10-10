<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { LOCALE_OPTIONS } from '@/config'
import { ArrowDown01Icon } from '@/icons'
import { useAppStore } from '@/stores'
import type { LocaleType } from '@/types'

defineOptions({ name: 'LanguageSwitcher' })

const { t } = useI18n()
const appStore = useAppStore()

const options = computed(() =>
  LOCALE_OPTIONS.map((item) => ({ content: item.label, value: item.value })),
)

/** 当前语言名，形如「中文 ⌄」 */
const currentLabel = computed(
  () => LOCALE_OPTIONS.find((item) => item.value === appStore.locale)?.label ?? appStore.locale,
)

function handleSelect(data: { value?: string | number }) {
  appStore.setLocale(data.value as LocaleType)
}
</script>

<template>
  <t-dropdown trigger="click" :options="options" @click="handleSelect">
    <button type="button" class="language-switcher" :aria-label="t('app.language')">
      {{ currentLabel }}
      <AppIcon class="language-switcher__caret" :icon="ArrowDown01Icon" />
    </button>
  </t-dropdown>
</template>

<style scoped lang="less">
.language-switcher {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 8px;
  font-family: inherit;
  font-size: @beacon-font-size-base;
  line-height: 30px;
  color: @beacon-text-primary;
  cursor: pointer;
  background-color: transparent;
  border: 0;
  border-radius: @beacon-radius-m;

  &:hover {
    color: @beacon-brand;
    background-color: @beacon-bg-hover;
  }

  &__caret {
    color: @beacon-text-tertiary;
  }
}
</style>
