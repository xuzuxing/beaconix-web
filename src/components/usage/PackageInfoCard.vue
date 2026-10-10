<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { packageSummary } from '@/config/usage'
import { ArrowRight01Icon } from '@/icons'

/** 套餐用量页顶部的套餐信息卡：左侧套餐概况，右侧续期任务与能力对比 */
defineOptions({ name: 'PackageInfoCard' })

const { t } = useI18n()

const summary = packageSummary

/** 免费续期任务流程 */
const renewSteps = computed(() => [
  t('usage.package.renewStep1'),
  t('usage.package.renewStep2'),
  t('usage.package.renewStep3'),
])

/** 当前套餐能力 / 升级后解锁的能力 */
const currentAbilities = computed(() => [
  t('usage.package.currentQuota'),
  t('usage.package.currentServerless'),
  t('usage.package.currentModel'),
  t('usage.package.currentLimit'),
])

const nextAbilities = computed(() => [
  t('usage.package.nextQuota'),
  t('usage.package.nextTimeout'),
  t('usage.package.nextEip'),
  t('usage.package.nextQps'),
])
</script>

<template>
  <div class="package">
    <!-- 左侧：套餐概况 -->
    <div class="package__left">
      <div class="package__name">
        {{ t('usage.package.name') }}
        <a class="package__billing" href="#">
          {{ t('usage.package.billing') }}
          <AppIcon :icon="ArrowRight01Icon" :size="14" />
        </a>
      </div>

      <div class="package__time">
        <span>{{ t('usage.package.validUntil') }} {{ summary.validUntil }}</span>
        <span class="package__divider" />
        <span>{{ t('usage.package.noAutoRenew') }}</span>
      </div>

      <div class="package__points">
        <strong>{{ t('usage.package.pointsLabel') }}</strong>
        <span class="package__points-value">{{ t('usage.package.pointsValue') }}</span>
        <span class="package__points-total">{{ t('usage.package.pointsTotal') }}</span>
        <a class="package__points-tip" href="#">{{ t('usage.package.pointsTip') }}</a>
      </div>

      <t-progress
        class="package__progress"
        theme="line"
        :percentage="summary.pointsPercent"
        :label="false"
      />

      <div class="package__actions">
        <t-button theme="primary" size="small">{{ t('usage.package.upgrade') }}</t-button>
        <t-button variant="outline" size="small">{{ t('usage.package.renew') }}</t-button>
        <t-button variant="outline" size="small">{{ t('usage.package.addon') }}</t-button>
      </div>
    </div>

    <!-- 右侧：续期任务流程 + 能力对比 -->
    <div class="package__right">
      <section class="package__block">
        <h3 class="package__block-title">{{ t('usage.package.renewTask') }}</h3>
        <ol class="package__steps">
          <li v-for="(step, index) in renewSteps" :key="step" class="package__step">
            <span class="package__step-num">{{ index + 1 }}</span>
            <span class="package__step-text">{{ step }}</span>
          </li>
        </ol>
        <a class="package__more" href="#">{{ t('usage.package.renewGuide') }}</a>
      </section>

      <section class="package__block">
        <h3 class="package__block-title">{{ t('usage.package.currentTitle') }}</h3>
        <ul class="package__abilities">
          <li v-for="item in currentAbilities" :key="item">{{ item }}</li>
        </ul>
        <a class="package__more" href="#">{{ t('usage.package.moreAbility') }}</a>
      </section>

      <section class="package__block">
        <h3 class="package__block-title">{{ t('usage.package.nextTitle') }}</h3>
        <ul class="package__abilities">
          <li v-for="item in nextAbilities" :key="item">{{ item }}</li>
        </ul>
        <a class="package__more" href="#">{{ t('usage.package.moreAbility') }}</a>
      </section>

      <button type="button" class="package__change">{{ t('usage.package.changePlan') }}</button>
    </div>
  </div>
</template>

<style scoped lang="less">
.package {
  display: flex;
  gap: 32px;
  padding: 20px;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;

  // ---------- 左侧套餐概况 ----------
  &__left {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 12px;
    width: 360px;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__billing {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: @beacon-font-size-base;
    font-weight: 400;
    color: @beacon-brand;

    &:hover {
      color: @beacon-brand-hover;
    }
  }

  &__time {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__divider {
    width: 1px;
    height: 12px;
    background-color: @beacon-border-strong;
  }

  &__points {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-primary;
  }

  &__points-value {
    font-size: 20px;
    line-height: 28px;
    color: @beacon-text-primary;
  }

  &__points-total {
    color: @beacon-text-tertiary;
  }

  &__points-tip {
    margin-left: 4px;
    color: @beacon-brand;

    &:hover {
      color: @beacon-brand-hover;
    }
  }

  &__progress {
    margin: 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  // ---------- 右侧信息块 ----------
  &__right {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
    min-width: 0;
  }

  &__block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  &__block-title {
    margin: 0;
    font-size: @beacon-font-size-base;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__steps {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__step {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  // 步骤序号：品牌色圆点
  &__step-num {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    font-size: @beacon-font-size-base;
    color: var(--td-text-color-anti);
    background-color: @beacon-brand;
    border-radius: 50%;
  }

  &__abilities {
    display: flex;
    flex-direction: column;
    gap: 8px;

    li {
      position: relative;
      padding-left: 12px;
      font-size: @beacon-font-size-base;
      line-height: 20px;
      color: @beacon-text-secondary;

      &::before {
        position: absolute;
        top: 8px;
        left: 0;
        width: 4px;
        height: 4px;
        background-color: @beacon-text-tertiary;
        border-radius: 50%;
        content: '';
      }
    }
  }

  &__more {
    font-size: @beacon-font-size-base;
    color: @beacon-brand;

    &:hover {
      color: @beacon-brand-hover;
    }
  }

  // 套餐变配：文本按钮，独立成行
  &__change {
    grid-column: 1 / -1;
    justify-self: start;
    padding: 0;
    font-family: inherit;
    font-size: @beacon-font-size-base;
    color: @beacon-brand;
    cursor: pointer;
    background: none;
    border: 0;

    &:hover {
      color: @beacon-brand-hover;
    }
  }
}
</style>
