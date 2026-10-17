<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import HeaderActions from '@/components/HeaderActions.vue'
import TicketTimeline from '@/components/support/TicketTimeline.vue'
import { usePageHeader } from '@/composables/usePageHeader'
import { useTicketCategories } from '@/composables/useTicketCategories'
import { useTicketDetail } from '@/composables/useTicketDetail'
import { RefreshIcon } from '@/icons'
import { formatDateTime } from '@/utils/billing'
import {
  canCloseTicket,
  isTicketClosed,
  ticketAssigneeLabel,
  ticketAuthorLabel,
  ticketCategoryLabel,
  ticketNumberLabel,
  ticketOrganizationLabel,
  ticketPriorityLabelKey,
  ticketPriorityTheme,
  ticketStatusLabelKey,
  ticketStatusTheme,
} from '@/utils/ticket-presenter'

/**
 * 工单详情（用户侧）：工单正文 + 合并时间线 + 回复框 + 确认关闭。
 * 已关闭的工单仍可回复，后端会在回复时自动重新打开。
 */
defineOptions({ name: 'TicketDetailView' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const ticketId = computed(() => String(route.params.id ?? ''))
const { ticket, timeline, loading, error, replying, closing, load, reply, close } =
  useTicketDetail(ticketId)
const { nameOf, load: loadCategories } = useTicketCategories()

void loadCategories()

usePageHeader({
  title: computed(() =>
    ticket.value
      ? `${ticketNumberLabel(ticket.value.number)} ${ticket.value.subject}`
      : t('ticketPage.detailTitle'),
  ),
  back: '/tickets',
})

const replyBody = ref('')
const closeVisible = ref(false)

/** 分类文案：优先用内嵌分类，缺失时按分类 ID 从分类列表里补名字 */
const categoryText = computed(() => {
  const item = ticket.value
  if (!item) return ''
  return item.category?.name ?? nameOf(item.categoryId) ?? ticketCategoryLabel(item)
})

const organizationText = computed(() =>
  ticket.value ? ticketOrganizationLabel(ticket.value.organizationId) : '',
)

async function sendReply() {
  if (!replyBody.value.trim() || replying.value) return
  const done = await reply(replyBody.value)
  if (!done) return
  replyBody.value = ''
  MessagePlugin.success(t('ticketPage.replyDone'))
}

async function confirmClose() {
  const done = await close()
  closeVisible.value = false
  if (done) MessagePlugin.success(t('ticketPage.closeDone'))
}
</script>

<template>
  <section class="ticket-detail">
    <HeaderActions>
      <t-tooltip :content="t('ticketPage.refresh')">
        <t-button
          variant="outline"
          shape="square"
          :loading="loading"
          :aria-label="t('ticketPage.refresh')"
          @click="load"
        >
          <template #icon><AppIcon :icon="RefreshIcon" /></template>
        </t-button>
      </t-tooltip>
    </HeaderActions>

    <div v-if="error" class="ticket-detail__state">
      <t-alert theme="error" :message="error" />
      <t-button variant="outline" @click="load">{{ t('ticketPage.refresh') }}</t-button>
    </div>

    <div v-else-if="loading && !ticket" class="ticket-detail__state">
      <t-loading :text="t('common.loading')" />
    </div>

    <template v-else-if="ticket">
      <t-card :bordered="false">
        <template #title>
          <div class="ticket-detail__head">
            <span class="ticket-detail__number">{{ ticketNumberLabel(ticket.number) }}</span>
            <t-tag size="small" variant="light" :theme="ticketStatusTheme(ticket.status)">
              {{ t(ticketStatusLabelKey(ticket.status)) }}
            </t-tag>
            <t-tag size="small" variant="light" :theme="ticketPriorityTheme(ticket.priority)">
              {{ t(ticketPriorityLabelKey(ticket.priority)) }}
            </t-tag>
            <t-tag v-if="categoryText" size="small" variant="outline">
              {{ categoryText }}
            </t-tag>
          </div>
        </template>

        <div class="ticket-detail__body">
          <h3 class="ticket-detail__subject">{{ ticket.subject }}</h3>

          <t-descriptions :column="2" bordered size="small">
            <t-descriptions-item :label="t('ticketPage.author')">
              {{ ticketAuthorLabel(ticket) }}
            </t-descriptions-item>
            <t-descriptions-item :label="t('ticketPage.createdAt')">
              {{ formatDateTime(ticket.createdAt) }}
            </t-descriptions-item>
            <t-descriptions-item :label="t('ticketPage.updatedAt')">
              {{ formatDateTime(ticket.updatedAt) }}
            </t-descriptions-item>
            <t-descriptions-item :label="t('ticketPage.assignee')">
              {{ ticketAssigneeLabel(ticket) || t('ticketPage.unassigned') }}
            </t-descriptions-item>
            <t-descriptions-item v-if="organizationText" :label="t('ticketPage.organization')">
              {{ organizationText }}
            </t-descriptions-item>
          </t-descriptions>

          <div class="ticket-detail__section">
            <h4 class="ticket-detail__section-title">{{ t('ticketPage.content') }}</h4>
            <p class="ticket-detail__content">{{ ticket.content }}</p>
          </div>

          <div class="ticket-detail__section">
            <h4 class="ticket-detail__section-title">{{ t('ticketPage.timelineTitle') }}</h4>
            <TicketTimeline :entries="timeline" />
          </div>

          <div class="ticket-detail__section">
            <h4 class="ticket-detail__section-title">{{ t('ticketPage.replyTitle') }}</h4>
            <t-alert
              v-if="isTicketClosed(ticket)"
              theme="info"
              :message="t('ticketPage.closedHint')"
              class="ticket-detail__hint"
            />
            <t-textarea
              v-model="replyBody"
              :maxlength="5000"
              :placeholder="t('ticketPage.replyPlaceholder')"
              :autosize="{ minRows: 4, maxRows: 10 }"
            />
            <div class="ticket-detail__actions">
              <t-button
                theme="primary"
                :loading="replying"
                :disabled="!replyBody.trim()"
                @click="sendReply"
              >
                {{ t('ticketPage.reply') }}
              </t-button>
              <t-button
                v-if="canCloseTicket(ticket)"
                variant="outline"
                :loading="closing"
                @click="closeVisible = true"
              >
                {{ t('ticketPage.close') }}
              </t-button>
              <t-button variant="outline" @click="router.push('/tickets')">
                {{ t('ticketPage.backToList') }}
              </t-button>
            </div>
          </div>
        </div>
      </t-card>
    </template>

    <t-card v-else :bordered="false">
      <div class="ticket-detail__state">
        <p class="ticket-detail__empty">{{ t('ticketPage.notFound') }}</p>
        <t-button variant="outline" @click="router.push('/tickets')">
          {{ t('ticketPage.backToList') }}
        </t-button>
      </div>
    </t-card>

    <t-dialog
      v-model:visible="closeVisible"
      :header="t('ticketPage.close')"
      width="min(480px, calc(100vw - 32px))"
      :confirm-btn="{ content: t('ticketPage.close'), loading: closing }"
      :cancel-btn="t('common.cancel')"
      @confirm="confirmClose"
    >
      <p class="ticket-detail__confirm">{{ t('ticketPage.closeConfirm') }}</p>
    </t-dialog>
  </section>
</template>

<style scoped lang="less">
.ticket-detail {
  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  &__number {
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__subject {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    line-height: 24px;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__section-title {
    margin: 0;
    font-size: @beacon-font-size-menu;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__content {
    margin: 0;
    line-height: 22px;
    color: @beacon-text-secondary;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  &__hint {
    margin-bottom: 4px;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
  }

  &__empty,
  &__confirm {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__confirm {
    color: @beacon-text-primary;
  }
}
</style>
