<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { uploadAttachment } from '@/api'
import type { UploadedObject } from '@/api/types/attachment'
import ImageUploader from '@/components/upload/ImageUploader.vue'
import { uploadedFromUrl } from '@/utils/attachment'
import {
  type FaceAvatarConfig,
  faceFile,
  faceKey,
  facePreviewUrl,
  randomFaceConfig,
} from '@/utils/avatar-face'

/** 一批候选的数量 */
const BATCH_SIZE = 12

/**
 * 头像选择弹窗：左侧一批随机生成的像素人脸，右侧是上传组件（既是预览也是上传入口）。
 *
 * 点左侧候选只是把那张图塞进上传组件的预览里，**不产生上传**；点「确定」时
 * 才把选中的那张转成 PNG 上传一次，避免来回点几个候选就攒出一堆附件。
 * 上传组件的「更换图片」随时可以选自己的文件覆盖，选完即上传、以它为准。
 */
defineOptions({ name: 'AvatarPickerDialog' })

const visible = defineModel<boolean>('visible', { required: true })
/** 当前头像地址：打开时回显，确定后写回新地址 */
const url = defineModel<string>({ default: '' })
const emit = defineEmits<{ saved: [url: string] }>()

const props = withDefaults(
  defineProps<{
    /** 上传目录，例如 avatars / teams */
    directory?: string
    maxSize?: number
    /** 一批候选的数量 */
    count?: number
  }>(),
  { directory: 'avatars', maxSize: 2 * 1024 * 1024, count: BATCH_SIZE },
)

const { t } = useI18n()

interface Candidate {
  key: string
  preview: string
  face: FaceAvatarConfig
}

const candidates = ref<Candidate[]>([])
/** 当前选中的随机头像：只在本地，确认时才上传 */
const chosen = ref<Candidate | null>(null)
/** 上传组件的单图模型：可能是「随机头像草稿」，也可能是真实上传结果 */
const picked = ref<UploadedObject[]>([])
const uploader = ref<InstanceType<typeof ImageUploader> | null>(null)
/** 确认时正在上传随机头像 */
const committing = ref(false)
let generation = 0

/** 草稿项用 fileKey 前缀标记，区别于真实上传结果 */
const DRAFT_PREFIX = 'face:'

/** 随机头像在上传组件里的展示项（url 是 SVG dataURL，还没上传） */
function faceDraft(candidate: Candidate): UploadedObject {
  return {
    filename: 'avatar.png',
    mimeType: 'image/png',
    size: 0,
    storageProvider: 'LOCAL',
    directory: props.directory,
    fileKey: `${DRAFT_PREFIX}${candidate.key}`,
    url: candidate.preview,
  }
}

function isFaceDraft(item: UploadedObject | undefined): boolean {
  return Boolean(item?.fileKey.startsWith(DRAFT_PREFIX))
}

/** 确认时上传随机头像，或正在上传自己的图片，都算「忙」 */
const busy = computed(() => committing.value || Boolean(uploader.value?.uploading))

/** 选中随机头像时提示「确认后上传」（格式说明由上传组件自带，避免重复） */
const hint = computed(() => (chosen.value ? t('workspace.avatar.pendingHint') : ''))

function buildCandidates() {
  candidates.value = Array.from({ length: props.count }, () => {
    const face = randomFaceConfig()
    return { key: faceKey(face), preview: facePreviewUrl(face), face }
  })
  chosen.value = null
}

watch(
  visible,
  (value) => {
    generation++
    committing.value = false
    if (!value) return
    picked.value = url.value ? [uploadedFromUrl(url.value, props.directory)] : []
    buildCandidates()
  },
  { immediate: true },
)

// 草稿被换成真实上传结果（手动上传）或被删空时，随机选中随之作废
watch(picked, (value) => {
  if (!isFaceDraft(value[0])) chosen.value = null
})

/** 点选随机头像：塞进上传组件预览，不上传（确认时才转 PNG 上传） */
function pick(candidate: Candidate) {
  if (busy.value) return
  chosen.value = candidate
  picked.value = [faceDraft(candidate)]
}

/** 把选中的随机头像转成 PNG 上传一次，返回最终地址 */
async function commitFace(face: FaceAvatarConfig): Promise<string | null> {
  const file = await faceFile(face)
  if (!file) {
    MessagePlugin.error(t('workspace.avatar.generateFailed'))
    return null
  }
  try {
    const uploaded = await uploadAttachment(file, props.directory)
    return uploaded?.url ?? null
  } catch {
    // 请求层已统一提示
    return null
  }
}

async function confirm() {
  if (busy.value) return

  // 选了随机头像：这时才真正上传（点几次候选都只产生这一次上传）
  if (chosen.value) {
    const token = generation
    const face = chosen.value.face
    committing.value = true
    try {
      const next = await commitFace(face)
      if (token !== generation || !next) return
      finish(next)
    } finally {
      if (token === generation) committing.value = false
    }
    return
  }

  // 否则用右侧手动上传的结果（那个在选文件时已上传）
  const next = picked.value[0]?.url
  if (!next) {
    MessagePlugin.warning(t('workspace.avatar.required'))
    return
  }
  finish(next)
}

function finish(next: string) {
  url.value = next
  emit('saved', next)
  visible.value = false
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :header="t('workspace.avatar.title')"
    width="min(720px, calc(100vw - 32px))"
    :confirm-btn="{ content: t('common.confirm'), loading: busy }"
    :cancel-btn="t('common.cancel')"
    :close-on-overlay-click="!busy"
    @confirm="confirm"
  >
    <div class="avatar-picker">
      <!-- 左侧：随机头像候选 -->
      <section class="avatar-picker__random">
        <div class="avatar-picker__head">
          <span class="avatar-picker__title">{{ t('workspace.avatar.candidates') }}</span>
          <t-button size="small" variant="text" :disabled="busy" @click="buildCandidates">
            {{ t('workspace.avatar.shuffle') }}
          </t-button>
        </div>

        <div class="avatar-picker__grid">
          <button
            v-for="candidate in candidates"
            :key="candidate.key"
            type="button"
            class="avatar-picker__option"
            :class="{ 'is-active': chosen?.key === candidate.key }"
            :disabled="busy"
            :aria-label="t('workspace.avatar.pickCandidate')"
            :aria-pressed="chosen?.key === candidate.key"
            @click="pick(candidate)"
          >
            <img :src="candidate.preview" alt="" />
          </button>
        </div>
      </section>

      <!-- 右侧：上传组件既是预览也是上传入口（选中的随机图直接显示在这里） -->
      <section class="avatar-picker__upload">
        <span class="avatar-picker__title">{{ t('workspace.avatar.upload') }}</span>

        <ImageUploader
          ref="uploader"
          v-model="picked"
          :directory="directory"
          :max-size="maxSize"
          single
          :disabled="committing"
        />
        <p v-if="hint" class="avatar-picker__hint">{{ hint }}</p>
      </section>
    </div>
  </t-dialog>
</template>

<style scoped lang="less">
.avatar-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 240px);
  gap: 24px;

  &__random {
    min-width: 0;
  }

  &__upload {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding-left: 24px;
    border-left: 1px solid @beacon-border;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__title {
    font-weight: @beacon-font-weight-medium;
    color: @beacon-text-primary;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 10px;
  }

  &__option {
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    overflow: hidden;
    cursor: pointer;
    background: @beacon-bg-page;
    border: 1px solid @beacon-border;
    border-radius: @beacon-radius-m;

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      /* 16×16 的像素头像放大后保持硬边 */
      image-rendering: pixelated;
    }

    &:hover:not(:disabled) {
      border-color: @beacon-brand;
    }

    &.is-active {
      border-color: @beacon-brand;
      box-shadow: 0 0 0 2px @beacon-brand-light;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  &__hint {
    margin: 0;
    font-size: @beacon-font-size-caption;
    color: @beacon-text-tertiary;
  }
}

@media (width <= 640px) {
  .avatar-picker {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;

    &__upload {
      padding-top: 16px;
      padding-left: 0;
      border-top: 1px solid @beacon-border;
      border-left: 0;
    }
  }
}
</style>
