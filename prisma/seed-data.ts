import {
  Complaint,
  Officer,
  NotificationItem,
  ApuniSarkarApplication
} from '../lib/types';

// In-memory persistent singleton for the application
class DataStore {
  private static instance: DataStore;

  public complaints: Complaint[] = [];
  public officers: Officer[] = [];
  public notifications: NotificationItem[] = [];
  public apuniApplications: ApuniSarkarApplication[] = [];
  public otps: Map<string, { code: string; expiresAt: number }> = new Map();
  public idempotencyKeys: Set<string> = new Set();

  private constructor() {
    this.seedData();
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private seedData() {
    // 1. Seed Officers (L1 to L4)
    this.officers = [
      {
        id: 'off-1',
        name: 'Rajesh Negi',
        email: 'rajesh.negi@uk.gov.in',
        phone: '9876543210',
        departmentId: 'dept-jal',
        districtId: 'dist-ddn',
        level: 1,
        designation: 'Junior Engineer (Jal Sansthan)',
        role: 'OFFICER'
      },
      {
        id: 'off-2',
        name: 'Sunita Rawat',
        email: 'sunita.rawat@uk.gov.in',
        phone: '9876543211',
        departmentId: 'dept-pwd',
        districtId: 'dist-ntl',
        level: 1,
        designation: 'Assistant Engineer (PWD Nainital)',
        role: 'OFFICER'
      },
      {
        id: 'off-3',
        name: 'Devendra Bhatt',
        email: 'devendra.bhatt@uk.gov.in',
        phone: '9876543212',
        departmentId: 'dept-jal',
        districtId: 'dist-ddn',
        level: 2,
        designation: 'Executive Engineer (EE)',
        role: 'OFFICER'
      },
      {
        id: 'off-4',
        name: 'Anand Sharma (IAS)',
        email: 'cmo.grievance@uk.gov.in',
        phone: '9876543213',
        departmentId: 'dept-pwd',
        level: 4,
        designation: 'Secretary / CMO Oversight Cell',
        role: 'CMO_VIEWER'
      }
    ];

    // 2. Seed Apuni Sarkar Mock Applications (some deliberately delayed to demo Bridge feature)
    this.apuniApplications = [
      {
        id: 'app-01',
        applicationNo: 'UK-EDIST-2026-8812',
        serviceName: 'Domicile / Permanent Resident Certificate (मूल निवास)',
        applicantName: 'Manoj Joshi',
        phone: '9897001122',
        district: 'Almora',
        departmentCode: 'REVENUE',
        submittedAt: '2026-08-15T10:00:00Z',
        expectedBy: '2026-08-30T10:00:00Z',
        currentStatus: 'DELAYED',
        delayDays: 36
      },
      {
        id: 'app-02',
        applicationNo: 'UK-EDIST-2026-9045',
        serviceName: 'Scheduled Tribe / Caste Certificate (जाति प्रमाण पत्र)',
        applicantName: 'Priya Semwal',
        phone: '9897112233',
        district: 'Chamoli',
        departmentCode: 'REVENUE',
        submittedAt: '2026-09-01T11:30:00Z',
        expectedBy: '2026-09-15T11:30:00Z',
        currentStatus: 'DELAYED',
        delayDays: 20
      },
      {
        id: 'app-03',
        applicationNo: 'UK-EDIST-2026-9931',
        serviceName: 'Income Certificate (आय प्रमाण पत्र)',
        applicantName: 'Deepak Bhandari',
        phone: '9897223344',
        district: 'Dehradun',
        departmentCode: 'REVENUE',
        submittedAt: '2026-10-01T09:00:00Z',
        expectedBy: '2026-10-15T09:00:00Z',
        currentStatus: 'PENDING',
        delayDays: 0
      }
    ];

    // 3. Seed Sample Complaints with Timelines
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString();
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 3600 * 1000).toISOString();

    this.complaints = [
      {
        id: 'cmp-01',
        ticketNo: 'UK-2026-000101',
        citizenPhone: '9897001122',
        citizenName: 'Kavita Bisht',
        title: 'Drinking Water Pipeline Burst in Ranikhet Ward 4',
        description: 'पिछले 4 दिनों से मुख्य पेयजल पाइप फटा हुआ है। पूरा पानी सड़क पर बह रहा है और घरों में पेयजल की भारी किल्लत है। कृपया जल्द मरम्मत कराएं।',
        language: 'hi',
        departmentId: 'dept-jal',
        categoryId: 'cat-water-leak',
        districtId: 'dist-alm',
        villageOrTehsil: 'Ranikhet Bazaar',
        status: 'IN_PROGRESS',
        urgency: 'HIGH',
        escalationLevel: 1,
        assignedOfficerId: 'off-1',
        assignedOfficerName: 'Rajesh Negi (JE Jal Sansthan)',
        slaDueAt: new Date(now.getTime() + 18 * 3600 * 1000).toISOString(),
        remindersCount: 1,
        lastRemindedAt: twoDaysAgo,
        aiSummaryEn: 'Main drinking water line burst in Ranikhet Ward 4 causing severe water crisis for 4 days.',
        aiSummaryHi: 'रानीखेत वार्ड 4 में मुख्य पेयजल पाइपलाइन फटने से 4 दिन से पानी संकट।',
        aiConfidence: 0.94,
        supportersCount: 14,
        sourceChannel: 'VOICE',
        createdAt: fourDaysAgo,
        updatedAt: twoDaysAgo,
        events: [
          {
            id: 'evt-1',
            complaintId: 'cmp-01',
            actorType: 'CITIZEN',
            actorName: 'Kavita Bisht',
            toStatus: 'SUBMITTED',
            reason: 'Grievance lodged via Voice Input (Hindi)',
            createdAt: fourDaysAgo
          },
          {
            id: 'evt-2',
            complaintId: 'cmp-01',
            actorType: 'AI',
            actorName: 'Samadhan AI Engine',
            fromStatus: 'SUBMITTED',
            toStatus: 'TRIAGED',
            reason: 'Categorized under Drinking Water & Sanitation (Confidence 94%)',
            createdAt: fourDaysAgo
          },
          {
            id: 'evt-3',
            complaintId: 'cmp-01',
            actorType: 'SYSTEM',
            actorName: 'Auto-Routing Engine',
            fromStatus: 'TRIAGED',
            toStatus: 'ASSIGNED',
            reason: 'Assigned to L1 Nodal Officer Rajesh Negi (JE)',
            createdAt: fourDaysAgo
          },
          {
            id: 'evt-4',
            complaintId: 'cmp-01',
            actorType: 'OFFICER',
            actorName: 'Rajesh Negi',
            fromStatus: 'ASSIGNED',
            toStatus: 'IN_PROGRESS',
            notes: 'Site inspection completed. New pipeline section ordered from Almora division.',
            createdAt: twoDaysAgo
          }
        ],
        attachments: [
          {
            id: 'att-1',
            url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop',
            fileName: 'pipeline_burst_photo.jpg',
            fileSize: 340000,
            mimeType: 'image/jpeg',
            createdAt: fourDaysAgo
          }
        ]
      },
      {
        id: 'cmp-02',
        ticketNo: 'UK-2026-000102',
        citizenPhone: '9897112233',
        citizenName: 'Birendra Singh',
        title: 'Major Potholes and Landslide Rubble on Nainital-Bhowali Road',
        description: 'सड़क पर भारी बोल्डर गिरे हैं और 2 फीट गहरे गड्ढे हो चुके हैं। पर्यटकों और स्थानीय वाहनों के पलटने का गंभीर खतरा बना हुआ है।',
        language: 'hi',
        departmentId: 'dept-pwd',
        categoryId: 'cat-road-damage',
        districtId: 'dist-ntl',
        villageOrTehsil: 'Bhowali Pine Bend',
        status: 'RESOLVED_PENDING',
        urgency: 'HIGH',
        escalationLevel: 1,
        assignedOfficerId: 'off-2',
        assignedOfficerName: 'Sunita Rawat (AE PWD)',
        slaDueAt: new Date(now.getTime() - 10 * 3600 * 1000).toISOString(),
        remindersCount: 0,
        aiSummaryEn: 'Landslide rubble and massive potholes on Nainital-Bhowali road posing vehicle overturning hazard.',
        aiSummaryHi: 'नैनीताल-भवाली मार्ग पर भूस्खलन का मलबा और गहरे गड्ढे।',
        aiConfidence: 0.91,
        supportersCount: 8,
        sourceChannel: 'WEB',
        createdAt: sixDaysAgo,
        updatedAt: now.toISOString(),
        events: [
          {
            id: 'evt-10',
            complaintId: 'cmp-02',
            actorType: 'CITIZEN',
            toStatus: 'SUBMITTED',
            createdAt: sixDaysAgo
          },
          {
            id: 'evt-11',
            complaintId: 'cmp-02',
            actorType: 'OFFICER',
            actorName: 'Sunita Rawat',
            fromStatus: 'IN_PROGRESS',
            toStatus: 'RESOLVED_PENDING',
            notes: 'JCB deployed, debris cleared and patch-work completed. Verification photo attached.',
            createdAt: now.toISOString()
          }
        ],
        attachments: []
      },
      {
        id: 'cmp-03',
        ticketNo: 'UK-2026-000103',
        citizenPhone: '9897223344',
        citizenName: 'Gopal Dutt',
        title: 'Apuni Sarkar Domicile Application Pending for 36 Days',
        description: 'E-District reference UK-EDIST-2026-8812 was submitted on 15 Aug. SLA of 15 days exceeded by over 20 days. Tehsil office giving no response.',
        language: 'en',
        departmentId: 'dept-rev',
        categoryId: 'cat-land-mutation',
        districtId: 'dist-alm',
        villageOrTehsil: 'Ranikhet Tehsil',
        status: 'ESCALATED',
        urgency: 'HIGH',
        escalationLevel: 2,
        assignedOfficerId: 'off-3',
        assignedOfficerName: 'Devendra Bhatt (EE / SDM Incharge)',
        slaDueAt: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
        remindersCount: 3,
        aiSummaryEn: 'Apuni Sarkar certificate application pending 36 days without reason.',
        aiSummaryHi: 'अपनी सरकार मूल निवास प्रमाण पत्र 36 दिनों से लंबित।',
        aiConfidence: 0.88,
        supportersCount: 2,
        sourceChannel: 'BRIDGE',
        bridgeAppRef: 'UK-EDIST-2026-8812',
        createdAt: fiveDaysAgo,
        updatedAt: twoDaysAgo,
        events: [
          {
            id: 'evt-20',
            complaintId: 'cmp-03',
            actorType: 'SYSTEM',
            toStatus: 'SUBMITTED',
            reason: 'Imported from Apuni Sarkar Bridge escalation',
            createdAt: fiveDaysAgo
          },
          {
            id: 'evt-21',
            complaintId: 'cmp-03',
            actorType: 'SYSTEM',
            toStatus: 'ESCALATED',
            reason: 'L1 SLA breached without response. Automatically escalated to Level 2 (SDM/EE).',
            createdAt: twoDaysAgo
          }
        ],
        attachments: []
      }
    ];

    // 4. Seed initial notifications
    this.notifications = [
      {
        id: 'notif-1',
        recipient: '9897001122',
        channel: 'SMS',
        templateKey: 'COMPLAINT_FILED',
        title: 'CM Helpline 1905 - Complaint Registered',
        body: 'प्रिय नागरिक, आपकी शिकायत UK-2026-000101 दर्ज हो चुकी है। ट्रैक करने हेतु cmhelpline.uk.gov.in पर जाएं। - UK Govt',
        status: 'DELIVERED',
        ticketNo: 'UK-2026-000101',
        createdAt: fourDaysAgo
      }
    ];
  }

  // Generates unique Ticket numbers like UK-2026-000104
  public generateTicketNo(): string {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return `UK-2026-${randomSuffix}`;
  }
}

export const store = DataStore.getInstance();
