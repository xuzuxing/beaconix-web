<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RumErrorGroup } from '@/api/types/rum'

const props = defineProps<{
  error: RumErrorGroup
  canTrace?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{
  resolve: []
  ignore: []
  trace: []
  locate: []
}>()
const { t } = useI18n()
const originalStack = shallowRef(false)
const showStack = ref(true)
const visibleStack = computed(() =>
  originalStack.value
    ? props.error.stack
    : props.error.resolvedStack || props.error.stack,
)
const location = computed(() => {
  const stack = props.error.resolvedStack || props.error.stack || ''
  const lines = stack
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
  // 单行堆栈与下方堆栈内容完全一致，重复展示会被读屏和测试视为两个同名节点
  if (lines.length <= 1) return ''
  return (
    lines.find((value) => value.includes(' at ') || value.includes('@')) ||
    lines[1]!
  )
})
</script>

<template>
  <t-card class="summary-card">
    <header class="summary-card__header">
      <div class="summary-card__identity">
        <div class="summary-card__eyebrow">
          <t-tag
            size="small"
            theme="danger"
            >{{ error.level || 'ERROR' }}</t-tag
          >
          <t-tag
            size="small"
            variant="outline"
            >{{ error.category || t('rum.unknownCategory') }}</t-tag
          >
          <t-tag
            size="small"
            variant="outline"
            >{{ error.type }}</t-tag
          >
          <t-tag
            v-if="error.sourceMapApplied"
            size="small"
            variant="light"
            theme="success"
            >{{ t('rum.mapped') }}</t-tag
          >
        </div>
        <h2>{{ error.message }}</h2>
        <code
          v-if="location"
          class="summary-card__location"
          >{{ location }}</code
        >
      </div>
      <div class="summary-card__actions">
        <t-button
          size="small"
          theme="success"
          variant="outline"
          :disabled="busy"
          @click="emit('resolve')"
          >{{ t('rum.resolve') }}</t-button
        >
        <t-button
          size="small"
          theme="warning"
          variant="outline"
          :disabled="busy"
          @click="emit('ignore')"
          >{{ t('rum.ignore') }}</t-button
        >
        <t-button
          size="small"
          variant="outline"
          :disabled="busy || !canTrace"
          @click="emit('trace')"
          >{{ t('rum.trace') }}</t-button
        >
        <t-button
          size="small"
          variant="outline"
          :disabled="busy"
          @click="emit('locate')"
          >{{ t('rum.locateUser') }}</t-button
        >
      </div>
    </header>

    <dl class="summary-card__facts">
      <div>
        <dt>{{ t('rum.count') }}</dt>
        <dd>{{ error.count }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.release') }}</dt>
        <dd>{{ error.release || '—' }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.page') }}</dt>
        <dd>{{ error.page || '—' }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.firstSeen') }}</dt>
        <dd>{{ error.firstSeenAt }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.lastSeen') }}</dt>
        <dd>{{ error.lastSeenAt }}</dd>
      </div>
      <div>
        <dt>{{ t('rum.sessionKey') }}</dt>
        <dd>{{ error.replaySessionId || '—' }}</dd>
      </div>
    </dl>

    <div class="summary-card__stack-heading">
      <div>
        <h3>{{ t('rum.stack') }}</h3>
        <span>{{
          t(error.sourceMapApplied ? 'rum.mapped' : 'rum.notMapped')
        }}</span>
      </div>
      <div class="summary-card__stack-tools">
        <t-radio-group
          v-model="originalStack"
          variant="default-filled"
          size="small"
        >
          <t-radio-button :value="false">{{
            t('rum.resolved')
          }}</t-radio-button>
          <t-radio-button :value="true">{{ t('rum.original') }}</t-radio-button>
        </t-radio-group>
        <t-button
          size="small"
          variant="text"
          @click="showStack = !showStack"
          >{{ t(showStack ? 'rum.collapse' : 'rum.expand') }}</t-button
        >
      </div>
    </div>
    <pre v-show="showStack">{{ visibleStack || '—' }}</pre>
  </t-card>
</template>

<style scoped lang="less">
.summary-card {
  margin-bottom: 16px;
  min-width: 0;

  &__header,
  &__stack-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  &__identity {
    min-width: 0;
  }

  &__identity h2 {
    margin: 8px 0 0;
    overflow-wrap: anywhere;
    font-size: 18px;
    font-weight: 600;
    line-height: 26px;
  }

  &__eyebrow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  &__location {
    display: block;
    margin-top: 10px;
    overflow: hidden;
    color: @beacon-text-secondary;
    font-family: @beacon-font-family-code;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
    flex: none;
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 16px;
    margin: 20px 0;
    padding: 16px 0;
    border-top: 1px solid @beacon-border;
    border-bottom: 1px solid @beacon-border;

    div {
      min-width: 0;
    }

    dt {
      color: @beacon-text-secondary;
      font-size: 12px;
    }

    dd {
      margin: 6px 0 0;
      overflow-wrap: anywhere;
      font-size: 13px;
    }
  }

  &__stack-heading {
    align-items: center;
    margin-bottom: 12px;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: @beacon-font-weight-medium;
    }

    span {
      color: @beacon-text-tertiary;
      font-size: 12px;
    }
  }

  &__stack-tools {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  pre {
    max-height: 420px;
    margin: 0;
    padding: 16px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    border: 1px solid @beacon-border;
    background: @beacon-bg-page;
    font-family: @beacon-font-family-code;
    font-size: 12px;
  }
}

@media (max-width: 1100px) {
  .summary-card__facts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .summary-card__header,
  .summary-card__stack-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-card__actions {
    justify-content: flex-start;
  }

  .summary-card__facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
