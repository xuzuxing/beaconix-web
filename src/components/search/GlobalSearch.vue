<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import GlobalSearchPanel from '@/components/search/GlobalSearchPanel.vue'
import { featureSearchSources } from '@/config/search'
import { Cancel01Icon, Search01Icon } from '@/icons'
import { useUserStore } from '@/stores'
import type { FeatureEntry } from '@/utils/feature-search'
import {
  SEARCH_HISTORY_STORAGE_KEY,
  buildFeatureEntries,
  filterFeatureEntries,
  normalizeHistory,
  pushHistory,
} from '@/utils/feature-search'

/**
 * 顶栏全局搜索：点击/聚焦输入框后在下方弹出面板。
 *
 * - 未输入关键词时面板只展示「搜索历史」（本地保存），不预先列出功能
 * - 输入关键词后展示「功能入口」，即路由表里有标题、当前角色可见的页面
 *   （含顶栏下拉进入的隐藏页），详细口径见 utils/feature-search.ts
 * 键盘：↓/↑ 移动，Enter 打开（历史模式下是回填关键词），Esc 关闭；顶栏「/」徽标也在这里接线。
 */
defineOptions({ name: 'GlobalSearch' })

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()

const visible = ref(false)
const keyword = ref('')
const activeIndex = ref(0)
const history = ref<string[]>(readHistory())
const inputRef = ref<HTMLInputElement>()

/** 按当前用户的全局角色过滤，与侧边菜单同一口径 */
const entries = computed(() =>
  buildFeatureEntries(featureSearchSources, userStore.user ? [userStore.user.globalRole] : []),
)

const matches = computed(() => filterFeatureEntries(entries.value, keyword.value, (key) => t(key)))

/** 只有输入了关键词才出结果，否则展示搜索历史 */
const isSearching = computed(() => keyword.value.trim().length > 0)

/** 键盘游标对应的列表长度：结果列表或历史列表 */
const itemCount = computed(() => (isSearching.value ? matches.value.length : history.value.length))

/** 本地搜索历史：隐私模式、坏数据都退化为空列表 */
function readHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY)
    return raw ? normalizeHistory(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

/** 记一次搜索：写不进去（如隐私模式）时只影响下次访问，忽略 */
function remember(keywordText: string) {
  history.value = pushHistory(history.value, keywordText)
  try {
    window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(history.value))
  } catch {
    // 忽略写入失败
  }
}

/** 关键词变了，键盘停留位置回到第一条 */
watch(keyword, () => {
  activeIndex.value = 0
})

/** 关闭时清空关键词，下次打开回到搜索历史 */
watch(visible, (opened) => {
  if (opened) return
  keyword.value = ''
  activeIndex.value = 0
})

async function open() {
  visible.value = true
  await nextTick()
  inputRef.value?.focus()
}

function close() {
  visible.value = false
}

/** 键盘移动：夹在列表区间内，不循环 */
function move(step: number) {
  if (!itemCount.value) return
  const next = activeIndex.value + step
  activeIndex.value = Math.min(Math.max(next, 0), itemCount.value - 1)
}

async function selectFeature(entry: FeatureEntry) {
  const searched = keyword.value.trim()
  close()
  if (searched) remember(searched)
  if (router.currentRoute.value.path !== entry.path) await router.push(entry.path)
}

/** 点/选历史记录：回填关键词并切到结果列表，面板保持打开 */
function selectHistory(word: string) {
  keyword.value = word
  activeIndex.value = 0
  void nextTick(() => inputRef.value?.focus())
}

/** 清空输入框：回到搜索历史，面板保持打开 */
function clearKeyword() {
  keyword.value = ''
  activeIndex.value = 0
  void nextTick(() => inputRef.value?.focus())
}

/** 清空全部搜索历史 */
function clearHistory() {
  history.value = []
  try {
    window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY)
  } catch {
    // 忽略（隐私模式等）
  }
}

/** Enter：结果模式打开当前条目，历史模式把词填回输入框 */
function submit() {
  if (isSearching.value) {
    const entry = matches.value[activeIndex.value]?.entry
    if (entry) void selectFeature(entry)
    return
  }

  const word = history.value[activeIndex.value]
  if (word) selectHistory(word)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    submit()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

/**
 * 输入框的点击由自己接管：停止冒泡避免触发 popup 的开关切换，
 * 否则面板打开后再点输入框会被关掉。
 */
function onInputClick() {
  if (!visible.value) void open()
}

/** 非输入态按下「/」聚焦搜索框，对应顶栏那枚快捷键徽标 */
function onShortcut(event: KeyboardEvent) {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target?.isContentEditable) return
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  event.preventDefault()
  void open()
}

onMounted(() => document.addEventListener('keydown', onShortcut))
onBeforeUnmount(() => document.removeEventListener('keydown', onShortcut))
</script>

<template>
  <t-popup v-model:visible="visible" trigger="click" placement="bottom-right" :show-arrow="false"
    overlay-class-name="app-search-popup">
    <label class="global-search">
      <AppIcon class="global-search__icon" :icon="Search01Icon" />
      <input ref="inputRef" v-model="keyword" class="global-search__input" type="search"
        :placeholder="t('layout.searchPlaceholder')" @click.stop="onInputClick" @keydown="onKeydown" />
      <button v-if="keyword" type="button" class="global-search__clear"
        :aria-label="t('layout.searchClear')" @click.stop="clearKeyword">
        <AppIcon :icon="Cancel01Icon" :size="14" />
      </button>
      <span v-else class="global-search__hotkey">/</span>
    </label>

    <template #content>
      <GlobalSearchPanel :keyword="keyword" :matches="matches" :history="history"
        :active-index="activeIndex" @select="selectFeature" @select-history="selectHistory"
        @clear-history="clearHistory" />
    </template>
  </t-popup>
</template>

<style scoped lang="less">
.global-search {
  position: relative;
  display: flex;
  align-items: center;
  width: 360px;
  height: 30px;
  margin: 0 8px;
  padding: 0 12px 0 36px;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;
  border-radius: @beacon-radius-m;

  &:hover {
    border-color: @beacon-brand-hover;
  }

  &__icon {
    position: absolute;
    left: 12px;
    color: @beacon-text-tertiary;
  }

  &__input {
    flex: 1;
    min-width: 0;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
    background-color: transparent;
    border: 0;
    outline: none;

    &::placeholder {
      color: @beacon-text-tertiary;
    }

    &::-webkit-search-cancel-button {
      display: none;
    }
  }

  &__clear {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    color: @beacon-text-tertiary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius-m;

    &:hover {
      color: @beacon-text-secondary;
    }
  }

  &__hotkey {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: 20px;
    padding: 0 7px;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-tertiary;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border-strong;
    border-radius: @beacon-radius-m;
  }
}
</style>
