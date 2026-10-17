/**
 * 公开配置的值：后端把 `system.*` 的展示型配置以扁平 map 下发，值都是标量。
 */
export type PublicSettingValue = string | number | boolean | null

/** 公开配置快照，形如 `{ 'system.siteName': 'Beacon', ... }` */
export type PublicSettings = Record<string, PublicSettingValue>
