<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import PageRating from '@/components/PageRating.vue'
import AppContent from './components/AppContent.vue'
import AppHeader from './components/AppHeader.vue'
import SecondaryNav from './components/SecondaryNav.vue'
import SideNav from './components/SideNav.vue'

defineOptions({ name: 'AppLayout' })

const route = useRoute()
const { t } = useI18n()

/**
 * 内容区标题栏：标题取二级菜单名（subTitleKey）或路由标题。
 * 概览页自带头部（meta.hideHeader），不再渲染这一条。
 */
const pageTitle = computed(() => {
  const titleKey = route.meta.subTitleKey ?? route.meta.titleKey
  return titleKey ? t(titleKey) : ''
})

const showPageHeader = computed(() => !route.meta.hideHeader && Boolean(pageTitle.value))
</script>

<template>
  <div class="layout">
    <AppHeader />

    <div class="layout__main">
      <SideNav />
      <SecondaryNav />

      <main class="layout__content">
        <!--
          标题栏分左右两组，中间各留一个空容器：
          页面可通过 <Teleport to="#layout-header-title-addon">（标题右侧，如页内 Tab）
          与 <Teleport to="#layout-header-actions">（评分卡片右侧，如快捷链接）注入内容。
        -->
        <div v-if="showPageHeader" class="layout__content-header">
          <div class="layout__content-header-left">
            <h2 class="layout__page-title">{{ pageTitle }}</h2>
            <div id="layout-header-title-addon" class="layout__header-slot"></div>
          </div>

          <div class="layout__content-header-right">
            <PageRating />
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
}
</style>
