import type { AxiosRequestConfig } from 'axios'

import type { UploadedObject } from '../types/attachment'
import { upload } from '@/utils/request'

/**
 * 通用文件上传（POST /attachments/upload）。
 *
 * 接口文档把 requestBody 写成了 application/json，实际是 multipart（文件字段名 `file`），
 * 见后端 description「Multipart form with a file field named "file"」。
 * directory 留空时后端按 `users/<currentUserId>` 落盘；业务模块传自己的目录便于归档。
 */
export function uploadAttachment(file: File, directory?: string, config?: AxiosRequestConfig) {
  const form = new FormData()
  form.append('file', file)
  if (directory) form.append('directory', directory)
  return upload<UploadedObject>('/attachments/upload', form, config)
}
