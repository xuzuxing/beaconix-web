<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { guideCategories, type GuideStep } from '@/config/guide'
import { ArrowDown01Icon, ArrowRight01Icon, Cancel01Icon, LinkSquare02Icon } from '@/icons'

import CodeBlock from './CodeBlock.vue'

/**
 * 接入指引弹窗：一级分类（框架集成 / Beaconix MCP）→ 二级分类 → 场景 → 分步指引。
 * 每一步内含可折叠面板、说明与代码页签。
 */
defineOptions({ name: 'GuideDialog' })

const visible = defineModel<boolean>({ required: true })

const { t } = useI18n()

const categories = guideCategories

const activeCategoryKey = ref(categories[0]!.key)
const activeSubKey = ref(categories[0]!.subCategories[0]!.key)
const activeScenarioKey = ref(categories[0]!.subCategories[0]!.scenarios[0]!.key)
/** 各步骤展开状态与当前选中的代码页签 */
const expandedSteps = ref<string[]>([])
const codeTabs = ref<Record<string, string>>({})

const activeCategory = computed(
  () => categories.find((item) => item.key === activeCategoryKey.value) ?? categories[0]!,
)
const activeSub = computed(
  () =>
    activeCategory.value.subCategories.find((item) => item.key === activeSubKey.value) ??
    activeCategory.value.subCategories[0]!,
)
const activeScenario = computed(
  () =>
    activeSub.value.scenarios.find((item) => item.key === activeScenarioKey.value) ??
    activeSub.value.scenarios[0]!,
)

const scenarioOptions = computed(() =>
  activeSub.value.scenarios.map((item) => ({ content: t(item.nameKey), value: item.key })),
)

function selectCategory(key: string) {
  activeCategoryKey.value = key
  const sub = categories.find((item) => item.key === key)!.subCategories[0]!
  activeSubKey.value = sub.key
  activeScenarioKey.value = sub.scenarios[0]!.key
}

function selectSub(key: string) {
  activeSubKey.value = key
  const sub = activeCategory.value.subCategories.find((item) => item.key === key)!
  activeScenarioKey.value = sub.scenarios[0]!.key
}

function selectScenario(data: { value?: string | number }) {
  activeScenarioKey.value = String(data.value ?? '')
}

function isStepExpanded(step: GuideStep) {
  return expandedSteps.value.includes(step.key)
}

function toggleStep(step: GuideStep) {
  expandedSteps.value = isStepExpanded(step)
    ? expandedSteps.value.filter((key) => key !== step.key)
    : [...expandedSteps.value, step.key]
}

function currentCodeTab(step: GuideStep) {
  return codeTabs.value[step.key] ?? step.codeTabs[0]!.key
}

function setCodeTab(stepKey: string, tabKey: string) {
  codeTabs.value = { ...codeTabs.value, [stepKey]: tabKey }
}

function activeCode(step: GuideStep) {
  return step.codeTabs.find((tab) => tab.key === currentCodeTab(step)) ?? step.codeTabs[0]!
}

// 切换场景时默认展开第一步，其余折叠
watch(
  activeScenarioKey,
  () => {
    const [first] = activeScenario.value.steps
    expandedSteps.value = first ? [first.key] : []
  },
  { immediate: true },
)
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    class="guide-dialog"
    width="min(960px, calc(100vw - 24px))"
    :footer="false"
    :close-btn="false"
    :close-on-overlay-click="true"
  >
    <template #header>
      <div class="guide-dialog__header">
        <h3 class="guide-dialog__title">{{ t('guide.title') }}</h3>
        <button
          type="button"
          class="guide-dialog__close"
          :aria-label="t('guide.close')"
          @click="visible = false"
        >
          <AppIcon :icon="Cancel01Icon" />
        </button>
      </div>
    </template>

    <div class="guide-dialog__body">
      <t-alert theme="info" :message="t('access.patHint')" />
      <!-- 一级分类：标题 + 说明 -->
      <ul class="guide-dialog__categories">
        <li v-for="category in categories" :key="category.key">
          <button
            type="button"
            class="guide-dialog__category"
            :class="{ 'is-active': category.key === activeCategoryKey }"
            @click="selectCategory(category.key)"
          >
            <span class="guide-dialog__category-title">{{ t(category.titleKey) }}</span>
            <span class="guide-dialog__category-desc">{{ t(category.descKey) }}</span>
          </button>
        </li>
      </ul>

      <!-- 二级分类 -->
      <ul class="guide-dialog__sub-categories">
        <li v-for="sub in activeCategory.subCategories" :key="sub.key">
          <button
            type="button"
            class="guide-dialog__sub-category"
            :class="{ 'is-active': sub.key === activeSubKey }"
            @click="selectSub(sub.key)"
          >
            {{ t(sub.labelKey) }}
          </button>
        </li>
      </ul>

      <!-- 场景选择 + 详细文档 -->
      <div class="guide-dialog__scenario">
        <t-dropdown trigger="click" :options="scenarioOptions" @click="selectScenario">
          <button type="button" class="guide-dialog__scenario-btn">
            <span>{{ t(activeScenario.nameKey) }}</span>
            <AppIcon :icon="ArrowDown01Icon" />
          </button>
        </t-dropdown>

        <a class="guide-dialog__doc" :href="activeScenario.docUrl" target="_blank" rel="noreferrer">
          {{ t('guide.detailDoc') }}
          <AppIcon :icon="LinkSquare02Icon" :size="14" />
        </a>
      </div>

      <!-- 步骤 -->
      <ol class="guide-dialog__steps">
        <li
          v-for="(step, index) in activeScenario.steps"
          :key="step.key"
          class="guide-dialog__step"
        >
          <div class="guide-dialog__step-rail">
            <span class="guide-dialog__step-num">{{ index + 1 }}</span>
            <span v-if="index < activeScenario.steps.length - 1" class="guide-dialog__step-line" />
          </div>

          <div class="guide-dialog__step-body">
            <button
              type="button"
              class="guide-dialog__step-header"
              :aria-expanded="isStepExpanded(step)"
              @click="toggleStep(step)"
            >
              <AppIcon
                class="guide-dialog__step-caret"
                :icon="isStepExpanded(step) ? ArrowDown01Icon : ArrowRight01Icon"
                :size="16"
              />
              <span>{{ t(step.titleKey) }}</span>
            </button>

            <div v-show="isStepExpanded(step)" class="guide-dialog__step-content">
              <p v-if="step.descKey" class="guide-dialog__step-desc">{{ t(step.descKey) }}</p>

              <ul class="guide-dialog__code-tabs">
                <li v-for="tab in step.codeTabs" :key="tab.key">
                  <button
                    type="button"
                    class="guide-dialog__code-tab"
                    :class="{ 'is-active': currentCodeTab(step) === tab.key }"
                    @click="setCodeTab(step.key, tab.key)"
                  >
                    {{ tab.label }}
                  </button>
                </li>
              </ul>

              <CodeBlock :code="activeCode(step).code" :language="activeCode(step).language" />
            </div>
          </div>
        </li>
      </ol>
    </div>
  </t-dialog>
</template>

<style scoped lang="less">
.guide-dialog {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: @beacon-gap-l;
    width: 100%;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
  }

  &__close {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius-m;

    &:hover {
      color: @beacon-brand;
      background-color: @beacon-bg-hover;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-height: 70vh;
    overflow-y: auto;
  }

  // ---------- 一级分类 ----------
  &__categories {
    display: flex;
    gap: 32px;
    border-bottom: 1px solid @beacon-border;
  }

  &__category {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0 12px;
    text-align: left;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-bottom: 2px solid transparent;

    &.is-active {
      border-bottom-color: @beacon-brand;

      .guide-dialog__category-title {
        color: @beacon-brand;
      }
    }
  }

  &__category-title {
    font-size: 14px;
    font-weight: @beacon-font-weight-medium;
    line-height: 22px;
    color: @beacon-text-primary;
  }

  &__category-desc {
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-tertiary;
  }

  // ---------- 二级分类 ----------
  &__sub-categories {
    display: flex;
    gap: 24px;
    border-bottom: 1px solid @beacon-border;
  }

  &__sub-category {
    padding: 0 0 8px;
    font-size: 14px;
    line-height: 22px;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
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

  // ---------- 场景选择 ----------
  &__scenario {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: @beacon-gap-l;
  }

  &__scenario-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 12px;
    font-family: inherit;
    font-size: @beacon-font-size-menu;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;

    &:hover {
      border-color: @beacon-brand;
    }
  }

  &__doc {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: @beacon-font-size-base;
    color: @beacon-brand;

    &:hover {
      color: @beacon-brand-hover;
    }
  }

  // ---------- 步骤 ----------
  &__steps {
    display: flex;
    flex-direction: column;
  }

  &__step {
    display: flex;
    gap: 12px;
  }

  &__step-rail {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    width: 22px;
  }

  &__step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    font-size: @beacon-font-size-base;
    color: var(--td-text-color-anti);
    background-color: @beacon-brand;
    border-radius: 50%;
  }

  &__step-line {
    flex: 1;
    width: 1px;
    min-height: 12px;
    margin: 4px 0;
    background-color: @beacon-border;
  }

  &__step-body {
    flex: 1;
    min-width: 0;
    padding-bottom: 20px;
  }

  &__step-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    font-family: inherit;
    font-size: 14px;
    font-weight: @beacon-font-weight-medium;
    line-height: 22px;
    color: @beacon-text-primary;
    cursor: pointer;
    background-color: transparent;
    border: 0;

    &:hover {
      color: @beacon-brand;
    }
  }

  &__step-caret {
    color: @beacon-text-tertiary;
  }

  &__step-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  }

  &__step-desc {
    margin: 0;
    font-size: 14px;
    line-height: 22px;
    color: @beacon-text-secondary;
  }

  // ---------- 代码页签 ----------
  &__code-tabs {
    display: flex;
    gap: 4px;
    width: fit-content;
    padding: 3px;
    background-color: @beacon-bg-page;
    border-radius: @beacon-radius-m;
  }

  &__code-tab {
    padding: 3px 12px;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-secondary;
    cursor: pointer;
    background-color: transparent;
    border: 0;
    border-radius: @beacon-radius-m;

    &.is-active {
      color: @beacon-text-primary;
      background-color: @beacon-bg-container;
      box-shadow: var(--td-shadow-1);
    }
  }
}
</style>
