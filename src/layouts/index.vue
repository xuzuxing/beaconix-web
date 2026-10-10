<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import PageRating from '@/components/PageRating.vue'
import { providePageHeader } from '@/composables/usePageHeader'
import { ArrowLeft01Icon } from '@/icons'
import AppContent from './components/AppContent.vue'
import AppHeader from './components/AppHeader.vue'
import SecondaryNav from './components/SecondaryNav.vue'
import SideNav from './components/SideNav.vue'

defineOptions({ name: 'AppLayout' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

/** 标题栏状态：页面用 usePageHeader 覆盖标题并开启返回按钮 */
const pageHeader = providePageHeader()
const back = computed(() => pageHeader.back.value)
const goBack = () => {
  if (back.value) void router.push(back.value)
}

/**
 * 内容区标题栏：标题取页面覆盖值、二级菜单名（subTitleKey）或路由标题。
 * 概览页这类自带头部的页面用 meta.hideHeader 关掉整条。
 */
const metaTitle = computed(() => {
  const titleKey = route.meta.subTitleKey ?? route.meta.titleKey
  return titleKey ? t(titleKey) : ''
})
const pageTitle = computed(() => pageHeader.title.value || metaTitle.value)
const showPageHeader = computed(() => !route.meta.hideHeader && Boolean(pageTitle.value))
/** 评价卡：监控这类自带工具栏的页面用 meta.hideRating 关掉 */
const showRating = computed(() => !route.meta.hideRating)
</script>

<template>
  <div class="layout" :class="{ 'layout--dashboard': route.name === 'dashboard' || route.name === 'monitor' || route.name === 'monitor-detail', 'layout--monitor': route.name === 'monitor' || route.name === 'monitor-detail' }">
    <AppHeader />

    <div class="layout__main">
      <SideNav />
      <SecondaryNav />

      <main class="layout__content">
        <!--
          标题栏分左右两组：左侧是「返回按钮 + 标题 + 附加区」，右侧是「评价卡 + 动作区」。
          页面可通过 <Teleport to="#layout-header-title-addon">（标题右侧，如类型标签、页内 Tab）
          与 <Teleport to="#layout-header-actions">（最右侧，如页面级操作按钮）注入内容；
          标题与返回按钮用 usePageHeader 声明。
          容器用 v-show 常驻 DOM：页面挂载时就要能找到 Teleport 目标。
        -->
        <div v-show="showPageHeader" class="layout__content-header">
          <div class="layout__content-header-left">
            <t-button
              v-if="back"
              class="layout__header-back"
              variant="text"
              shape="square"
              :aria-label="t('layout.back')"
              @click="goBack"
            >
              <AppIcon :icon="ArrowLeft01Icon" :size="20" />
            </t-button>
            <h2 class="layout__page-title">{{ pageTitle }}</h2>
            <div id="layout-header-title-addon" class="layout__header-slot"></div>
          </div>

          <div class="layout__content-header-right">
            <PageRating v-if="showRating" />
            <div id="layout-header-actions" class="layout__header-slot"></div>
          </div>
        </div>

        <div
          class="layout__content-body"
          :class="{ 'layout__content-body--large': !showPageHeader }"
        >
          <AppContent />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped lang="less">
.layout {
  display: flex;
  flex-direction: column;
  min-width: @beacon-layout-min-width;
  height: 100vh;
  overflow: hidden;

  &--dashboard {
    min-width: 0;

    @media (max-width: 1400px) {
      :deep(.app-header__search) { width: 180px; }
      :deep(.app-header__guide) { display: none; }
    }

    @media (max-width: 900px) {
      :deep(.app-header__search),
      :deep(.app-header__pending),
      :deep(.app-header__icon-btn) { display: none; }
      :deep(.app-header__main) { flex: 1; min-width: 0; gap: 4px; padding-left: 8px; }
      :deep(.app-header__team),
      :deep(.app-header__project) { min-width: 0; }
      :deep(.app-header__team-name),
      :deep(.app-header__project-name) { max-width: 90px; }
      :deep(.app-header__extra) { margin-left: 0; padding-right: 4px; }
      :deep(.app-header__user) { margin-right: 0; padding: 0 8px; }
      .layout__content-body { padding: 16px; }
    }
  }
  &--monitor {
    .layout__content-body { padding: 24px; }
    @media (max-width: 900px) {
      :deep(.secondary-nav) { display: none; }
      .layout__content-body { padding: 16px; }
    }
  }

  &__main {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  &__content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background-color: @beacon-bg-page;
  }

  // 页面标题栏：白底 + 底部 1px 分隔线
  &__content-header {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 10px 20px;
    background-color: @beacon-bg-container;

    &::after {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 1px;
      background-color: @beacon-border;
      content: '';
    }
  }

  // 返回按钮：下钻页面（详情页）用 usePageHeader 开启，蓝色箭头、无文字。
  // 负外边距抵消按钮内边距，让图标与左侧内容对齐线齐平
  &__header-back {
    flex: none;
    margin-right: -8px;
    margin-left: -6px;
    color: @beacon-brand;
  }

  &__page-title {
    max-width: 70%;
    margin: 0 20px 0 0;
    overflow: hidden;
    font-size: @beacon-font-size-section;
    font-weight: 700;
    line-height: 30px;
    color: @beacon-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // 标题栏左右两组：左侧（标题 + 页内 Tab）可伸缩，右侧（评分 + 快捷链接）固定宽度
  &__content-header-left {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 20px;
    min-width: 0;
  }

  &__content-header-right {
    display: flex;
    flex: none;
    align-items: center;
    gap: 20px;
  }

  // 页面注入区：页面把内容 Teleport 进来；未注入时（空容器）不占位
  &__header-slot {
    display: flex;
    align-items: center;
    gap: 12px;

    &:empty {
      display: none;
    }
  }

  &__content-body {
    flex: 1;
    min-height: 0;
    padding: 20px;
    overflow-y: auto;

    // 概览页这类自带头部的页面留更多留白
    &--large {
      padding: 40px;
    }
  }

  // 窄屏：标题与动作区各占一行，避免动作按钮把标题挤成 0 宽
  @media (max-width: 600px) {
    &__content-header {
      flex-wrap: wrap;
      gap: 8px;
    }

    &__content-header-left,
    &__content-header-right {
      flex: 1 1 100%;
    }

    &__content-header-right {
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }
}
</style>
