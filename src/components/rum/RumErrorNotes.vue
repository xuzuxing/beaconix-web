<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  createRumErrorNote,
  deleteRumErrorNote,
  listRumErrorNotes,
} from '@/api/modules/rum'
import { useRumContext } from '@/composables/useRumContext'
import { useRumResource } from '@/composables/useRumResource'
import RumPager from './RumPager.vue'
import RumState from './RumState.vue'

const props = defineProps<{ groupId: string }>()
const { t } = useI18n()
const { projectId, appId, canReadRum } = useRumContext()
const page = ref(1)
const draft = ref('')
const submitting = ref(false)
const notes = useRumResource(
  (signal) =>
    canReadRum.value
      ? listRumErrorNotes(
          projectId.value,
          appId.value,
          props.groupId,
          { page: page.value, limit: 10 },
          { signal },
        )
      : Promise.reject(new Error('RUM access denied')),
  [projectId, appId, canReadRum, page, () => props.groupId],
)

async function submit() {
  const body = draft.value.trim()
  if (!body || submitting.value) return
  submitting.value = true
  try {
    await createRumErrorNote(projectId.value, appId.value, props.groupId, body)
    draft.value = ''
    page.value = 1
    await notes.reload()
  } catch {
    void MessagePlugin.error(t('rum.noteFailed'))
  } finally {
    submitting.value = false
  }
}

async function remove(id: string) {
  try {
    await deleteRumErrorNote(projectId.value, appId.value, props.groupId, id)
    await notes.reload()
  } catch {
    void MessagePlugin.error(t('rum.noteFailed'))
  }
}
</script>

<template>
  <t-card class="rum-error-notes">
    <template #title>{{ t('rum.notes') }}</template>
    <div class="rum-error-notes__compose">
      <t-textarea
        v-model="draft"
        :placeholder="t('rum.notePlaceholder')"
        :maxlength="2000"
        :autosize="{ minRows: 2, maxRows: 5 }"
      />
      <t-button
        theme="primary"
        :loading="submitting"
        :disabled="!draft.trim()"
        @click="submit"
        >{{ t('rum.noteSubmit') }}</t-button
      >
    </div>
    <RumState
      :loading="notes.loading.value"
      :error="notes.error.value"
      @retry="notes.reload"
    >
      <template v-if="notes.data.value">
        <t-empty
          v-if="!notes.data.value.items.length"
          :description="t('rum.notesEmpty')"
        />
        <ul
          v-else
          class="rum-error-notes__list"
        >
          <li
            v-for="note in notes.data.value.items"
            :key="note.id"
            class="rum-error-notes__item"
          >
            <div class="rum-error-notes__meta">
              <strong>{{
                note.author?.name || note.author?.email || '—'
              }}</strong>
              <span>{{ note.createdAt }}</span>
              <t-button
                variant="text"
                theme="danger"
                size="small"
                @click="remove(note.id)"
                >{{ t('rum.remove') }}</t-button
              >
            </div>
            <p class="rum-error-notes__body">{{ note.body }}</p>
          </li>
        </ul>
        <RumPager
          v-model="page"
          :total="notes.data.value.total"
          :limit="notes.data.value.limit"
        />
      </template>
    </RumState>
  </t-card>
</template>

<style scoped lang="less">
.rum-error-notes {
  min-width: 0;

  &__compose {
    display: grid;
    gap: @beacon-gap;
    margin-bottom: @beacon-gap-l;
  }

  &__list {
    display: grid;
    gap: @beacon-gap-l;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    padding-bottom: @beacon-gap-l;
    border-bottom: 1px solid @beacon-border;

    &:last-child {
      border-bottom: 0;
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: @beacon-gap;
    color: @beacon-text-secondary;
    font-size: 12px;
  }

  &__body {
    margin: 6px 0 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
}
</style>
