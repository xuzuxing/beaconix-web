<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'

import type { StatusPage } from '@/api/types/status-page'
import AppIcon from '@/components/AppIcon.vue'
import type { StatusPageAction } from '@/composables/useStatusPageActions'
import {
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  LinkSquare02Icon,
  PauseIcon,
  PlayIcon,
} from '@/icons'
import { publicStatusPageUrl } from '@/utils/status-page-presenter'

const props = defineProps<{
  page: StatusPage
  pending?: boolean
  canManage: boolean
}>()
const emit = defineEmits<{ action: [action: StatusPageAction]; edit: [] }>()
const { t } = useI18n()

/** 公开页是给外部访问的地址，预览按绝对地址新开标签（兼容部署在子路径） */
function preview() {
  window.open(publicStatusPageUrl(props.page.slug), '_blank', 'noopener')
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(publicStatusPageUrl(props.page.slug))
    MessagePlugin.success(t('statusPage.linkCopied'))
  } catch {
    MessagePlugin.error(t('statusPage.copyFailed'))
  }
}
</script>

<template>
  <div class="status-page-actions">
    <t-tooltip :content="t('statusPage.preview')">
      <t-button
        variant="text"
        shape="square"
        :aria-label="t('statusPage.preview')"
        @click="preview"
        ><AppIcon :icon="LinkSquare02Icon"
      /></t-button>
    </t-tooltip>
    <t-tooltip :content="t('statusPage.copyLink')">
      <t-button
        variant="text"
        shape="square"
        :aria-label="t('statusPage.copyLink')"
        @click="copyLink"
        ><AppIcon :icon="Copy01Icon"
      /></t-button>
    </t-tooltip>
    <template v-if="canManage">
      <t-tooltip
        :content="t(page.enabled ? 'statusPage.disable' : 'statusPage.enable')"
      >
        <t-button
          variant="text"
          shape="square"
          :disabled="pending"
          :aria-label="
            t(page.enabled ? 'statusPage.disable' : 'statusPage.enable')
          "
          @click="emit('action', 'toggle')"
          ><AppIcon :icon="page.enabled ? PauseIcon : PlayIcon"
        /></t-button>
      </t-tooltip>
      <t-tooltip :content="t('statusPage.edit')">
        <t-button
          variant="text"
          shape="square"
          :disabled="pending"
          :aria-label="t('statusPage.edit')"
          @click="emit('edit')"
          ><AppIcon :icon="Edit02Icon"
        /></t-button>
      </t-tooltip>
      <t-popconfirm
        :content="t('statusPage.deleteConfirm')"
        @confirm="emit('action', 'delete')"
      >
        <t-button
          variant="text"
          theme="danger"
          shape="square"
          :disabled="pending"
          :aria-label="t('statusPage.delete')"
          ><AppIcon :icon="Delete02Icon"
        /></t-button>
      </t-popconfirm>
    </template>
  </div>
</template>

<style scoped>
.status-page-actions {
  display: flex;
  align-items: center;
  flex: none;
}
</style>
