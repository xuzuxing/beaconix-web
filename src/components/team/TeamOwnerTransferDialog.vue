<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { transferOwnership } from '@/api'
import type { Membership } from '@/api/types'
import { usePermissionsStore } from '@/stores/modules/permissions'
import { permissionEpoch } from '@/utils/access-context'
import { memberIdentity } from '@/utils/team-presenter'

/**
 * 转移团队所有权：把当前团队交给另一位成员。
 * 候选为除所有者本人以外的全部成员（后端要求目标是团队成员）。
 */
defineOptions({ name: 'TeamOwnerTransferDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ orgId: string; members: Membership[]; ownerId: string }>()
const emit = defineEmits<{ transferred: [] }>()
const { t } = useI18n()
const permissions = usePermissionsStore()

const target = ref('')
const submitting = ref(false)
const error = ref('')
const confirmVisible = ref(false)
let generation = 0

const options = computed(() =>
  props.members
    .filter((member) => member.userId !== props.ownerId)
    .map((member) => {
      const identity = memberIdentity(member)
      const suffix = identity.email || member.userId
      return { label: `${identity.name}（${suffix}）`, value: member.userId }
    }),
)

const targetName = computed(
  () => options.value.find((option) => option.value === target.value)?.label ?? '',
)

watch(
  visible,
  (value) => {
    generation++
    target.value = ''
    error.value = ''
    submitting.value = false
    confirmVisible.value = false
    if (!value) return
  },
  { flush: 'sync' },
)

async function submit() {
  if (submitting.value) return
  if (!target.value) {
    error.value = t('workspace.team.transferRequired')
    return
  }
  const token = generation
  submitting.value = true
  error.value = ''
  try {
    const id = props.orgId
    await permissions.ensureOrganization(id, true)
    if (
      token !== generation ||
      !visible.value ||
      permissions.organizations[id]?.data?.organizationRole !== 'OWNER'
    )
      return
    await transferOwnership(id, target.value)
    if (token !== generation) return
    MessagePlugin.success(t('workspace.team.transferDone'))
    confirmVisible.value = false
    visible.value = false
    window.dispatchEvent(new Event('beacon-permissions-changed'))
    emit('transferred')
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('workspace.team.transferFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
watch(
  () => [props.orgId, permissionEpoch.value],
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.team.transferTitle')"
    width="min(480px, calc(100vw - 32px))"
    :footer="false"
    :close-on-overlay-click="!submitting"
  >
    <t-alert v-if="error" theme="error" :message="error" class="transfer__error" />
    <p class="transfer__hint">{{ t('workspace.team.transferHint') }}</p>

    <p v-if="!options.length" class="transfer__empty">{{ t('workspace.team.transferEmpty') }}</p>
    <template v-else>
      <t-form label-align="top" :colon="false" :data="{ target }">
        <t-form-item :label="t('workspace.team.transferTarget')">
          <t-select v-model="target" :options="options" :disabled="submitting" />
        </t-form-item>
      </t-form>

      <div class="transfer__actions">
        <t-button variant="outline" @click="visible = false">{{ t('common.cancel') }}</t-button>
        <t-popconfirm
          v-if="target"
          theme="warning"
          :content="t('workspace.team.transferConfirm', { name: targetName })"
          @confirm="submit"
        >
          <t-button theme="primary" :loading="submitting">
            {{ t('workspace.team.transfer') }}
          </t-button>
        </t-popconfirm>
        <t-button v-else theme="primary" disabled>{{ t('workspace.team.transfer') }}</t-button>
      </div>
    </template>
  </t-dialog>
</template>

<style scoped lang="less">
.transfer {
  &__error {
    margin-bottom: 12px;
  }

  &__hint {
    margin: 0 0 16px;
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
  }

  &__empty {
    margin: 0;
    font-size: @beacon-font-size-base;
    color: @beacon-text-tertiary;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 4px;
  }
}
</style>
