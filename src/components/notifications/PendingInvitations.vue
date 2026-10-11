<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import NotificationItem from './NotificationItem.vue'
import { useNotificationStore } from '@/stores/modules/notification'
import { pendingInvitationNotification } from '@/utils/notification-presenter'

const { t } = useI18n()
const store = useNotificationStore()
onMounted(() => {
  void store.loadPendingInvitations()
})
</script>

<template>
  <section class="pending-invitations" :aria-label="t('notificationCenter.invitation.pending')">
    <h3 class="pending-invitations__title">{{ t('notificationCenter.invitation.pending') }}</h3>
    <div v-if="store.pendingError" class="pending-invitations__state" role="alert">
      <span>{{ t('notificationCenter.invitation.loadFailed') }}</span>
      <t-button
        variant="outline"
        size="small"
        :loading="store.pendingLoading"
        @click="store.loadPendingInvitations"
      >
        {{ t('notificationCenter.retry') }}
      </t-button>
    </div>
    <t-loading
      v-else-if="store.pendingLoading && !store.pendingInvitations.length"
      :text="t('common.loading')"
    />
    <div v-else-if="store.pendingInvitations.length" class="pending-invitations__list">
      <NotificationItem
        v-for="item in store.pendingInvitations"
        :key="item.id"
        :notification="pendingInvitationNotification(item)"
        :dismissible="false"
        with-time
      />
    </div>
    <p v-else class="pending-invitations__empty">{{ t('notificationCenter.invitation.empty') }}</p>
  </section>
</template>

<style scoped lang="less">
.pending-invitations {
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid @beacon-border;
  &__title {
    margin: 0 0 12px;
    font-size: @beacon-font-size-menu;
    font-weight: @beacon-font-weight-medium;
  }
  &__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  &__state {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  &__empty {
    margin: 0;
    color: @beacon-text-tertiary;
  }
}
</style>
