<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PackageInfoCard from '@/components/usage/PackageInfoCard.vue'
import UsageOverview from '@/components/usage/UsageOverview.vue'

/** 套餐用量页：页内 Tab 与快捷链接注入布局标题栏，内容为套餐信息卡 + 功能用量概览 */
defineOptions({ name: 'UsageView' })

const { t } = useI18n()

const activeTab = ref('basic')

const tabOptions = computed(() => [
  { value: 'basic', label: t('usage.tabs.basic') },
  { value: 'detail', label: t('usage.tabs.detail') },
  { value: 'token', label: t('usage.tabs.token') },
  { value: 'package', label: t('usage.tabs.package') },
])

const links = computed(() => [
  t('usage.links.price'),
  t('usage.links.bill'),
  t('usage.links.invoice'),
  t('usage.links.order'),
])
</script>

<template>
  <div class="usage">
    <!-- 页内 Tab：注入到布局标题栏的标题右侧（defer：等布局渲染完再挂载） -->
    <Teleport to="#layout-header-title-addon" defer>
      <nav class="usage__tabs">
        <button
          v-for="tab in tabOptions"
          :key="tab.value"
          type="button"
          class="usage__tab"
          :class="{ 'is-active': activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </nav>
    </Teleport>

    <!-- 快捷入口：注入到布局标题栏的评分卡片右侧 -->
    <Teleport to="#layout-header-actions" defer>
      <a v-for="link in links" :key="link" class="usage__link" href="#">{{ link }}</a>
    </Teleport>

    <PackageInfoCard />
    <UsageOverview />
  </div>
</template>

<style scoped lang="less">
.usage {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__tabs {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  // 页内 Tab：文字 + 选中态下划线
  &__tab {
    height: 30px;
    padding: 0;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    cursor: pointer;
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;

    &:hover {
      color: @beacon-brand;
    }

    &.is-active {
      color: @beacon-brand;
      border-bottom-color: @beacon-brand;
    }
  }

  &__link {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;

    &:hover {
      color: @beacon-brand;
    }
  }
}
</style>
