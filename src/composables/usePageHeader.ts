import {
  inject,
  onDeactivated,
  onScopeDispose,
  provide,
  ref,
  toValue,
  watchEffect,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * 内容区标题栏（白底 + 底部 1px 分隔线）的共享状态：主布局创建，页面写入。
 * 布局按「返回按钮 + 标题 + 标题附加区 + 动作区」渲染，页面只提供数据。
 */
export interface PageHeaderState {
  /** 页面自定义标题（通常是实体名）；为空时布局回退到路由 meta 的文案 */
  title: Ref<string>
  /** 返回目标；为 null 时不渲染返回按钮 */
  back: Ref<RouteLocationRaw | null>
}

export interface PageHeaderOptions {
  /** 本页在标题栏上的标题，如监控项名称 */
  title?: MaybeRefOrGetter<string | undefined>
  /** 返回按钮的目标路由，下钻页面（详情页）使用 */
  back?: MaybeRefOrGetter<RouteLocationRaw | null | undefined>
}

const pageHeaderKey: InjectionKey<PageHeaderState> = Symbol('beacon:page-header')

/** 主布局调用：创建标题栏状态并向下暴露给页面 */
export function providePageHeader(): PageHeaderState {
  const state: PageHeaderState = { title: ref(''), back: ref(null) }
  provide(pageHeaderKey, state)
  return state
}

/**
 * 页面调用：声明本页在标题栏上的标题与返回目标。
 * 组件卸载或被 keep-alive 停用时清空，避免残留到其它页面。
 */
export function usePageHeader(options: PageHeaderOptions): void {
  const state = inject(pageHeaderKey, null)
  if (!state) return

  const reset = () => {
    state.title.value = ''
    state.back.value = null
  }
  watchEffect(() => {
    state.title.value = toValue(options.title) ?? ''
    state.back.value = toValue(options.back) ?? null
  })
  onDeactivated(reset)
  onScopeDispose(reset)
}
