<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { sendInvitation } from '@/api'
import type { Invitation, InvitableRole, Membership } from '@/api/types'
import { INVITABLE_ROLES } from '@/utils/team-presenter'

/**
 * 邀请成员：向邮箱发送邀请，可选角色（ADMIN / MEMBER / VIEWER）。
 * 已在团队内或已有待处理邀请的邮箱直接拦下，避免后端 409。
 */
defineOptions({ name: 'MemberInviteDialog' })

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{
  orgId: string
  members: Membership[]
  invitations: Invitation[]
}>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()

const form = reactive({ email: '', role: 'MEMBER' as InvitableRole })
const submitting = ref(false)
const error = ref('')
let generation = 0

const roleOptions = computed(() =>
  INVITABLE_ROLES.map((role) => ({ label: t(`workspace.member.roleOption.${role}`), value: role })),
)

/** 已占用邮箱：现役成员 + 待处理邀请 */
const takenEmails = computed(() => {
  const list = props.members
    .map((member) => member.user?.email ?? '')
    .concat(props.invitations.filter((item) => item.status === 'PENDING').map((item) => item.email))
  return new Set(list.filter(Boolean).map((email) => email.trim().toLowerCase()))
})

watch(
  visible,
  (value) => {
    generation++
    submitting.value = false
    error.value = ''
    if (!value) return
    form.email = ''
    form.role = 'MEMBER'
  },
  { flush: 'sync' },
)

// 切换团队时关闭弹窗，避免把邀请发到上一个团队
watch(
  () => props.orgId,
  () => {
    visible.value = false
  },
  { flush: 'sync' },
)

function validate(): string {
  const email = form.email.trim()
  if (!email) return t('workspace.member.inviteRequired')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('workspace.member.inviteInvalidEmail')
  if (takenEmails.value.has(email.toLowerCase())) return t('workspace.member.inviteDuplicate')
  return ''
}

async function submit() {
  if (submitting.value) return
  const message = validate()
  if (message) {
    error.value = message
    return
  }

  const token = generation
  submitting.value = true
  error.value = ''
  try {
    await sendInvitation(props.orgId, { email: form.email.trim(), role: form.role })
    if (token !== generation) return
    MessagePlugin.success(t('workspace.member.sent'))
    visible.value = false
    emit('saved')
  } catch (cause) {
    if (token === generation)
      error.value = cause instanceof Error ? cause.message : t('workspace.member.inviteFailed')
  } finally {
    if (token === generation) submitting.value = false
  }
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.member.inviteTitle')"
    width="min(480px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('workspace.member.inviteSend'), loading: submitting }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!submitting"
    @confirm="submit"
  >
    <t-alert v-if="error" theme="error" :message="error" class="invite__error" />

    <t-form label-align="top" :colon="false" :data="form">
      <t-form-item :label="t('workspace.member.inviteEmail')">
        <t-input
          v-model="form.email"
          :maxlength="200"
          :placeholder="t('workspace.member.inviteEmailPlaceholder')"
        />
      </t-form-item>
      <t-form-item :label="t('workspace.member.inviteRole')">
        <t-select v-model="form.role" :options="roleOptions" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<style scoped lang="less">
.invite {
  &__error {
    margin-bottom: 16px;
  }
}
</style>
