// ============================================================
// 通用文件上传（POST /attachments/upload）
// 上传只把文件落到存储，不绑定任何业务实体；业务侧自行保存返回的元数据。
// 对齐后端 PublicAttachmentsController 的 PublicUploadEntity。
// ============================================================

export type AttachmentStorageProvider = 'LOCAL' | 'OSS'

/** 通用上传端点的返回：文件名、类型、大小与可直接访问的地址 */
export interface UploadedObject {
  filename: string
  mimeType: string
  size: number
  storageProvider: AttachmentStorageProvider
  directory: string
  bucket?: string
  /** 存储对象键，删除 / 换签时使用 */
  fileKey: string
  /** 可直接访问的地址（LOCAL 存储时可能指向 /attachments/object?key=…） */
  url: string
  checksum?: string
  uploadedById?: string
}

/**
 * 提交给业务接口的附件元数据。
 * 只挑业务需要的字段：上传返回值里的 directory / bucket / checksum 等落库信息不回传，
 * 避免后端 DTO 做白名单校验时因多余字段被拒。
 */
export interface AttachmentRef {
  filename: string
  mimeType: string
  size: number
  url: string
  fileKey: string
}
