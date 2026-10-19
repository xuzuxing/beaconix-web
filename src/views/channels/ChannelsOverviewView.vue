<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ChannelStatusTag from '@/components/channels/ChannelStatusTag.vue'
import ChannelTypeTag from '@/components/channels/ChannelTypeTag.vue'
import { useChannelList } from '@/composables/useChannelList'
import { useOrganizationStore } from '@/stores'
import {
  CHANNEL_TYPES,
  channelConfigSummary,
  summarizeChannels,
} from '@/utils/channel-presenter'

/**
 * 通知渠道 → 概览。
 * 后端暂无渠道汇总接口，这里基于 GET /notification-channels 的列表在前端聚合：
 * 状态统计（点击跳渠道管理并带筛选）、类型分布、最近添加的渠道。
 */
defineOptions({ name: 'ChannelsOverviewView' })
const { t } = useI18n()
const org = useOrganizationStore()
const orgId = computed(() => org.currentOrganizationId)
const { channels, loading, error, load } = useChannelList(orgId)

const summary = computed(() => summarizeChannels(channels.value))
const stats = computed(() => [
  {
    key: 'total',
    label: t('channelPage.total'),
    value: summary.value.total,
    query: {},
  },
  {
    key: 'enabled',
    label: t('channelPage.enabled'),
    value: summary.value.enabled,
    query: { status: 'enabled' },
  },
  {
    key: 'disabled',
    label: t('channelPage.disabled'),
    value: summary.value.disabled,
    query: { status: 'disabled' },
  },
  {
    key: 'types',
    label: t('channelPage.typeCount'),
    value: CHANNEL_TYPES.filter((type) => summary.value.byType[type] > 0)
      .length,
    query: {},
  },
])
const distribution = computed(() =>
  CHANNEL_TYPES.map((type) => ({
    type,
    count: summary.value.byType[type] ?? 0,
  })),
)
const maxCount = computed(() =>
  Math.max(1, ...distribution.value.map((item) => item.count)),
)
const recent = computed(() =>
  [...channels.value]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5),
)
const target = (query: Record<string, string | undefined>) => ({
  name: 'channels',
  query,
})
</script>

<template>
  <section class="channel-overview">
    <t-card class="channel-overview__card">
      <template #title>{{ t('channelPage.overviewTitle') }}</template>
      <template #actions>
        <span class="channel-overview__scope">{{
          org.currentOrganization?.name ?? '-'
        }}</span>
      </template>

      <div
        v-if="error"
        class="channel-overview__state"
      >
        <t-alert
          theme="error"
          :message="error"
        />
        <t-button @click="load">{{ t('channelPage.retry') }}</t-button>
      </div>
      <div
        v-else-if="loading"
        class="channel-overview__state"
      >
        <t-loading :text="t('common.loading')" />
      </div>
      <div
        v-else-if="!orgId"
        class="channel-overview__state"
      >
        {{ t('channelPage.noOrganization') }}
      </div>
      <div
        v-else
        class="channel-overview__grid"
      >
        <RouterLink
          v-for="item in stats"
          :key="item.key"
          class="channel-overview__cell"
          :to="target(item.query)"
        >
          <span class="channel-overview__label">{{ item.label }}</span>
          <strong
            class="channel-overview__value"
            :class="`channel-overview__value--${item.key}`"
          >
            {{ item.value }}
          </strong>
        </RouterLink>
      </div>
    </t-card>

    <t-card class="channel-overview__card">
      <template #title>{{ t('channelPage.distribution') }}</template>
      <div
        v-if="error || loading || !orgId"
        class="channel-overview__state"
      >
        <t-loading
          v-if="loading"
          :text="t('common.loading')"
        />
        <span v-else>-</span>
      </div>
      <ul
        v-else
        class="channel-overview__bars"
      >
        <li
          v-for="item in distribution"
          :key="item.type"
          class="channel-bar"
        >
          <ChannelTypeTag :type="item.type" />
          <span class="channel-bar__track">
            <span
              class="channel-bar__fill"
              :style="{
                width: `${Math.round((item.count / maxCount) * 100)}%`,
              }"
            />
          </span>
          <span class="channel-bar__count">{{ item.count }}</span>
        </li>
      </ul>
    </t-card>

    <t-card class="channel-overview__card">
      <template #title>{{ t('channelPage.recent') }}</template>
      <div
        v-if="error || loading || !orgId"
        class="channel-overview__state"
      >
        <t-loading
          v-if="loading"
          :text="t('common.loading')"
        />
        <span v-else>-</span>
      </div>
      <p
        v-else-if="!recent.length"
        class="channel-overview__empty"
      >
        {{ t('channelPage.empty') }}
      </p>
      <ul
        v-else
        class="channel-overview__list"
      >
        <li
          v-for="channel in recent"
          :key="channel.id"
          class="channel-overview__item"
        >
          <div class="channel-overview__item-main">
            <span class="channel-overview__item-name">{{ channel.name }}</span>
            <span class="channel-overview__item-summary">{{
              channelConfigSummary(channel)
            }}</span>
          </div>
          <ChannelTypeTag :type="channel.type" />
          <ChannelStatusTag :enabled="channel.enabled" />
        </li>
      </ul>
    </t-card>
  </section>
</template>

<style scoped lang="less">
.channel-overview {
  min-width: 0;

  &__card {
    margin-bottom: 16px;
  }

  &__scope {
    color: @beacon-text-secondary;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 120px;
    color: @beacon-text-secondary;
  }

  &__empty {
    margin: 0;
    padding: 16px 0;
    color: @beacon-text-tertiary;
    text-align: center;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: @beacon-gap-l;
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 4px 0;
    color: @beacon-text-secondary;

    &:hover .channel-overview__value {
      color: @beacon-brand;
    }
  }

  &__label {
    font-size: @beacon-font-size-base;
  }

  &__value {
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
    color: @beacon-text-primary;
    font-variant-numeric: tabular-nums;

    &--disabled {
      color: @beacon-warning;
    }
  }

  &__bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__list {
    display: flex;
    flex-direction: column;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid @beacon-border;

    &:last-child {
      border-bottom: 0;
    }
  }

  &__item-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  &__item-name {
    color: @beacon-text-primary;
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  &__item-summary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: @beacon-text-secondary;
  }
}

.channel-bar {
  display: flex;
  align-items: center;
  gap: 12px;

  &__track {
    flex: 1;
    min-width: 0;
    height: 8px;
    background: @beacon-bg-page;
    border-radius: 4px;
    overflow: hidden;
  }

  &__fill {
    display: block;
    height: 100%;
    background: @beacon-brand;
    border-radius: 4px;
  }

  &__count {
    width: 32px;
    color: @beacon-text-primary;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
}

@media (max-width: 900px) {
  .channel-overview__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
