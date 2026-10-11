<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/AppIcon.vue'
import { ArrowDown01Icon } from '@/icons'

import AiToolSection from '@/components/overview/AiToolSection.vue'
import AttentionPanel from '@/components/overview/AttentionPanel.vue'
import MetricChartCard from '@/components/overview/MetricChartCard.vue'
import OverviewHero from '@/components/overview/OverviewHero.vue'
import TemplateGallery from '@/components/overview/TemplateGallery.vue'
import TokenGuideSection from '@/components/overview/TokenGuideSection.vue'

defineOptions({ name: 'OverviewView' })

const { t } = useI18n()

const xLabels = ['22:30', '22:40', '22:50', '23:00', '23:10']

/**
 * 概览指标。图表为静态示例数据，接入监控接口后替换 values 即可。
 * 曲线最高点决定 Y 轴刻度（例如 QPS 的尖峰使刻度为 4 / 3.2 / … / 0）。
 */
const metrics = computed(() => [
  {
    key: 'qps',
    title: t('overview.metrics.qps'),
    tip: t('overview.metrics.qpsTip'),
    values: [0, 0, 0, 0.1, 4, 0.2, 0, 0, 0, 0, 0, 0],
    labels: xLabels,
  },
  {
    key: 'invocations',
    title: t('overview.metrics.invocations'),
    values: [0.02, 0.03, 0.02, 0.04, 0.03, 0.02, 0.03, 0.02, 0.02, 0.03, 0.02, 0.02],
    labels: xLabels,
  },
  {
    key: 'errors',
    title: t('overview.metrics.errors'),
    tip: t('overview.metrics.errorsTip'),
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    labels: xLabels,
  },
])
</script>

<template>
  <div class="overview">
    <OverviewHero />

    <section class="overview__section">
      <div class="overview__section-head">
        <div class="overview__section-titles">
          <h3 class="overview__section-title">{{ t('overview.metrics.title') }}</h3>
          <button type="button" class="overview__range">
            {{ t('overview.metrics.range') }}
            <AppIcon :icon="ArrowDown01Icon" />
          </button>
        </div>
        <t-button theme="primary" variant="text" size="small">
          {{ t('overview.metrics.more') }}
        </t-button>
      </div>

      <div class="overview__charts">
        <MetricChartCard
          v-for="metric in metrics"
          :key="metric.key"
          :title="metric.title"
          :tip="metric.tip"
          :values="metric.values"
          :labels="metric.labels"
        />
      </div>
    </section>

    <AttentionPanel />
    <AiToolSection />
    <TokenGuideSection />
    <TemplateGallery />
  </div>
</template>

<style scoped lang="less">
.overview {
  display: flex;
  flex-direction: column;
  gap: 40px;

  &__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__section-titles {
    display: flex;
    align-items: center;
    gap: @beacon-gap-l;
  }

  &__section-title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
  }

  &__range {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    color: @beacon-text-tertiary;
    cursor: pointer;
    background: none;
    border: 0;

    &:hover {
      color: @beacon-brand;
    }
  }

  // 参考实现为 4 列网格（当前 3 张卡片，第 4 列留空）
  &__charts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }
}
</style>
