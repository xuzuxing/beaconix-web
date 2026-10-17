<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import defaultLogo from '@/assets/logo/default.png'
import whiteLogo from '@/assets/logo/white-logo.png'
import AppIcon from '@/components/AppIcon.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { APP_TITLE } from '@/config'
import { ArrowLeft01Icon } from '@/icons'
import { useAppStore } from '@/stores'

defineOptions({ name: 'LegalDocument' })

interface LegalSection {
  heading: string
  paragraphs: string[]
}

const props = defineProps<{ kind: 'terms' | 'privacy' }>()

const { t, tm } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const logoSrc = computed(() => (appStore.isDark ? whiteLogo : defaultLogo))
const title = computed(() => t(`legal.${props.kind}.title`))
const sections = computed<LegalSection[]>(
  () => (tm(`legal.${props.kind}.sections`) as unknown as LegalSection[]) ?? [],
)
const footer = computed(() => t('legal.footer', { year: new Date().getFullYear() }))

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    void router.replace('/login')
  }
}
</script>

<template>
  <div class="legal">
    <header class="legal__bar">
      <div class="legal__brand">
        <img class="legal__logo" :src="logoSrc" :alt="APP_TITLE" />
        <span class="legal__brand-name">{{ APP_TITLE }}</span>
      </div>

      <div class="legal__actions">
        <t-button variant="text" @click="goBack">
          <template #icon><AppIcon :icon="ArrowLeft01Icon" /></template>
          {{ t('legal.back') }}
        </t-button>
        <LanguageSwitcher />
      </div>
    </header>

    <article class="legal__doc">
      <h1 class="legal__title">{{ title }}</h1>
      <p class="legal__meta">{{ t('legal.updatedAt') }}</p>

      <section v-for="section in sections" :key="section.heading" class="legal__section">
        <h2 class="legal__heading">{{ section.heading }}</h2>
        <p v-for="(paragraph, index) in section.paragraphs" :key="index" class="legal__paragraph">
          {{ paragraph }}
        </p>
      </section>
    </article>

    <footer class="legal__footer">{{ footer }}</footer>
  </div>
</template>

<style scoped lang="less">
.legal {
  width: 100%;
  max-width: 880px;
  padding: 8px 0 40px;

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px 24px;
    flex-wrap: wrap;
    padding: 0 4px 20px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  &__logo {
    height: 26px;
    width: auto;
    object-fit: contain;
  }

  &__brand-name {
    font-size: @beacon-font-size-menu;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__doc {
    padding: 32px 40px;
    background: @beacon-bg-container;
    border: 1px solid @beacon-border;
    border-radius: 4px;
  }

  &__title {
    margin: 0 0 4px;
    font-size: 24px;
    font-weight: @beacon-font-weight-medium;
    line-height: 32px;
    color: @beacon-text-primary;
  }

  &__meta {
    margin: 0 0 8px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-tertiary;
  }

  &__section {
    margin-top: 24px;
  }

  &__heading {
    margin: 0 0 8px;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
  }

  &__paragraph {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 24px;
    color: @beacon-text-secondary;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__footer {
    margin-top: 32px;
    padding: 20px 4px 0;
    border-top: 1px solid @beacon-border;
    text-align: center;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-tertiary;
    overflow-wrap: anywhere;
  }
}

@media (max-width: 860px) {
  .legal {
    padding: 0 0 24px;

    &__doc {
      padding: 24px 20px;
    }

    &__logo {
      height: 22px;
    }
  }
}
</style>
