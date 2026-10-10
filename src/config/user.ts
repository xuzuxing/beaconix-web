import {
  BookOpen01Icon,
  CloudIcon,
  CodeIcon,
  CustomerServiceIcon,
  Exchange01Icon,
  GlobalIcon,
  Logout01Icon,
  UserCircleIcon,
  type IconData,
} from '@/icons'

/** 个人信息面板里的一个菜单项 */
export interface UserMenuItem {
  key: string
  labelKey: string
  icon: IconData
  /** 危险操作（退出登录等）用错误色 */
  danger?: boolean
}

/** 菜单分组，组与组之间渲染分隔线 */
export const userMenuGroups: UserMenuItem[][] = [
  [
    { key: 'profile', labelKey: 'layout.userProfile', icon: UserCircleIcon },
    { key: 'site', labelKey: 'layout.userSite', icon: GlobalIcon },
    { key: 'editor', labelKey: 'layout.userEditor', icon: CodeIcon },
    { key: 'console', labelKey: 'layout.userConsole', icon: CloudIcon },
  ],
  [
    { key: 'docs', labelKey: 'layout.userDocs', icon: BookOpen01Icon },
    { key: 'support', labelKey: 'layout.userSupport', icon: CustomerServiceIcon },
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
