import {
  inject,
  onActivated,
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
 * 组件卸载或被 keep-alive 停用时清空，避免残留到其它页面；
 * 重新激活时再写回来（见下方 onActivated 的注释）。
 */
export function usePageHeader(options: PageHeaderOptions): void {
  const state = inject(pageHeaderKey, null)
  if (!state) return

  /** 被缓存的页面停用期间不写共享标题栏，避免后台页改动当前页的标题 */
  let active = true

  /** 把本页声明的标题与返回目标写入布局 */
  const apply = () => {
    if (!active) return
    state.title.value = toValue(options.title) ?? ''
    state.back.value = toValue(options.back) ?? null
  }

  const reset = () => {
    state.title.value = ''
    state.back.value = null
  }

  watchEffect(apply)

  // 页面被 keep-alive 缓存后，停用会清空标题与返回目标；再次激活时
  // watchEffect 的依赖（静态 title / back）并没有变化，不会自动重跑，
  // 所以这里必须主动补写一次——否则「进入二级页面 → 返回 → 再进入」后，
  // 标题栏左上角的返回按钮就再也不出现了。
  onActivated(() => {
    active = true
    apply()
  })

  onDeactivated(() => {
    active = false
    reset()
  })

  onScopeDispose(reset)
}
