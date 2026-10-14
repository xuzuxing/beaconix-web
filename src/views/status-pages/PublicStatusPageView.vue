<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { getPublicStatusPage } from '@/api'
import type { PublicStatusPage } from '@/api/types/status-page'
import AppIcon from '@/components/AppIcon.vue'
import PublicStatusPagePanel from '@/components/status-pages/PublicStatusPagePanel.vue'
import { RefreshIcon } from '@/icons'
import { withSimulatedAvailability } from '@/utils/status-page-simulated'

/**
 * 公开状态页 `/status/:slug`（BlankLayout，不带控制台框架）。
 *
 * 走公开接口 GET /status/:slug，页面被停用或 slug 不存在时后端返回 404，
 * 这里只提示「状态页不存在或未启用」，不泄露组织内其它信息。
 */
defineOptions({ name: 'PublicStatusPageView' })
const { t } = useI18n()
const route = useRoute()
const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : ''))
const statusPage = ref<PublicStatusPage>()
const loading = ref(false)
const error = ref('')
let generation = 0
let controller: AbortController | undefined

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
    const result = await getPublicStatusPage(slug.value, { signal: controller.signal })
    // 后端尚未返回 monitors[].availability，这里按开关补一份演示数据（不覆盖真实数据）
    if (token === generation) statusPage.value = withSimulatedAvailability(result)
  } catch (cause) {
    if (token === generation) {
      statusPage.value = undefined
      error.value = cause instanceof Error ? cause.message : t('statusPage.public.loadFailed')
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
      <span class="public-page__brand">Beacon</span>
      <t-button
        variant="text"
        shape="square"
        :loading="loading"
        :aria-label="t('statusPage.refresh')"
        @click="load"
        ><AppIcon :icon="RefreshIcon"
      /></t-button>
    </header>

    <t-card class="public-page__card" :bordered="false">
      <div v-if="loading && !statusPage" class="public-page__state">
        <t-loading :text="t('common.loading')" />
      </div>
      <div v-else-if="error" class="public-page__state">
        <t-alert theme="error" :message="error" />
        <t-button @click="load">{{ t('statusPage.retry') }}</t-button>
      </div>
      <PublicStatusPagePanel v-else-if="statusPage" :page="statusPage" />
      <div v-else class="public-page__state">{{ t('statusPage.public.loadFailed') }}</div>
    </t-card>
  </div>
</template>

<style scoped lang="less">
.public-page {
  width: 100%;
  max-width: 880px;

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 4px 16px;
  }

  &__brand {
    font-size: @beacon-font-size-section;
    font-weight: 600;
    color: @beacon-text-primary;
  }

  &__card {
    width: 100%;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
    color: @beacon-text-secondary;
  }
}
</style>
