<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import defaultLogo from '@/assets/logo/default.png'
import whiteLogo from '@/assets/logo/white-logo.png'
import { getPublicStatusPage } from '@/api'
import type { PublicStatusPage } from '@/api/types/status-page'
import AppIcon from '@/components/AppIcon.vue'
import PublicStatusPagePanel from '@/components/status-pages/PublicStatusPagePanel.vue'
import { RefreshIcon } from '@/icons'
import { useAppStore } from '@/stores'
import { withSimulatedAvailability } from '@/utils/status-page-simulated'

/**
 * 公开状态页 `/status/:slug`（BlankLayout，不带控制台框架）。
 *
 * 走公开接口 GET /status/:slug，页面被停用或 slug 不存在时后端返回 404，
 * 这里只提示「状态页不存在或未启用」，不泄露组织内其它信息。
 * 内容区宽 1280px：作为对外分享的门面，比控制台内的页面更宽松。
 *
 * 头部 logo 与页脚版权是**状态页可配置项**（`page.logoUrl` / `page.footerText`）：
 * 后端尚未提供，为空或加载失败时回退到 Beaconix 默认 logo（随明暗主题）与默认版权文案。
 */
defineOptions({ name: 'PublicStatusPageView' })
const { t } = useI18n()
const route = useRoute()
const appStore = useAppStore()
const slug = computed(() =>
  typeof route.params.slug === 'string' ? route.params.slug : '',
)
const statusPage = ref<PublicStatusPage>()
const loading = ref(false)
const error = ref('')
/** 自定义 logo 加载失败后不再重试，直接回退默认品牌 logo */
const logoFailed = ref(false)
let generation = 0
let controller: AbortController | undefined

/** 默认品牌 logo：随明暗主题切换深浅两版（与控制台顶栏同一套处理） */
const defaultLogoSrc = computed(() =>
  appStore.isDark ? whiteLogo : defaultLogo,
)
const logoSrc = computed(() =>
  statusPage.value?.logoUrl && !logoFailed.value
    ? statusPage.value.logoUrl
    : defaultLogoSrc.value,
)
const footerText = computed(
  () =>
    statusPage.value?.footerText?.trim() ||
    t('statusPage.public.footer', { year: new Date().getFullYear() }),
)

// 日期跨年或切换 slug 后重新尝试自定义 logo
watch(
  () => statusPage.value?.logoUrl,
  () => {
    logoFailed.value = false
  },
)

async function load() {
  const token = ++generation
  controller?.abort()
  controller = new AbortController()
  error.value = ''
  if (!slug.value) {
    statusPage.value = undefined
    loading.value = false
    return
  }
  loading.value = true
  try {
    const result = await getPublicStatusPage(slug.value, {
      signal: controller.signal,
    })
    // 后端尚未返回 monitors[].availability，这里按开关补一份演示数据（不覆盖真实数据）
    if (token === generation)
      statusPage.value = withSimulatedAvailability(result)
  } catch (cause) {
    if (token === generation) {
      statusPage.value = undefined
      error.value =
        cause instanceof Error
          ? cause.message
          : t('statusPage.public.loadFailed')
    }
  } finally {
    if (token === generation) loading.value = false
  }
}

watch(
  slug,
  () => {
    statusPage.value = undefined
    void load()
  },
  { immediate: true, flush: 'sync' },
)
onScopeDispose(() => {
  generation++
  controller?.abort()
})
</script>

<template>
  <div class="public-page">
    <header class="public-page__bar">
      <div class="public-page__brand">
        <img
          class="public-page__logo"
          :src="logoSrc"
          :alt="t('statusPage.public.brandAlt')"
          @error="logoFailed = true"
        />
        <span class="public-page__tagline">{{
          t('statusPage.public.brandTagline')
        }}</span>
      </div>
      <t-button
        variant="outline"
        :loading="loading"
        :disabled="!slug"
        @click="load"
      >
        <template #icon><AppIcon :icon="RefreshIcon" /></template>
        {{ t('statusPage.refresh') }}
      </t-button>
    </header>

    <div
      v-if="loading && !statusPage"
      class="public-page__state"
    >
      <t-loading :text="t('common.loading')" />
    </div>
    <div
      v-else-if="error"
      class="public-page__state"
    >
      <t-alert
        theme="error"
        :message="error"
      />
      <t-button @click="load">{{ t('statusPage.retry') }}</t-button>
    </div>
    <PublicStatusPagePanel
      v-else-if="statusPage"
      :page="statusPage"
    />
    <div
      v-else
      class="public-page__state"
    >
      {{ t('statusPage.public.loadFailed') }}
    </div>

    <footer class="public-page__footer">{{ footerText }}</footer>
  </div>
</template>

<style scoped lang="less">
.public-page {
  width: 100%;
  max-width: 1280px;
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
    gap: 12px;
    min-width: 0;
  }

  &__logo {
    // 自定义 logo 尺寸不可控，这里统一按高度约束，宽度随比例
    height: 26px;
    width: auto;
    max-width: 260px;
    object-fit: contain;
  }

  &__tagline {
    padding-left: 12px;
    border-left: 1px solid @beacon-border;
    font-size: 13px;
    color: @beacon-text-secondary;
    white-space: nowrap;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 240px;
    padding: 48px 24px;
    color: @beacon-text-secondary;
    background: @beacon-bg-container;
    border: 1px solid @beacon-border;
    border-radius: 4px;
  }

  &__footer {
    margin-top: 32px;
    padding: 20px 4px 0;
    border-top: 1px solid @beacon-border;
    text-align: center;
    font-size: 12px;
    line-height: 20px;
    color: @beacon-text-tertiary;
    overflow-wrap: anywhere;
  }
}

@media (max-width: 860px) {
  .public-page {
    padding: 0 0 24px;

    &__logo {
      height: 22px;
    }
  }
}
</style>
