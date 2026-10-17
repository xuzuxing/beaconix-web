import {
  ApiIcon,
  BookOpen01Icon,
  CustomerServiceIcon,
  Exchange01Icon,
  LockPasswordIcon,
  Logout01Icon,
  Notification03Icon,
  UserCircleIcon,
  type IconData,
} from '@/icons'

/** 个人信息面板里的一个菜单项 */
export interface UserMenuItem {
  key: string
  labelKey: string
  icon: IconData
  /** 点击后跳转的路由，缺省表示该入口暂未接入 */
  path?: string
  /** 危险操作（退出登录等）用错误色 */
  danger?: boolean
}

/**
 * 菜单分组，组与组之间渲染分隔线。
 * 第一组是控制台里真实存在的个人页面（对应路由表中 meta.hidden 的模块，
 * 因此它们不占侧边栏，只从顶栏右侧这个下拉进入）。
 */
export const userMenuGroups: UserMenuItem[][] = [
  [
    { key: 'profile', labelKey: 'menu.profile', icon: UserCircleIcon, path: '/profile' },
    { key: 'security', labelKey: 'menu.security', icon: LockPasswordIcon, path: '/security' },
    { key: 'tokens', labelKey: 'menu.accessTokens', icon: ApiIcon, path: '/access-tokens' },
    {
      key: 'notifications',
      labelKey: 'menu.notifications',
      icon: Notification03Icon,
      path: '/notifications',
    },
  ],
  [
    { key: 'docs', labelKey: 'layout.userDocs', icon: BookOpen01Icon },
    // 原「获取支持」入口：接到真实的工单系统（提交 / 查看回复 / 关闭）
    { key: 'tickets', labelKey: 'menu.tickets', icon: CustomerServiceIcon, path: '/tickets' },
  ],
  [
    { key: 'switch', labelKey: 'layout.userSwitchAccount', icon: Exchange01Icon },
    { key: 'logout', labelKey: 'layout.userLogout', icon: Logout01Icon, danger: true },
  ],
]

/** 账号 ID 行（示例数据，接入用户接口后替换） */
export const userAccountRows: { labelKey: string; value: string }[] = [
  { labelKey: 'layout.primaryAccountId', value: '702154416' },
  { labelKey: 'layout.loginAccountId', value: '702154416' },
]
