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
  <t-card
    :title="t('blankDemo.title')"
    :bordered="false"
    class="blank-demo"
  >
    <p class="blank-demo__desc">{{ t('blankDemo.desc') }}</p>
    <t-button
      theme="primary"
      @click="goHome"
      >{{ t('common.backHome') }}</t-button
    >
  </t-card>
</template>

<style scoped lang="less">
.blank-demo {
  width: 100%;
  max-width: 520px;

  &__desc {
    margin: 0 0 16px;
    color: @beacon-text-color-secondary;
  }
}
</style>
