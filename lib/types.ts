export type Role =
  | 'CITIZEN'
  | 'OFFICER'
  | 'DEPT_ADMIN'
  | 'CMO_VIEWER'
  | 'AUDITOR'
  | 'SUPER_ADMIN';

export type ComplaintStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED_PENDING'
  | 'CLOSED'
  | 'REOPENED'
  | 'ESCALATED'
  | 'REJECTED'
  | 'MERGED';

export type UrgencyLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';

export interface District {
  id: string;
  code: string;
  nameEn: string;
  nameHi: string;
  headquarters: string;
}

export interface Department {
  id: string;
  code: string;
  nameEn: string;
  nameHi: string;
  description?: string;
}

export interface Category {
  id: string;
  code: string;
  departmentId: string;
  nameEn: string;
  nameHi: string;
  keywords: string[];
  slaResponseHours: number;
  slaResolutionHours: number;
}

export interface Officer {
  id: string;
  name: string;
  email: string;
  phone: string;
  departmentId: string;
  districtId?: string;
  level: number; // 1, 2, 3, 4
  designation: string;
  role: Role;
}

export interface ComplaintEvent {
  id: string;
  complaintId: string;
  actorType: 'CITIZEN' | 'OFFICER' | 'SYSTEM' | 'AI';
  actorName?: string;
  fromStatus?: ComplaintStatus;
  toStatus: ComplaintStatus;
  reason?: string;
  notes?: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  url: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

export interface Feedback {
  rating: number; // 1 to 5
  resolved: boolean;
  comment?: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  ticketNo: string; // UK-2026-XXXXXX
  citizenId?: string;
  citizenPhone: string;
  citizenName?: string;

  title: string;
  description: string;
  language: 'hi' | 'en';

  departmentId?: string;
  categoryId?: string;
  districtId?: string;
  villageOrTehsil?: string;
  latitude?: number;
  longitude?: number;

  status: ComplaintStatus;
  urgency: UrgencyLevel;
  escalationLevel: number; // 1 to 4

  assignedOfficerId?: string;
  assignedOfficerName?: string;

  slaDueAt?: string;
  remindersCount: number;
  lastRemindedAt?: string;

  aiSummaryEn?: string;
  aiSummaryHi?: string;
  aiConfidence?: number;

  isDuplicateOf?: string;
  supportersCount: number;

  sourceChannel: 'WEB' | 'VOICE' | 'WHATSAPP' | 'BRIDGE';
  bridgeAppRef?: string;

  createdAt: string;
  updatedAt: string;

  events: ComplaintEvent[];
  attachments: Attachment[];
  feedback?: Feedback;
}

export interface NotificationItem {
  id: string;
  recipient: string;
  channel: 'SMS' | 'WHATSAPP' | 'IN_APP';
  templateKey: string;
  title: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED';
  ticketNo?: string;
  createdAt: string;
}

export interface ApuniSarkarApplication {
  id: string;
  applicationNo: string;
  serviceName: string;
  applicantName: string;
  phone: string;
  district: string;
  departmentCode: string;
  submittedAt: string;
  expectedBy: string;
  currentStatus: 'PENDING' | 'DELAYED' | 'APPROVED' | 'REJECTED';
  delayDays: number;
}
