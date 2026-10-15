<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AdminSetting } from '@/api/types/admin'
import type { SettingDraft } from '@/utils/settings-presenter'
import { formatDateTime } from '@/utils/billing'

/**
 * 单个配置项的表单行：标签在左（名称 + 状态徽标），控件与说明在右。
 * - STRING → 文本框（isSecret 用密码框）
 * - NUMBER → 数字框，清空即视为未填
 * - BOOLEAN → 开关
 * - JSON → 多行文本框，保存时由 `parseDraft` 校验
 * 草稿的持有者是页面，这里只负责取值与回传；label 宽度由外层 t-form 统一控制。
 */
defineOptions({ name: 'AdminSettingField' })

const props = defineProps<{
  item: AdminSetting
  draft: SettingDraft
  /** 与本项当前值相比有未保存的改动 */
  dirty: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:draft': [value: SettingDraft] }>()

const { t } = useI18n()

const textValue = computed(() => (typeof props.draft === 'string' ? props.draft : ''))
const numberValue = computed(() => (typeof props.draft === 'number' ? props.draft : undefined))
const booleanValue = computed(() => props.draft === true)

/** 输入事件的值类型由 TDesign 的泛型决定，这里统一按 unknown 收窄 */
function onTextChange(value: unknown) {
  emit('update:draft', typeof value === 'string' ? value : value == null ? '' : String(value))
}

function onNumberChange(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    emit('update:draft', value)
    return
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    emit('update:draft', Number.isFinite(parsed) ? parsed : null)
    return
  }
  emit('update:draft', null)
}

function onBooleanChange(value: unknown) {
  emit('update:draft', value === true)
}
</script>

<template>
  <t-form-item class="admin-setting-field" :class="{ 'admin-setting-field--dirty': dirty }">
    <template #label>
      <span class="admin-setting-field__label">
        <span class="admin-setting-field__name">{{ item.name }}</span>
        <span class="admin-setting-field__tags">
          <t-tag v-if="item.isSecret" size="small" variant="light" theme="warning">
            {{ t('adminPage.setting.secret') }}
          </t-tag>
          <t-tag v-if="!item.isDefault" size="small" variant="light" theme="primary">
            {{ t('adminPage.setting.overridden') }}
          </t-tag>
          <t-tag v-if="dirty" size="small" variant="light" theme="warning">
            {{ t('adminPage.setting.dirtyTag') }}
          </t-tag>
        </span>
      </span>
    </template>

    <div class="admin-setting-field__body">
      <t-input
        v-if="item.valueType === 'STRING'"
        class="admin-setting-field__control"
        :type="item.isSecret ? 'password' : 'text'"
        :value="textValue"
        :disabled="disabled"
        :placeholder="item.isSecret ? t('adminPage.setting.secretPlaceholder') : ''"
        @change="onTextChange"
      />
      <t-input-number
        v-else-if="item.valueType === 'NUMBER'"
        class="admin-setting-field__control"
        :value="numberValue"
        :disabled="disabled"
        @change="onNumberChange"
      />
      <div v-else-if="item.valueType === 'BOOLEAN'" class="admin-setting-field__switch">
        <t-switch :value="booleanValue" :disabled="disabled" @change="onBooleanChange" />
        <span class="admin-setting-field__switch-text">
          {{ booleanValue ? t('adminPage.setting.on') : t('adminPage.setting.off') }}
        </span>
      </div>
      <t-textarea
        v-else
        class="admin-setting-field__control admin-setting-field__json"
        :value="textValue"
        :autosize="{ minRows: 3, maxRows: 10 }"
        :disabled="disabled"
        @change="onTextChange"
      />

      <p v-if="item.description" class="admin-setting-field__desc">{{ item.description }}</p>
      <p v-if="item.isSecret" class="admin-setting-field__hint">
        {{ t('adminPage.setting.secretHint') }}
      </p>
      <p v-else-if="!item.isDefault && item.updatedAt" class="admin-setting-field__hint">
        {{ t('adminPage.setting.updatedHint', { at: formatDateTime(item.updatedAt) }) }}
      </p>
      <p class="admin-setting-field__key">{{ item.key }}</p>
    </div>
  </t-form-item>
</template>

<style scoped lang="less">
.admin-setting-field {
  padding: 14px 0;

  /* 只留行与行之间的分隔线，最后一项不要 */
  &:not(:last-child) {
    border-bottom: 1px solid @beacon-border;
  }

  &__label {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  &__name {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__tags {
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  &--dirty &__name {
    color: @beacon-warning;
  }

  &__body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    min-width: 0;
  }

  &__control {
    width: 100%;
    max-width: 420px;
  }

  &__json {
    max-width: 560px;
  }

  &__switch {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__switch-text {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__desc {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__hint {
    margin: 0;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }

  &__key {
    margin: 0;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }
}
</style>
