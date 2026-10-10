<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { HOME_PATH } from '@/config'

const { t } = useI18n()
const router = useRouter()

function goHome() {
  void router.replace(HOME_PATH)
}
</script>

<template>
  <t-card :bordered="false">
    <div class="not-found">
      <p class="not-found__code">404</p>
      <p class="not-found__desc">{{ t('notFound.desc') }}</p>
      <t-button theme="primary" @click="goHome">{{ t('common.backHome') }}</t-button>
    </div>
  </t-card>
</template>

<style scoped lang="less">
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px 0;
  width: 100%;
  max-width: 520px;

  &__code {
    margin: 0;
    font-size: 72px;
    font-weight: 600;
    line-height: 1;
    color: @beacon-primary-color;
  }

  &__desc {
    margin: 0;
    color: @beacon-text-color-secondary;
  }
}
</style>
