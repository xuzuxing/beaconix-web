<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { getInvitationByToken } from '@/api'
import type { PublicInvitationPreview } from '@/api/types/invitation'
import { useUserStore } from '@/stores'
import defaultLogo from '@/assets/logo/default.png'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const user = useUserStore()
const preview = ref<PublicInvitationPreview | null>(null)
const failed = ref(false)
onMounted(async () => {
  try {
    preview.value = await getInvitationByToken(String(route.params.token ?? ''))
    if (user.isLogin) await router.replace('/notifications')
  } catch {
    failed.value = true
  }
})
</script>
<template>
  <main class="invitation-page">
    <img :src="defaultLogo" alt="Beacon" width="128" />
    <t-alert v-if="failed" theme="warning" :message="t('access.invitationUnavailable')" />
    <template v-else-if="preview">
      <h1>{{ preview.organizationName }}</h1>
      <t-tag>{{ preview.status }}</t-tag>
      <router-link
        v-if="preview.status === 'PENDING'"
        :to="{ path: '/login', query: { redirect: route.fullPath } }"
        replace
      >
        {{ t('access.signIn') }}
      </router-link>
    </template>
    <t-loading v-else />
  </main>
</template>
<style scoped>
.invitation-page {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 20px;
  min-height: 100vh;
  padding: 24px;
}
.invitation-page h1 {
  font-size: 24px;
  overflow-wrap: anywhere;
  text-align: center;
}
</style>
