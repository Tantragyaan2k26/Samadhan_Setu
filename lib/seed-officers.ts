import { Officer } from './types';

export function developmentSeedOfficers(officers: Officer[]): Officer[] {
  return [
    ...officers.map(officer => ({ ...officer, role: officer.id === 'off-4' ? 'OFFICER' as const : officer.role })),
    {
      id: 'off-5', name: 'Meera Rawat', email: 'meera.rawat.l3@uk.gov.in', phone: '9876543214',
      departmentId: 'dept-jal', districtId: 'dist-ddn', level: 3,
      designation: 'Executive Engineer (Jal Sansthan)', role: 'OFFICER'
    },
    {
      id: 'off-6', name: 'Arun Bisht', email: 'arun.bisht.l4@uk.gov.in', phone: '9876543215',
      departmentId: 'dept-jal', districtId: 'dist-ddn', level: 4,
      designation: 'Chief Engineer (Jal Sansthan)', role: 'OFFICER'
    }
  ];
}
