<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { deleteOrganization } from '@/api'
import type { Organization } from '@/api/types'

/**
 * 危险操作区：注销（软删除）当前团队。
 * 仅团队所有者可见，需手动输入团队标识确认，避免误触。
 */
defineOptions({ name: 'TeamDangerSection' })

const props = defineProps<{ org: Organization | null; isOwner: boolean }>()
const emit = defineEmits<{ deleted: [] }>()
const { t } = useI18n()

const confirmText = ref('')
const submitting = ref(false)
const error = ref('')

const matched = computed(
  () => Boolean(props.org?.slug) && confirmText.value.trim() === props.org?.slug,
)

// 切换团队时清空输入，避免把上一个团队的标识带过来
watch(
  () => props.org?.id,
  () => {
    confirmText.value = ''
    error.value = ''
    submitting.value = false
  },
  { flush: 'sync' },
)

async function remove() {
  const org = props.org
  if (!org || submitting.value || !matched.value) return
  submitting.value = true
  error.value = ''
  try {
    await deleteOrganization(org.id)
    MessagePlugin.success(t('workspace.team.dangerDone'))
    emit('deleted')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('workspace.team.dangerFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <t-card class="danger-zone">
    <template #title>{{ t('workspace.team.dangerZone') }}</template>

    <p class="danger-zone__hint">{{ t('workspace.team.dangerHint') }}</p>
    <p v-if="!isOwner" class="danger-zone__locked">{{ t('workspace.team.dangerOwnerOnly') }}</p>

    <template v-else>
      <t-alert v-if="error" theme="error" :message="error" class="danger-zone__error" />
      <t-form label-align="top" :colon="false" :data="{ confirmText }">
        <t-form-item :label="t('workspace.team.dangerInput', { slug: org?.slug ?? '' })">
          <t-input
            v-model="confirmText"
            :placeholder="t('workspace.team.dangerInputPlaceholder')"
            :disabled="submitting"
          />
        </t-form-item>
      </t-form>
      <t-button theme="danger" :disabled="!matched" :loading="submitting" @click="remove">
        {{ t('workspace.team.dangerConfirm') }}
      </t-button>
    </template>
  </t-card>
</template>

<style scoped lang="less">
.danger-zone {
  &__hint {
    margin: 0 0 12px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__locked {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__error {
    margin-bottom: 12px;
  }
}
</style>
