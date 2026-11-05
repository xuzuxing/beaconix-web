<script setup lang="ts">
import { onScopeDispose, shallowRef, toRef } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import {
  createRumErrorNote,
  deleteRumErrorNote,
  listRumErrorNotes,
} from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import { accessContext, isCurrentContext } from '@/utils/access-context'
import RumPager from './RumPager.vue'
import RumState from './RumState.vue'

const props = defineProps<{ errorId: string }>()
const { t } = useI18n()
const { projectId, appId } = useRumContext()
const errorId = toRef(props, 'errorId')
const page = shallowRef(1)
const body = shallowRef('')
const submitting = shallowRef(false)
let disposed = false

onScopeDispose(() => {
  disposed = true
})

const notes = useRumResource(
  (signal) =>
    listRumErrorNotes(
      projectId.value,
      appId.value,
      errorId.value,
      { page: page.value, limit: 20 },
      { signal },
    ),
  [projectId, appId, errorId, page],
)

async function addNote() {
  const value = body.value.trim()
  if (!value || value.length > 2000 || submitting.value) {
    if (!value || value.length > 2000)
      void MessagePlugin.error(t('rum.invalid'))
    return
  }
  const ctx = accessContext()
  submitting.value = true
  try {
    await createRumErrorNote(projectId.value, appId.value, errorId.value, value)
    if (!disposed && isCurrentContext(ctx)) {
      body.value = ''
      page.value = 1
      await notes.reload()
    }
  } catch {
    if (!disposed && isCurrentContext(ctx))
      void MessagePlugin.error(t('rum.failed'))
  } finally {
    submitting.value = false
  }
}

async function removeNote(noteId: string) {
  if (submitting.value || !window.confirm(t('rum.noteDelete'))) return
  const ctx = accessContext()
  submitting.value = true
  try {
    await deleteRumErrorNote(
      projectId.value,
      appId.value,
      errorId.value,
      noteId,
    )
    if (!disposed && isCurrentContext(ctx)) await notes.reload()
  } catch {
    if (!disposed && isCurrentContext(ctx))
      void MessagePlugin.error(t('rum.failed'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <t-card class="error-notes">
    <template #title>{{ t('rum.handlingNotes') }}</template>
    <form
      class="error-notes__form"
      @submit.prevent="addNote"
    >
      <t-textarea
        v-model="body"
        :placeholder="t('rum.notePlaceholder')"
        :maxlength="2000"
        :autosize="{ minRows: 2, maxRows: 6 }"
      />
      <t-button
        type="submit"
        :loading="submitting"
      >
        {{ t('rum.addNote') }}
      </t-button>
    </form>
    <RumState
      :loading="notes.loading.value"
      :error="notes.error.value"
      @retry="notes.reload"
    >
      <t-empty
        v-if="!notes.data.value?.items.length"
        :description="t('rum.empty')"
      />
      <article
        v-for="note in notes.data.value?.items"
        :key="note.id"
        class="error-notes__item"
      >
        <div class="error-notes__meta">
          <strong>{{
            note.author?.name || note.author?.email || note.authorId || '—'
          }}</strong>
          <span>{{ note.createdAt }}</span>
        </div>
        <p>{{ note.body }}</p>
        <t-button
          variant="text"
          theme="danger"
          :disabled="submitting"
          @click="removeNote(note.id)"
        >
          {{ t('rum.remove') }}
        </t-button>
      </article>
      <RumPager
        v-if="notes.data.value"
        v-model="page"
        :total="notes.data.value.total"
        :limit="notes.data.value.limit"
      />
    </RumState>
  </t-card>
</template>

<style scoped lang="less">
.error-notes {
  margin-top: 16px;
  min-width: 0;

  &__form {
    display: grid;
    gap: 10px;
    margin-bottom: 12px;

    .t-button {
      justify-self: end;
    }
  }

  &__item {
    display: grid;
    gap: 8px;
    padding: 12px 0;
    border-bottom: 1px solid @beacon-border;

    p {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .t-button {
      justify-self: start;
    }
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: @beacon-text-secondary;
    font-size: 12px;
  }
}
</style>
