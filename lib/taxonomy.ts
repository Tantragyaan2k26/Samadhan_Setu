import { District, Department, Category } from './types';

export const DISTRICTS: District[] = [
  { id: 'dist-ddn', code: 'DDN', nameEn: 'Dehradun', nameHi: 'देहरादून', headquarters: 'Dehradun' },
  { id: 'dist-hwr', code: 'HWR', nameEn: 'Haridwar', nameHi: 'हरिद्वार', headquarters: 'Haridwar' },
  { id: 'dist-ntl', code: 'NTL', nameEn: 'Nainital', nameHi: 'नैनीताल', headquarters: 'Nainital' },
  { id: 'dist-usn', code: 'USN', nameEn: 'Udham Singh Nagar', nameHi: 'उधम सिंह नगर', headquarters: 'Rudrapur' },
  { id: 'dist-alm', code: 'ALM', nameEn: 'Almora', nameHi: 'अल्मोड़ा', headquarters: 'Almora' },
  { id: 'dist-pgr', code: 'PGR', nameEn: 'Pithoragarh', nameHi: 'पिथौरागढ़', headquarters: 'Pithoragarh' },
  { id: 'dist-pau', code: 'PAU', nameEn: 'Pauri Garhwal', nameHi: 'पौड़ी गढ़वाल', headquarters: 'Pauri' },
  { id: 'dist-teh', code: 'TEH', nameEn: 'Tehri Garhwal', nameHi: 'टिहरी गढ़वाल', headquarters: 'New Tehri' },
  { id: 'dist-cha', code: 'CHA', nameEn: 'Chamoli', nameHi: 'चमोली', headquarters: 'Gopeshwar' },
  { id: 'dist-rud', code: 'RUD', nameEn: 'Rudraprayag', nameHi: 'रुद्रप्रयाग', headquarters: 'Rudraprayag' },
  { id: 'dist-utk', code: 'UTK', nameEn: 'Uttarkashi', nameHi: 'उत्तरकाशी', headquarters: 'Uttarkashi' },
  { id: 'dist-bag', code: 'BAG', nameEn: 'Bageshwar', nameHi: 'बागेश्वर', headquarters: 'Bageshwar' },
  { id: 'dist-chp', code: 'CHP', nameEn: 'Champawat', nameHi: 'चंपावत', headquarters: 'Champawat' }
];

export const DEPARTMENTS: Department[] = [
  {
    id: 'dept-jal',
    code: 'JAL_SANSTHAN',
    nameEn: 'Drinking Water & Sanitation (Jal Sansthan)',
    nameHi: 'पेयजल एवं स्वच्छता (जल संस्थान)',
    description: 'Pipeline leaks, drinking water supply, tap connection, sewage'
  },
  {
    id: 'dept-pwd',
    code: 'PWD',
    nameEn: 'Public Works Department (PWD)',
    nameHi: 'लोक निर्माण विभाग (लो०नि०वि०)',
    description: 'Potholes, broken roads, landslide blockages, bridge repairs'
  },
  {
    id: 'dept-upcl',
    code: 'UPCL',
    nameEn: 'Power & Energy (UPCL)',
    nameHi: 'ऊर्जा एवं विद्युत निगम (UPCL)',
    description: 'Power cuts, transformer blowout, electric poles, billing dispute'
  },
  {
    id: 'dept-rev',
    code: 'REVENUE',
    nameEn: 'Revenue & Land Records',
    nameHi: 'राजस्व एवं भूमि अभिलेख',
    description: 'Encroachment, land mutation (Dakhil Kharij), patwari reports, demarcation'
  },
  {
    id: 'dept-health',
    code: 'HEALTH',
    nameEn: 'Health & Family Welfare',
    nameHi: 'चिकित्सा स्वास्थ्य एवं परिवार कल्याण',
    description: 'Doctor absenteeism in PHC/CHC, ambulance delay, medicine availability'
  },
  {
    id: 'dept-panch',
    code: 'PANCHAYATI_RAJ',
    nameEn: 'Panchayati Raj & Rural Development',
    nameHi: 'पंचायती राज एवं ग्राम्य विकास',
    description: 'Village sanitation, drainage, Gram Pradhan dispute, MGNREGA'
  },
  {
    id: 'dept-soc',
    code: 'SOCIAL_WELFARE',
    nameEn: 'Social Welfare & Pensions',
    nameHi: 'समाज कल्याण विभाग',
    description: 'Old-age pension, widow pension, disability grant delays'
  },
  {
    id: 'dept-food',
    code: 'FOOD_CIVIL_SUPPLIES',
    nameEn: 'Food & Civil Supplies (Ration)',
    nameHi: 'खाद्य एवं नागरिक आपूर्ति (राशन)',
    description: 'Ration card issue, fair price shop irregularities, wheat/rice distribution'
  }
];

export const CATEGORIES: Category[] = [
  {
    id: 'cat-water-leak',
    code: 'WATER_SUPPLY_ISSUE',
    departmentId: 'dept-jal',
    nameEn: 'Water Supply Disruption / Pipeline Leak',
    nameHi: 'पेयजल आपूर्ति में बाधा / पाइपलाइन लीकेज',
    keywords: ['पानी', 'जल', 'water', 'leak', 'pipeline', 'tap', 'नल', 'पाइप', 'सप्लाई'],
    slaResponseHours: 24,
    slaResolutionHours: 72
  },
  {
    id: 'cat-road-damage',
    code: 'ROAD_POTHOLES',
    departmentId: 'dept-pwd',
    nameEn: 'Potholes / Broken Hill Roads',
    nameHi: 'सड़क में गड्ढे / टूटी पहाड़ी सड़कें',
    keywords: ['सड़क', 'गड्ढा', 'रोड', 'road', 'pothole', 'मार्ग', 'landslide', 'डामरीकरण'],
    slaResponseHours: 48,
    slaResolutionHours: 168
  },
  {
    id: 'cat-power-cut',
    code: 'POWER_OUTAGE',
    departmentId: 'dept-upcl',
    nameEn: 'Transformer Failure / Frequent Power Cuts',
    nameHi: 'ट्रांसफार्मर खराबी / अघोषित बिजली कटौती',
    keywords: ['बिजली', 'लाइट', 'power', 'electricity', 'transformer', 'ट्रांसफार्मर', 'करंट', 'पोल'],
    slaResponseHours: 12,
    slaResolutionHours: 48
  },
  {
    id: 'cat-land-mutation',
    code: 'LAND_RECORDS',
    departmentId: 'dept-rev',
    nameEn: 'Land Mutation / Patwari Delay',
    nameHi: 'दाखिल खारिज / पटवारी रिपोर्ट में देरी',
    keywords: ['दाखिल खारिज', 'जमीन', 'पटवारी', 'भूमि', 'खतौनी', 'mutation', 'land', 'तहसील'],
    slaResponseHours: 72,
    slaResolutionHours: 360
  },
  {
    id: 'cat-phc-doctor',
    code: 'HEALTH_FACILITY',
    departmentId: 'dept-health',
    nameEn: 'Doctor Absenteeism / Lack of Medicines',
    nameHi: 'अस्पताल में डॉक्टर की अनुपस्थिति / दवाओं का अभाव',
    keywords: ['अस्पताल', 'डॉक्टर', 'दवा', 'hospital', 'doctor', 'medicine', 'phc', 'chc', 'इलाज'],
    slaResponseHours: 12,
    slaResolutionHours: 48
  },
  {
    id: 'cat-drainage',
    code: 'VILLAGE_SANITATION',
    departmentId: 'dept-panch',
    nameEn: 'Village Drainage / Garbage Dumping',
    nameHi: 'गांव की नालियां / कूड़ा निस्तारण समस्या',
    keywords: ['नाली', 'कूड़ा', 'सफाई', 'drainage', 'garbage', 'ग्राम प्रधान', 'कीचड़'],
    slaResponseHours: 48,
    slaResolutionHours: 120
  },
  {
    id: 'cat-pension',
    code: 'PENSION_DELAY',
    departmentId: 'dept-soc',
    nameEn: 'Old-Age / Disability Pension Pending',
    nameHi: 'वृद्धावस्था / दिव्यांग पेंशन रुकी होना',
    keywords: ['पेंशन', 'pension', 'वृद्धावस्था', 'दिव्यांग', 'समाज कल्याण', 'पैसा नहीं आया'],
    slaResponseHours: 48,
    slaResolutionHours: 240
  },
  {
    id: 'cat-ration',
    code: 'RATION_SUPPLY',
    departmentId: 'dept-food',
    nameEn: 'Ration Shop Irregularity / Card Issue',
    nameHi: 'राशन डीलर की मनमानी / राशन कार्ड समस्या',
    keywords: ['राशन', 'कोटा', 'राशन कार्ड', 'ration', 'dealer', 'गेहूं', 'चावल'],
    slaResponseHours: 48,
    slaResolutionHours: 168
  }
];
