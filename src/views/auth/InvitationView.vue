<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getInvitationByToken } from '@/api'
import type { PublicInvitationPreview } from '@/api/types/invitation'
import { useBrand } from '@/composables/useBrand'
import { useAppStore, useUserStore } from '@/stores'

/**
 * 邀请预览页：整屏居中的卡片，按「品牌 → 团队 → 授权 → 动作」的顺序排布。
 * 凭令牌公开访问；已登录用户直接转到通知中心处理，未登录用户引导先登录。
 */
defineOptions({ name: 'InvitationView' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const user = useUserStore()

const preview = ref<PublicInvitationPreview | null>(null)
const failed = ref(false)
const loading = ref(true)

const token = computed(() => String(route.params.token ?? ''))

/** 品牌整标与站点名来自平台配置（暗色下回退到内置白色版） */
const { siteName, logoSrc } = useBrand()

/** 状态投影：后端仍返回 PENDING 但已过有效期时按 EXPIRED 展示 */
const status = computed(() => {
  const value = preview.value?.status
  const expiresAt = preview.value?.expiresAt
  if (value === 'PENDING' && expiresAt && Date.parse(expiresAt) <= Date.now()) return 'EXPIRED'
  return value
})

const statusText = computed(() => (status.value ? t(`access.statusName.${status.value}`) : ''))

const statusTheme = computed(() =>
  status.value === 'ACCEPTED' ? 'success' : status.value === 'PENDING' ? 'warning' : 'default',
)

/** 待处理且需要登录：给出唯一的下一步动作 */
const actionable = computed(
  () => status.value === 'PENDING' && preview.value?.requiresLogin === true,
)

/** 无 logo 的组织用名称首字母占位 */
const initial = computed(() => preview.value?.organizationName.trim().charAt(0).toUpperCase() ?? '')

const scopeText = computed(() => {
  const value = preview.value
  if (!value) return ''
  return value.accessMode === 'ALL_PROJECTS'
    ? t('access.allProjects')
    : t('access.invitation.scopeProjects', { count: value.projectCount })
})

/** 有效期拆成日期与时间两行，窄栏里也不会折行 */
const expires = computed(() => {
  const value = preview.value?.expiresAt
  const parsed = value ? dayjs(value) : null
  if (!parsed?.isValid()) return { date: value || '—', time: '' }
  return { date: parsed.format('YYYY-MM-DD'), time: parsed.format('HH:mm') }
})

const hintText = computed(() =>
  status.value === 'ACCEPTED'
    ? t('access.invitation.acceptedHint')
    : t('access.invitation.handledHint'),
)

function goLogin() {
  void router.push({ path: '/login', query: { redirect: route.fullPath } })
}

onMounted(async () => {
  try {
    preview.value = await getInvitationByToken(token.value)
    if (user.isLogin) await router.replace('/notifications')
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="invitation-page" :class="{ 'invitation-page--dark': appStore.isDark }">
    <section class="invitation-card">
      <img class="invitation-card__brand" :src="logoSrc" :alt="siteName" />

      <template v-if="preview">
        <div class="invitation-card__avatar">
          <t-avatar v-if="preview.organizationLogoUrl" :image="preview.organizationLogoUrl" size="64px" />
          <t-avatar v-else class="invitation-card__initial" size="64px">{{ initial }}</t-avatar>
        </div>

        <p class="invitation-card__eyebrow">{{ t('access.invitation.eyebrow') }}</p>
        <h1 class="invitation-card__title">{{ preview.organizationName }}</h1>
        <p class="invitation-card__subtitle">
          {{ t('access.invitation.invitedBy', { inviter: preview.inviterName }) }}
        </p>

        <dl class="invitation-card__facts">
          <div class="invitation-card__fact">
            <dt>{{ t('access.invitation.role') }}</dt>
            <dd>{{ t(`access.orgRole.${preview.role}`) }}</dd>
          </div>
          <div class="invitation-card__fact">
            <dt>{{ t('access.invitation.scope') }}</dt>
            <dd>{{ scopeText }}</dd>
          </div>
          <div class="invitation-card__fact">
            <dt>{{ t('access.invitation.expiresAt') }}</dt>
            <dd>
              {{ expires.date }}
              <span v-if="expires.time" class="invitation-card__time">{{ expires.time }}</span>
            </dd>
          </div>
        </dl>

        <div class="invitation-card__status">
          <t-tag :theme="statusTheme" variant="light">{{ statusText }}</t-tag>
        </div>

        <t-button v-if="actionable" class="invitation-card__action" block size="large" theme="primary" @click="goLogin">
          {{ t('access.invitation.loginToContinue') }}
        </t-button>
        <p v-else class="invitation-card__hint">{{ hintText }}</p>

        <p class="invitation-card__meta">
          {{ t('access.invitation.meta', { slug: preview.organizationSlug }) }}
        </p>
      </template>

      <t-alert v-else-if="failed" theme="warning" :message="t('access.invitationUnavailable')" />

      <div v-else class="invitation-card__state">
        <t-loading v-if="loading" />
      </div>
    </section>
  </main>
</template>

<style scoped lang="less">
.invitation-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  font-family: @beacon-font-family;
  // 顶部一抹品牌色光晕；底色单独声明，装饰层失效也不会丢背景
  background-color: @beacon-bg-page;
  background-image: radial-gradient(80% 40% at 50% 0%, var(--td-brand-color-2) 0%, transparent 70%);

  // 暗色下品牌色阶本身就很蓝，用 color-mix 稀释后再叠，避免顶部整片发蓝
  &--dark {
    background-image: radial-gradient(80% 30% at 50% 0%,
        color-mix(in srgb, var(--td-brand-color-7) 20%, transparent) 0%,
        transparent 72%);
  }
}

// 与登录卡片同款度量；颜色全部走令牌，因此明暗主题自动跟随
.invitation-card {
  width: 100%;
  max-width: 480px;
  padding: 36px 32px 28px;
  text-align: center;
  background-color: @beacon-bg-container;
  border: 1px solid @beacon-border;
  border-radius: 8px;
  box-shadow: var(--td-shadow-2);

  &__brand {
    display: block;
    width: auto;
    height: 26px;
    margin: 0 auto;
  }

  &__avatar {
    display: flex;
    justify-content: center;
    margin-top: 28px;
  }

  // 组织没有 logo 时：品牌浅色底 + 品牌色首字母
  &__initial {
    font-size: 24px;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-brand;
    background-color: @beacon-brand-light;
  }

  &__eyebrow {
    margin: 16px 0 0;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-tertiary;
  }

  &__title {
    margin: 6px 0 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 30px;
    color: @beacon-text-primary;
    overflow-wrap: anywhere;
  }

  &__subtitle {
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 22px;
    color: @beacon-text-secondary;
    overflow-wrap: anywhere;
  }

  // 授权范围三栏：等宽 + 竖线分隔，底色退回页面底色
  &__facts {
    display: flex;
    margin: 24px 0 0;
    padding: 14px 0;
    background-color: @beacon-bg-page;
    border-radius: @beacon-radius-m;
  }

  &__fact {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 8px;

    &:not(:first-child) {
      border-left: 1px solid @beacon-border;
    }

    dt {
      font-size: @beacon-font-size-base;
      line-height: 18px;
      color: @beacon-text-secondary;
    }

    dd {
      margin: 4px 0 0;
      font-size: 14px;
      font-weight: @beacon-font-weight-medium;
      line-height: 22px;
      color: @beacon-text-primary;
      overflow-wrap: anywhere;
    }
  }

  &__time {
    display: block;
    font-size: @beacon-font-size-base;
    font-weight: 400;
    line-height: 18px;
    color: @beacon-text-secondary;
  }

  &__status {
    margin-top: 20px;
  }

  &__action {
    height: 44px;
    margin-top: 16px;
  }

  &__hint {
    margin: 20px 0 0;
    padding: 10px 12px;
    font-size: @beacon-font-size-base;
    line-height: 20px;
    color: @beacon-text-secondary;
    background-color: @beacon-bg-page;
    border-radius: @beacon-radius-m;
  }

  &__meta {
    margin: 20px 0 0;
    font-size: @beacon-font-size-base;
    line-height: 18px;
    color: @beacon-text-tertiary;
  }

  &__state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 0;
  }
}
</style>
