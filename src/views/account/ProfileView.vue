<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { updateProfile } from '@/api'
import AvatarPickerDialog from '@/components/avatar/AvatarPickerDialog.vue'
import { useOrganizationStore, useUserStore } from '@/stores'

/** 个人信息：当前账号资料、头像、所在团队/项目与退出登录（改密码与 2FA 见「安全」页） */
defineOptions({ name: 'ProfileView' })

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const orgStore = useOrganizationStore()

const avatarVisible = ref(false)
const savingAvatar = ref(false)

const avatarImage = computed(() => userStore.user?.avatarUrl ?? '')
/** 没有头像时用姓名首字母兜底 */
const avatarText = computed(() =>
  (userStore.user?.name ?? '').trim().slice(0, 1).toUpperCase(),
)

/** 选好头像（随机生成或自己上传）后立刻保存，成功后回写本地用户资料 */
async function saveAvatar(next: string) {
  if (!next || savingAvatar.value) return
  savingAvatar.value = true
  try {
    const updated = await updateProfile({ avatarUrl: next })
    if (updated) userStore.setUser(updated)
    MessagePlugin.success(t('workspace.avatar.saved'))
  } catch {
    // 请求层已统一提示
  } finally {
    savingAvatar.value = false
  }
}

const rows = computed(() => {
  const user = userStore.user
  if (!user) return []
  return [
    { labelKey: 'login.field.name', value: user.name },
    { labelKey: 'login.field.email', value: user.email },
    { labelKey: 'workspace.settings.role', value: user.globalRole },
    {
      labelKey: 'workspace.settings.emailVerified',
      value: user.emailVerified
        ? t('workspace.settings.verified')
        : t('workspace.settings.unverified'),
    },
    {
      labelKey: 'workspace.settings.team',
      value: orgStore.currentOrganization?.name ?? '—',
    },
    {
      labelKey: 'workspace.settings.project',
      value: orgStore.currentProject?.name ?? '—',
    },
  ]
})

async function logout() {
  await userStore.logout()
  orgStore.reset()
  MessagePlugin.success(t('layout.userLogoutDone'))
  await router.replace('/login')
}
</script>

<template>
  <div class="profile">
    <div class="profile__panel">
      <h3 class="profile__title">{{ t('workspace.settings.account') }}</h3>

      <div class="profile__avatar">
        <t-avatar
          size="64px"
          :image="avatarImage || undefined"
          >{{ avatarText }}</t-avatar
        >
        <div class="profile__avatar-side">
          <t-button
            size="small"
            variant="outline"
            :loading="savingAvatar"
            @click="avatarVisible = true"
          >
            {{ t('workspace.avatar.change') }}
          </t-button>
          <p class="profile__hint">{{ t('workspace.avatar.hint') }}</p>
        </div>
      </div>

      <div
        v-for="row in rows"
        :key="row.labelKey"
        class="profile__row"
      >
        <span class="profile__label">{{ t(row.labelKey) }}</span>
        <span class="profile__value">{{ row.value }}</span>
      </div>
    </div>

    <div class="profile__panel">
      <h3 class="profile__title">{{ t('workspace.profile.securityTitle') }}</h3>
      <p class="profile__hint">{{ t('workspace.profile.securityHint') }}</p>

      <div class="profile__actions">
        <t-button
          theme="primary"
          variant="outline"
          size="small"
          @click="router.push('/security')"
        >
          {{ t('workspace.profile.gotoSecurity') }}
        </t-button>
        <t-button
          variant="outline"
          size="small"
          @click="logout"
        >
          {{ t('layout.userLogout') }}
        </t-button>
      </div>
    </div>

    <!-- 头像：左侧挑随机人脸、右侧上传自己的图片，确定后立即保存 -->
    <AvatarPickerDialog
      v-model:visible="avatarVisible"
      :model-value="avatarImage"
      variant="face"
      @saved="saveAvatar"
    />
  </div>
</template>

<style scoped lang="less">
.profile {
  display: flex;
  flex-direction: column;
  gap: @beacon-gap-l;

  &__panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background-color: @beacon-bg-container;
    border: 1px solid @beacon-border;
  }

  &__title {
    margin: 0;
    font-size: @beacon-font-size-section;
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__row {
    display: flex;
    gap: 12px;
    min-height: 24px;
    font-size: @beacon-font-size-base;
    line-height: 24px;
  }

  &__avatar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid @beacon-border;
  }

  &__avatar-side {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  &__label {
    flex: none;
    width: 96px;
    color: @beacon-text-tertiary;
  }

  &__value {
    min-width: 0;
    color: @beacon-text-primary;
    word-break: break-all;
  }

  &__hint {
    margin: 0;
    color: @beacon-text-tertiary;
  }

  &__actions {
    display: flex;
    gap: 8px;
  }
}
</style>
