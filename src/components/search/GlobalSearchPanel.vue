<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import panelBackground from '@/assets/search-panel-bg.avif'
import AppIcon from '@/components/AppIcon.vue'
import { Clock01Icon } from '@/icons'
import type { FeatureEntry, FeatureMatch } from '@/utils/feature-search'

/**
 * 顶栏全局搜索的结果面板（结构照参考实现）：
 * - 未输入关键词：只展示「搜索历史」（可全部清除），没有历史时是空态，不列功能
 * - 输入关键词：展示「功能入口 (N)」，两列功能卡片，命中词高亮
 */
defineOptions({ name: 'GlobalSearchPanel' })

const props = withDefaults(
  defineProps<{
    /** 输入框里的关键词，用来判断处于哪种状态 */
    keyword?: string
    /** 已翻译并算好高亮分段的搜索结果 */
    matches: readonly FeatureMatch[]
    /** 本地搜索历史，最新的在前 */
    history?: readonly string[]
    /** 键盘当前停留的条目序号，-1 表示没有 */
    activeIndex?: number
  }>(),
  { keyword: '', history: () => [], activeIndex: -1 },
)

const emit = defineEmits<{
  select: [entry: FeatureEntry]
  selectHistory: [keyword: string]
  clearHistory: []
}>()

const { t } = useI18n()

const isSearching = computed(() => props.keyword.trim().length > 0)

/** 参考实现的背景图是内联 style，这里同样用变量绑定，避免打包路径问题 */
const panelStyle = computed(() => ({
  backgroundImage: `url(${panelBackground})`,
}))
</script>

<template>
  <div
    class="search-panel"
    :style="panelStyle"
  >
    <div class="search-panel__main">
      <template v-if="isSearching">
        <section
          v-if="matches.length"
          class="search-panel__section"
        >
          <div class="search-panel__head">
            <span class="search-panel__title">
              {{ t('layout.searchFeatureTitle') }} ({{ matches.length }})
            </span>
          </div>

          <div class="search-panel__body">
            <div class="search-panel__items">
              <button
                v-for="(match, index) in matches"
                :key="match.entry.path"
                type="button"
                class="search-card"
                :class="{ 'is-active': index === activeIndex }"
                @click="emit('select', match.entry)"
              >
                <span class="search-card__icon">
                  <AppIcon
                    v-if="match.entry.icon"
                    :icon="match.entry.icon"
                  />
                </span>

                <span class="search-card__body">
                  <span class="search-card__title">
                    <template
                      v-for="(segment, segmentIndex) in match.segments"
                      :key="segmentIndex"
                    >
                      <mark v-if="segment.match">{{ segment.text }}</mark>
                      <template v-else>{{ segment.text }}</template>
                    </template>
                  </span>
                  <span
                    v-if="match.category"
                    class="search-card__desc"
                    >{{ match.category }}</span
                  >
                </span>
              </button>
            </div>
          </div>
        </section>

        <p
          v-else
          class="search-panel__empty"
        >
          {{ t('layout.searchEmpty') }}
        </p>
      </template>

      <section
        v-else
        class="search-panel__section"
      >
        <div class="search-panel__head">
          <span class="search-panel__title">{{
            t('layout.searchHistory')
          }}</span>
          <button
            v-if="history.length"
            type="button"
            class="search-panel__head-action"
            @click="emit('clearHistory')"
          >
            {{ t('layout.searchHistoryClear') }}
          </button>
        </div>

        <ul
          v-if="history.length"
          class="search-history"
        >
          <li
            v-for="(word, index) in history"
            :key="word"
          >
            <button
              type="button"
              class="search-history__item"
              :class="{ 'is-active': index === activeIndex }"
              @click="emit('selectHistory', word)"
            >
              <AppIcon
                class="search-history__icon"
                :icon="Clock01Icon"
              />
              <span class="search-history__text">{{ word }}</span>
            </button>
          </li>
        </ul>

        <p
          v-else
          class="search-history__empty"
        >
          <AppIcon :icon="Clock01Icon" />
          {{ t('layout.searchHistoryEmpty') }}
        </p>
      </section>
    </div>
  </div>
</template>

<style lang="less">
/* 面板 teleport 到 body，样式需非 scoped，用 overlayClassName 限定作用域 */
.app-search-popup {
  padding: 0;

  // TDesign 给内容容器自带 4px 8px，这里清零让面板贴边
  .t-popup__content {
    padding: 0;
  }

  .search-panel {
    width: 840px;
    max-width: calc(100vw - 32px);
    background-color: @beacon-bg-container;
    // 参考实现：顶部装饰背景图，按宽度铺满顶部、居中对齐
    background-repeat: no-repeat;
    background-position: center top;
    background-size: 100% auto;
  }

  .search-panel__main {
    padding: 24px 32px;

    > * + * {
      margin-top: 24px;
    }
  }

  .search-panel__head {
    display: flex;
    align-items: center;
    gap: @beacon-gap-l;
    margin-bottom: 12px;
  }

  .search-panel__title {
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-primary;
  }

  // 分组标题右侧的文字操作（如「全部清除」）
  .search-panel__head-action {
    margin-left: auto;
    padding: 0;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-brand;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      color: @beacon-brand-hover;
    }
  }

  // 结果区固定高度，超出滚动
  .search-panel__body {
    max-height: 154px;
    overflow-y: auto;
  }

  .search-panel__items {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;

    > * {
      min-width: 0;
    }
  }

  .search-card {
    display: flex;
    align-items: center;
    padding: 4px 16px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    background-color: var(--td-bg-color-secondarycontainer);
    border: 0;

    &:hover,
    &.is-active {
      background-color: var(--td-bg-color-secondarycontainer-hover);
    }
  }

  .search-card__icon {
    display: inline-flex;
    flex: none;
    padding-right: 12px;
    color: @beacon-text-primary;
  }

  .search-card__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .search-card__title {
    .text-ellipsis();

    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;

    // 命中词用品牌色，去掉浏览器给 mark 的默认底色
    mark {
      color: @beacon-brand;
      background-color: transparent;
    }
  }

  .search-card__desc {
    .text-ellipsis();

    font-size: @beacon-font-size-caption;
    line-height: 18px;
    color: @beacon-text-disabled;
  }

  .search-panel__empty {
    margin: 0;
    padding: 24px 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
    text-align: center;
  }

  // ---------- 搜索历史（未输入关键词时） ----------
  // 与结果区同高：历史少或为空时面板也不会塌成一条
  .search-history {
    min-height: 154px;
    max-height: 224px;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .search-history__item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 12px;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-primary;
    text-align: left;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover,
    &.is-active {
      color: @beacon-brand;
      background-color: var(--td-bg-color-secondarycontainer-hover);
    }
  }

  .search-history__icon {
    color: @beacon-text-tertiary;
  }

  .search-history__text {
    .text-ellipsis();
  }

  .search-history__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 154px;
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }
}
</style>
