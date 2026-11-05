<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RumReleaseCompare, RumReleaseGroup } from '@/api/types/rum'

const props = defineProps<{ comparison: RumReleaseCompare }>()
const emit = defineEmits<{ openError: [group: RumReleaseGroup] }>()
const { t } = useI18n()

const sections = computed(() => [
  { key: 'new', label: t('rum.releaseNew'), items: props.comparison.new },
  { key: 'fixed', label: t('rum.releaseFixed'), items: props.comparison.fixed },
  {
    key: 'regressed',
    label: t('rum.releaseRegressed'),
    items: props.comparison.regressed,
  },
])
</script>

<template>
  <section class="release-compare">
    <div class="release-compare__summary">
      <article>
        <strong>{{ comparison.counts.new }}</strong>
        <span>{{ t('rum.releaseNew') }}</span>
      </article>
      <article>
        <strong>{{ comparison.counts.fixed }}</strong>
        <span>{{ t('rum.releaseFixed') }}</span>
      </article>
      <article>
        <strong>{{ comparison.counts.regressed }}</strong>
        <span>{{ t('rum.releaseRegressed') }}</span>
      </article>
    </div>
    <div class="release-compare__sections">
      <section
        v-for="section in sections"
        :key="section.key"
        class="release-compare__section"
      >
        <h3>{{ section.label }}</h3>
        <t-empty
          v-if="!section.items.length"
          :description="t('rum.empty')"
        />
        <article
          v-for="group in section.items"
          :key="group.id"
          class="release-compare__group"
        >
          <t-link
            theme="primary"
            @click="emit('openError', group)"
          >
            {{ group.message }}
          </t-link>
          <span
            >{{ group.type }} · {{ group.page || '—' }} ·
            {{ group.count }}</span
          >
        </article>
      </section>
    </div>
  </section>
</template>

<style scoped>
.release-compare {
  display: grid;
  gap: 16px;
}

.release-compare__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.release-compare__summary article {
  display: grid;
  gap: 4px;
  padding: 4px 0;
}

.release-compare__summary strong {
  font-size: 24px;
}

.release-compare__summary span,
.release-compare__group span {
  color: var(--td-text-color-secondary);
}

.release-compare__sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.release-compare__section h3 {
  margin: 0 0 10px;
}

.release-compare__section {
  min-width: 0;
}

.release-compare__group {
  display: grid;
  gap: 4px;
  padding: 10px 0;
  border-bottom: 1px solid var(--td-border-level-1-color);
}
</style>
