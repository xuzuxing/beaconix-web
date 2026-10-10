/**
 * 环境列表（顶栏环境选择器 / 环境信息卡使用）。
 * 当前为静态示例数据，接入环境接口后把 envList 换成请求结果即可。
 */
export interface EnvItem {
  /** 环境 ID */
  id: string
  /** 环境名称 */
  name: string
  /** 套餐标签的 i18n key（如体验版），不传则不显示 */
  tagKey?: string
  /** 是否生效中 */
  active: boolean
  /** 创建时间 */
  createdAt: string
  /** 到期时间 */
  expiredAt: string
  /** 所属地域的 i18n key */
  regionKey: string
  /** 套餐信息的 i18n key */
  planKey: string
}

export const envList: EnvItem[] = [
  {
    id: 'beacon-prod-d4gxu2ndzd50a9238',
    name: 'beacon-prod',
    tagKey: 'layout.envTag',
    active: true,
    createdAt: '2026-07-22 14:45:52',
    expiredAt: '2027-01-22 23:59:59',
    regionKey: 'layout.regionShanghai',
    planKey: 'layout.envTag',
  },
  {
    id: 'beacon-test-2b7c5e9a1f60c834',
    name: 'beacon-test',
    tagKey: 'layout.envTag',
    active: true,
    createdAt: '2026-08-05 10:12:30',
    expiredAt: '2027-02-05 23:59:59',
    regionKey: 'layout.regionGuangzhou',
    planKey: 'layout.envTag',
  },
  {
    id: 'beacon-dev-5d1e8a3b6c02f417',
    name: 'beacon-dev',
    tagKey: 'layout.envTag',
    active: true,
    createdAt: '2026-09-11 09:03:18',
    expiredAt: '2027-03-11 23:59:59',
    regionKey: 'layout.regionBeijing',
    planKey: 'layout.envTag',
  },
]
