import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFAULT_ATTACHMENT_MAX_COUNT,
  DEFAULT_ATTACHMENT_MAX_SIZE,
  DOCUMENT_ACCEPT,
  IMAGE_ACCEPT,
  attachmentAccept,
  evaluateAttachments,
  fileExtension,
  formatFileSize,
  isAllowedType,
  isImageAttachment,
  remainingAttachmentSlots,
  toAttachmentRef,
  toAttachmentRefs,
} from '../src/utils/attachment.ts'

const file = (name, type, size = 1024) => ({ name, type, size })

const imageLimits = {
  kind: 'image',
  maxSize: DEFAULT_ATTACHMENT_MAX_SIZE,
  maxCount: DEFAULT_ATTACHMENT_MAX_COUNT,
}

const documentLimits = {
  kind: 'document',
  maxSize: DEFAULT_ATTACHMENT_MAX_SIZE,
  maxCount: DEFAULT_ATTACHMENT_MAX_COUNT,
}

const uploaded = (overrides = {}) => ({
  filename: 'shot.png',
  mimeType: 'image/png',
  size: 2048,
  storageProvider: 'LOCAL',
  directory: 'tickets',
  bucket: 'beaconix-attachments',
  fileKey: 'tickets/2026/10/shot.png',
  url: 'https://cdn.example.test/tickets/shot.png',
  checksum: 'sha256:abc',
  uploadedById: 'user-1',
  ...overrides,
})

// ------------------------------------------------------------
// 扩展名与大小
// ------------------------------------------------------------

test('fileExtension lowercases the suffix and ignores hidden files', () => {
  assert.equal(fileExtension('app.LOG'), '.log')
  assert.equal(fileExtension('archive.tar.pdf'), '.pdf')
  assert.equal(fileExtension('.env'), '')
  assert.equal(fileExtension('README'), '')
})

test('formatFileSize switches units at 1 KB and 1 MB', () => {
  assert.equal(formatFileSize(0), '0 B')
  assert.equal(formatFileSize(512), '512 B')
  assert.equal(formatFileSize(1024), '1 KB')
  assert.equal(formatFileSize(1536), '1.5 KB')
  assert.equal(formatFileSize(DEFAULT_ATTACHMENT_MAX_SIZE), '5 MB')
  assert.equal(formatFileSize(Number.NaN), '0 B')
})

test('defaults match the product limits: 5MB per file, 5 files', () => {
  assert.equal(DEFAULT_ATTACHMENT_MAX_SIZE, 5 * 1024 * 1024)
  assert.equal(DEFAULT_ATTACHMENT_MAX_COUNT, 5)
})

// ------------------------------------------------------------
// 类型校验
// ------------------------------------------------------------

test('images accept png / jpeg / webp / gif only', () => {
  assert.equal(isAllowedType(file('a.png', 'image/png'), 'image'), true)
  assert.equal(isAllowedType(file('a.jpg', 'image/jpeg'), 'image'), true)
  assert.equal(isAllowedType(file('a.webp', 'image/webp'), 'image'), true)
  assert.equal(isAllowedType(file('a.gif', 'image/gif'), 'image'), true)
  // SVG 可内嵌脚本，明确不收
  assert.equal(isAllowedType(file('a.svg', 'image/svg+xml'), 'image'), false)
  assert.equal(isAllowedType(file('a.log', 'text/plain'), 'image'), false)
})

test('documents accept pdf plus log / txt by extension when MIME is missing', () => {
  assert.equal(isAllowedType(file('a.pdf', 'application/pdf'), 'document'), true)
  assert.equal(isAllowedType(file('app.log', ''), 'document'), true)
  assert.equal(isAllowedType(file('app.txt', 'text/plain'), 'document'), true)
  // 浏览器给 .log 的 MIME 常是 octet-stream，仍按扩展名放行
  assert.equal(isAllowedType(file('app.log', 'application/octet-stream'), 'document'), true)
  assert.equal(isAllowedType(file('a.exe', 'application/octet-stream'), 'document'), false)
  assert.equal(isAllowedType(file('a.png', 'image/png'), 'document'), false)
})

test('accept strings cover both kinds', () => {
  assert.equal(attachmentAccept('image'), IMAGE_ACCEPT)
  assert.equal(attachmentAccept('document'), DOCUMENT_ACCEPT)
  assert.ok(IMAGE_ACCEPT.includes('image/png'))
  assert.ok(DOCUMENT_ACCEPT.includes('.log'))
  assert.ok(DOCUMENT_ACCEPT.includes('application/pdf'))
})

// ------------------------------------------------------------
// 批量校验
// ------------------------------------------------------------

test('evaluateAttachments accepts valid files and reports each rejection once', () => {
  const { accepted, rejected } = evaluateAttachments(
    [
      file('ok.png', 'image/png'),
      file('bad.log', ''),
      file('huge.png', 'image/png', 6 * 1024 * 1024),
    ],
    0,
    imageLimits,
  )

  assert.deepEqual(
    accepted.map((item) => item.name),
    ['ok.png'],
  )
  assert.deepEqual(rejected, [
    { name: 'bad.log', reason: 'type' },
    { name: 'huge.png', reason: 'size' },
  ])
})

test('type is reported before size when a file fails both', () => {
  const { rejected } = evaluateAttachments(
    [file('huge.exe', 'application/octet-stream', 9 * 1024 * 1024)],
    0,
    documentLimits,
  )
  assert.deepEqual(rejected, [{ name: 'huge.exe', reason: 'type' }])
})

test('quota counts already uploaded files and files accepted in this batch', () => {
  const { accepted, rejected } = evaluateAttachments(
    [file('a.png', 'image/png'), file('b.png', 'image/png'), file('c.png', 'image/png')],
    4,
    imageLimits,
  )

  assert.deepEqual(
    accepted.map((item) => item.name),
    ['a.png'],
  )
  assert.deepEqual(rejected, [
    { name: 'b.png', reason: 'count' },
    { name: 'c.png', reason: 'count' },
  ])
})

test('evaluateAttachments accepts exactly up to maxCount', () => {
  const { accepted, rejected } = evaluateAttachments(
    Array.from({ length: 5 }, (_, index) => file(`p${index}.png`, 'image/png')),
    0,
    imageLimits,
  )
  assert.equal(accepted.length, 5)
  assert.deepEqual(rejected, [])
})

test('remainingAttachmentSlots never goes negative', () => {
  assert.equal(remainingAttachmentSlots(5, 0), 5)
  assert.equal(remainingAttachmentSlots(5, 5), 0)
  assert.equal(remainingAttachmentSlots(5, 7), 0)
})

// ------------------------------------------------------------
// 元数据转换
// ------------------------------------------------------------

test('toAttachmentRef keeps only the fields business APIs need', () => {
  const ref = toAttachmentRef(uploaded())
  assert.deepEqual(ref, {
    filename: 'shot.png',
    mimeType: 'image/png',
    size: 2048,
    url: 'https://cdn.example.test/tickets/shot.png',
    fileKey: 'tickets/2026/10/shot.png',
  })
  assert.equal('directory' in ref, false)
  assert.equal('checksum' in ref, false)
})

test('toAttachmentRefs maps a list in order', () => {
  const refs = toAttachmentRefs([
    uploaded(),
    uploaded({
      filename: 'app.log',
      mimeType: 'text/plain',
      fileKey: 'app.log',
    }),
  ])
  assert.deepEqual(
    refs.map((item) => item.filename),
    ['shot.png', 'app.log'],
  )
})

test('isImageAttachment prefers MIME and falls back to the extension', () => {
  assert.equal(isImageAttachment({ filename: 'a.png', mimeType: 'image/png' }), true)
  assert.equal(isImageAttachment({ filename: 'a.pdf', mimeType: 'application/pdf' }), false)
  assert.equal(isImageAttachment({ filename: 'app.log', mimeType: '' }), false)
  assert.equal(isImageAttachment({ filename: 'shot.png', mimeType: '' }), true)
})
