import {
  Analytics01Icon,
  ApiIcon,
  Calendar03Icon,
  Folder01Icon,
  Invoice01Icon,
  KanbanIcon,
  Mail01Icon,
  Notification03Icon,
  SecurityCheckIcon,
  ServerIcon,
  TeamWorkIcon,
  UserIcon,
} from '@/icons'
import { notificationIconName } from '@/utils/notification-presenter'

const ICONS = {
  Analytics01Icon,
  ApiIcon,
  Calendar03Icon,
  Folder01Icon,
  Invoice01Icon,
  KanbanIcon,
  Mail01Icon,
  Notification03Icon,
  SecurityCheckIcon,
  ServerIcon,
  TeamWorkIcon,
  UserIcon,
}

export function notificationIcon(type: string) {
  return ICONS[notificationIconName(type) as keyof typeof ICONS] ?? Notification03Icon
}
