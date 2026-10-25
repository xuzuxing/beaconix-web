import assert from 'node:assert/strict'
import { test } from 'node:test'

import { planTagTheme, planTier } from '../src/utils/billing.ts'

test('free, pro, and team plans have distinct presentation tiers', () => {
  assert.equal(planTier({ code: 'FREE', price: 0 }), 'free')
  assert.equal(planTier({ code: 'PRO', price: 9900 }), 'pro')
  assert.equal(planTier({ code: 'TEAM', price: 29900 }), 'team')
  assert.equal(planTier({ code: ' team ', price: 0 }), 'team')
  assert.equal(planTier({ code: 'PRO', price: 0 }), 'pro')
})

test('missing and unknown plans preserve the free or paid fallback', () => {
  assert.equal(planTier(null), 'free')
  assert.equal(planTier(undefined), 'free')
  assert.equal(planTier({ code: 'TRIAL', price: 0 }), 'free')
  assert.equal(planTier({ code: 'CUSTOM', price: 1900 }), 'pro')
})

test('existing team badges use the same tier-to-theme mapping', () => {
  assert.equal(planTagTheme(null), 'primary')
  assert.equal(planTagTheme({ code: 'FREE', price: 0 }), 'primary')
  assert.equal(planTagTheme({ code: 'PRO', price: 9900 }), 'warning')
  assert.equal(planTagTheme({ code: 'TEAM', price: 29900 }), 'default')
})
