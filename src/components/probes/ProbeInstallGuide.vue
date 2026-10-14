<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { CodeIcon } from '@/icons'

const { t } = useI18n()
const installScriptUrl = 'https://get.beacon.dev/probe/install.sh'
</script>

<template>
  <section class="probe-install" :aria-label="t('probePage.installGuide.title')">
    <h3><AppIcon :icon="CodeIcon" />{{ t('probePage.installGuide.title') }}</h3>
    <div class="probe-install__link">
      <span>{{ t('probePage.installGuide.scriptUrl') }}</span>
      <a :href="installScriptUrl" target="_blank" rel="noopener noreferrer">
        {{ installScriptUrl }}
      </a>
    </div>
    <ul>
      <li v-for="note in ['requirements', 'enrollment', 'connect']" :key="note">
        {{ t(`probePage.installGuide.${note}`) }}
      </li>
    </ul>
  </section>
</template>

<style scoped lang="less">
.probe-install {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding-bottom: 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid @beacon-border;
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 14px;
  }
  &__link {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 13px;
    span {
      color: @beacon-text-secondary;
    }
    a {
      color: @beacon-brand;
      overflow-wrap: anywhere;
      &:hover {
        text-decoration: underline;
      }
    }
  }
  ul {
    display: grid;
    gap: 4px;
    padding-left: 18px;
    margin: 0;
    color: @beacon-text-secondary;
    font-size: 12px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }
}
</style>
