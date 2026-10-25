import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  extractOtpauthSecret,
  isRecoveryCode,
  isRecoveryCodesLow,
  isSecondFactorCode,
  isTotpCode,
  normalizeSecondFactor,
  recoveryCodesTheme,
  validatePasswordChange,
} from '../src/utils/security-presenter.ts'

test('密码变更：当前密码必填', () => {
  assert.equal(
    validatePasswordChange({
      currentPassword: '',
      newPassword: 'NewP@ss456',
      confirmPassword: 'NewP@ss456',
    }),
    'currentRequired',
  )
})

test('密码变更：新密码长度受限', () => {
  assert.equal(
    validatePasswordChange({
      currentPassword: 'OldP@ss123',
      newPassword: 'short',
      confirmPassword: 'short',
    }),
    'newLength',
  )
  assert.equal(
    validatePasswordChange({
      currentPassword: 'OldP@ss123',
      newPassword: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
      confirmPassword: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
    }),
    'newLength',
  )
  assert.equal(PASSWORD_MIN_LENGTH, 8)
})

test('密码变更：新密码不能与当前密码相同', () => {
  assert.equal(
    validatePasswordChange({
      currentPassword: 'SameP@ss123',
      newPassword: 'SameP@ss123',
      confirmPassword: 'SameP@ss123',
    }),
    'newSameAsCurrent',
  )
})

test('密码变更：两次输入必须一致', () => {
  assert.equal(
    validatePasswordChange({
      currentPassword: 'OldP@ss123',
      newPassword: 'NewP@ss456',
      confirmPassword: '',
    }),
    'confirmRequired',
  )
  assert.equal(
    validatePasswordChange({
      currentPassword: 'OldP@ss123',
      newPassword: 'NewP@ss456',
      confirmPassword: 'NewP@ss457',
    }),
    'confirmMismatch',
  )
})

test('密码变更：通过时返回空串', () => {
  assert.equal(
    validatePasswordChange({
      currentPassword: 'OldP@ss123',
      newPassword: 'NewP@ss456',
      confirmPassword: 'NewP@ss456',
    }),
    '',
  )
})

test('验证码归一化：去空白并大写', () => {
  assert.equal(normalizeSecondFactor(' 123 456 '), '123456')
  assert.equal(normalizeSecondFactor('8h2k-m4xd-9pqa'), '8H2K-M4XD-9PQA')
})

test('TOTP 码必须是 6 位数字', () => {
  assert.equal(isTotpCode('123456'), true)
  assert.equal(isTotpCode('12345'), false)
  assert.equal(isTotpCode('12345a'), false)
  assert.equal(isTotpCode('8H2K-M4XD-9PQA'), false)
})

test('恢复码形如 XXXX-XXXX-XXXX', () => {
  assert.equal(isRecoveryCode('8H2K-M4XD-9PQA'), true)
  assert.equal(isRecoveryCode('8h2k m4xd 9pqa'), true)
  assert.equal(isRecoveryCode('8H2K-M4XD'), false)
  assert.equal(isRecoveryCode('123456'), false)
})

test('关闭 / 重置恢复码接受动态码或恢复码', () => {
  assert.equal(isSecondFactorCode('123456'), true)
  assert.equal(isSecondFactorCode('8H2K-M4XD-9PQA'), true)
  assert.equal(isSecondFactorCode('nope'), false)
  assert.equal(isSecondFactorCode(''), false)
})

test('恢复码库存阈值', () => {
  assert.equal(isRecoveryCodesLow(0), false)
  assert.equal(isRecoveryCodesLow(1), true)
  assert.equal(isRecoveryCodesLow(3), true)
  assert.equal(isRecoveryCodesLow(4), false)
})

test('恢复码主题随剩余数量变化', () => {
  assert.equal(recoveryCodesTheme(0), 'danger')
  assert.equal(recoveryCodesTheme(2), 'warning')
  assert.equal(recoveryCodesTheme(10), 'success')
})

test('从 otpauth URL 提取密钥', () => {
  assert.equal(
    extractOtpauthSecret(
      'otpauth://totp/Beacon:john@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Beacon',
    ),
    'JBSWY3DPEHPK3PXP',
  )
  assert.equal(extractOtpauthSecret('otpauth://totp/Beacon:john@example.com?issuer=Beacon'), '')
})
