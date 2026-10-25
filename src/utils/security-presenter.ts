/**
 * 安全页（登录密码 / 两步验证）的纯函数：表单校验、验证码归一化与展示派生。
 * 与接口契约 docs/api-1.yaml 的 ChangePasswordDto 与 Two-Factor 接口保持一致。
 */

/** 密码长度约束，与后端校验一致（8-72 位） */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72

/** 剩余恢复码低于该阈值时提醒用户补充 */
export const RECOVERY_CODE_LOW_THRESHOLD = 3

export interface PasswordChangeValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * 修改密码表单校验：返回 i18n key 后缀（空串表示通过）。
 * 调用方映射到 `workspace.security.validation.*`。
 */
export function validatePasswordChange(values: PasswordChangeValues): string {
  if (!values.currentPassword) return 'currentRequired'
  if (!values.newPassword) return 'newRequired'
  if (
    values.newPassword.length < PASSWORD_MIN_LENGTH ||
    values.newPassword.length > PASSWORD_MAX_LENGTH
  ) {
    return 'newLength'
  }
  if (values.newPassword === values.currentPassword) return 'newSameAsCurrent'
  if (!values.confirmPassword) return 'confirmRequired'
  if (values.confirmPassword !== values.newPassword) return 'confirmMismatch'
  return ''
}

/** 归一化一次性验证码：去掉空白并统一大写（恢复码大小写不敏感） */
export function normalizeSecondFactor(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** 6 位数字动态验证码（TOTP） */
export function isTotpCode(raw: string): boolean {
  return /^\d{6}$/.test(normalizeSecondFactor(raw))
}

/** 恢复码：12 位字母数字；接口以 XXXX-XXXX-XXXX 展示，输入允许省略连字符或空格 */
export function isRecoveryCode(raw: string): boolean {
  return /^[0-9A-Z]{12}$/.test(normalizeSecondFactor(raw).replace(/-/g, ''))
}

/** 关闭 / 重置恢复码时，验证码既可以是动态码也可以是恢复码 */
export function isSecondFactorCode(raw: string): boolean {
  return isTotpCode(raw) || isRecoveryCode(raw)
}

/** 恢复码库存是否偏低（仍有可用码但已接近耗尽） */
export function isRecoveryCodesLow(remaining: number): boolean {
  return remaining > 0 && remaining <= RECOVERY_CODE_LOW_THRESHOLD
}

/** 从 otpauth:// URL 提取 Base32 密钥，供无法扫码时手动录入 */
export function extractOtpauthSecret(otpauthUrl: string): string {
  const match = /[?&]secret=([^&]+)/i.exec(otpauthUrl)
  const value = match?.[1]
  return value ? decodeURIComponent(value) : ''
}

/** 剩余恢复码数量的展示主题（TDesign tag theme） */
export function recoveryCodesTheme(remaining: number): 'success' | 'warning' | 'danger' {
  if (remaining <= 0) return 'danger'
  if (isRecoveryCodesLow(remaining)) return 'warning'
  return 'success'
}
