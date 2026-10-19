import { computed, ref, watch, type Ref } from 'vue'

import { closeMyTicket, getMyTicket, replyToMyTicket } from '@/api'
import type { AttachmentRef } from '@/api/types/attachment'
import type { CreateTicketReplyParams, TicketDetail } from '@/api/types/ticket'
import { ticketTimelineOf } from '@/utils/ticket-presenter'

/**
 * 单个工单详情（含合并后的时间线）。
 *
 * 详情接口在文档里只写了「含 timeline」，条目结构由 ticketTimelineOf 归一化；
 * 回复与关闭成功后重新拉取详情，保证时间线、状态与关闭时间都来自后端。
 */
export function useTicketDetail(ticketId: Ref<string>) {
  const ticket = ref<TicketDetail | null>(null)
  const loading = ref(false)
  const error = ref('')
  const replying = ref(false)
  const closing = ref(false)
  let request = 0

  const timeline = computed(() => (ticket.value ? ticketTimelineOf(ticket.value) : []))

  async function load() {
    const id = ticketId.value
    const token = ++request
    error.value = ''

    if (!id) {
      ticket.value = null
      loading.value = false
      return
    }

    loading.value = true
    try {
      const detail = await getMyTicket(id)
      if (token !== request) return
      ticket.value = detail
    } catch (cause) {
      if (token !== request) return
      ticket.value = null
      error.value = cause instanceof Error ? cause.message : ''
    } finally {
      if (token === request) loading.value = false
    }
  }

  /** 发送回复（可带附件）；成功返回 true（请求层已统一提示错误） */
  async function reply(body: string, attachments: AttachmentRef[] = []): Promise<boolean> {
    const id = ticketId.value
    const trimmed = body.trim()
    if (!id || !trimmed || replying.value) return false

    const payload: CreateTicketReplyParams = { body: trimmed }
    if (attachments.length) payload.attachments = attachments

    replying.value = true
    try {
      await replyToMyTicket(id, payload)
      await load()
      return true
    } catch {
      return false
    } finally {
      replying.value = false
    }
  }

  /** 确认解决并关闭；失败（如已被关闭返回 409）返回 false */
  async function close(): Promise<boolean> {
    const id = ticketId.value
    if (!id || closing.value) return false

    closing.value = true
    try {
      await closeMyTicket(id)
      await load()
      return true
    } catch {
      return false
    } finally {
      closing.value = false
    }
  }

  watch(ticketId, () => void load(), { immediate: true })

  return {
    ticket,
    timeline,
    loading,
    error,
    replying,
    closing,
    load,
    reply,
    close,
  }
}
