<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'

import type { InvitationAction } from '@/api/types/invitation'
import type { UserNotification } from '@/api/types/notification-center'
import AppIcon from '@/components/AppIcon.vue'
import InvitationScope from '@/components/team/InvitationScope.vue'
import { Cancel01Icon, CheckmarkCircle02Icon, RefreshIcon } from '@/icons'
import { useNotificationStore } from '@/stores/modules/notification'
import {
  canActOnInvitation,
  formatNotificationTime,
  notificationInvitationId,
  notificationInvitationStatus,
  notificationReceivedInvitationId,
} from '@/utils/notification-presenter'

const props = defineProps<{ notification: UserNotification; disabled?: boolean }>()
const { t } = useI18n()
const store = useNotificationStore()
const loading = ref(false)
const failed = ref(false)
const ready = ref(false)
const now = ref(Date.now())
let generation = 0
let expiryTimer: ReturnType<typeof setTimeout> | undefined
const id = computed(() => notificationInvitationId(props.notification))
const lookupId = computed(() => notificationReceivedInvitationId(props.notification))
const invitation = computed(() => (lookupId.value ? store.invitations[lookupId.value] : undefined))
const status = computed(() =>
  notificationInvitationStatus(props.notification, invitation.value, now.value),
)
const expiresAt = computed(
  () => invitation.value?.expiresAt ?? props.notification.meta?.invitationExpiresAt,
)
const action = computed(() =>
  lookupId.value ? store.invitationPending[lookupId.value] : undefined,
)
const errorKey = computed(() => (lookupId.value ? store.invitationErrors[lookupId.value] : ''))
const actionable = computed(
  () =>
    ready.value &&
    !failed.value &&
    !store.invitationBlocked[id.value ?? ''] &&
    canActOnInvitation(props.notification, invitation.value, now.value),
)
const theme = computed(() =>
  status.value === 'ACCEPTED' ? 'success' : status.value === 'PENDING' ? 'warning' : 'default',
)

async function refresh() {
  const invitationId = lookupId.value
  const request = ++generation
  loading.value = false
  failed.value = false
  ready.value = false
  if (!invitationId) return
  loading.value = true
  try {
    await store.loadInvitation(invitationId)
    if (request === generation) ready.value = true
  } catch {
    if (request === generation) failed.value = true
  } finally {
    if (request === generation) loading.value = false
  }
}

async function act(value: InvitationAction) {
  now.value = Date.now()
  if (!actionable.value || props.disabled || action.value) return
  if (await store.actOnInvitation(props.notification, value)) {
    MessagePlugin.success(t(`notificationCenter.invitation.${value}Done`))
  }
}

watch(
  () => [
    lookupId.value,
    props.notification.meta?.invitationStatus,
    props.notification.meta?.actionable,
  ],
  () => {
    void refresh()
  },
  { immediate: true },
)

// Expiration must disable a control even if the user leaves the drawer open.
watch(
  expiresAt,
  (value, _, onCleanup) => {
    now.value = Date.now()
    const delay = typeof value === 'string' ? Date.parse(value) - now.value : 0
    if (delay > 0) {
      expiryTimer = setTimeout(
        () => {
          now.value = Date.now()
        },
        Math.min(delay + 1, 2_147_483_647),
      )
    }
    onCleanup(() => clearTimeout(expiryTimer))
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  generation++
})
</script>

<template>
  <div v-if="id" class="invitation-actions">
    <InvitationScope v-if="ready && invitation" :invitation="invitation" />
    <div class="invitation-actions__row">
      <t-tag :theme="theme" variant="light" size="small">
        {{ t(`notificationCenter.invitation.status.${status ?? 'unknown'}`) }}
      </t-tag>
      <span
        v-if="typeof expiresAt === 'string' && status === 'PENDING'"
        class="invitation-actions__expiry"
      >
        {{
          t('notificationCenter.invitation.expiresAt', {
            time: formatNotificationTime(expiresAt, true),
          })
        }}
      </span>
      <template v-if="actionable">
        <t-button
          size="small"
          theme="primary"
          :loading="action === 'accept'"
          :disabled="disabled || !!action || loading"
          @click="act('accept')"
        >
          <template #icon><AppIcon :icon="CheckmarkCircle02Icon" :size="14" /></template>
          {{ t('notificationCenter.invitation.accept') }}
        </t-button>
        <t-button
          size="small"
          variant="outline"
          :loading="action === 'decline'"
          :disabled="disabled || !!action || loading"
          @click="act('decline')"
        >
          <template #icon><AppIcon :icon="Cancel01Icon" :size="14" /></template>
          {{ t('notificationCenter.invitation.decline') }}
        </t-button>
      </template>
      <t-tooltip v-if="lookupId" :content="t('notificationCenter.refresh')">
        <t-button
          variant="text"
          shape="square"
          size="small"
          :loading="loading"
          :disabled="!!action"
          :aria-label="t('notificationCenter.refresh')"
          @click="refresh"
        >
          <template #icon><AppIcon :icon="RefreshIcon" :size="14" /></template>
        </t-button>
      </t-tooltip>
    </div>
    <p v-if="failed || errorKey" class="invitation-actions__error" role="alert">
      {{ t(`notificationCenter.invitation.${failed ? 'loadFailed' : errorKey}`) }}
    </p>
  </div>
</template>

<style scoped lang="less">
.invitation-actions {
  @media (max-width: 600px) {
    :deep(.t-button) {
      min-width: 44px;
      min-height: 44px;
    }
  }
  &__row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  &__expiry {
    font-size: @beacon-font-size-base;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }
  &__error {
    margin: 6px 0 0;
    font-size: @beacon-font-size-base;
    color: @beacon-error;
    overflow-wrap: anywhere;
  }
}
</style>
