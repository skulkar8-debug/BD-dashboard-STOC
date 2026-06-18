import type { SectorMapping } from '@/lib/instantly/types';

// Manual sector mapping — takes priority over campaign name parsing.
// Priority: campaign_id > campaign_name_pattern (org-scoped first) > org-level default > name parse
export const CAMPAIGN_SECTOR_MAP: SectorMapping[] = [
  // ─── Org-level defaults ────────────────────────────────────────────────────
  { org: 'embark',    sector: 'Veterinary / Pet Services' },
  { org: 'sun_auto',  sector: 'Auto Services' },
  { org: 'aeg_vision',sector: 'Vision / Optometry' },
  { org: 'corvia',    sector: 'MedSpa' },
  { org: 'mclerran',  sector: 'Dental' },

  // ─── Branta Partners — mixed portfolio ────────────────────────────────────
  { org: 'branta', campaign_name_pattern: 'Landscape',           sector: 'Landscaping' },
  { org: 'branta', campaign_name_pattern: 'Pet',                 sector: 'Veterinary / Pet Services' },
  { org: 'branta', campaign_name_pattern: 'Embark',              sector: 'Veterinary / Pet Services' },
  { org: 'branta', campaign_name_pattern: 'Roofing',             sector: 'Roofing / Claims' },
  { org: 'branta', campaign_name_pattern: 'MedSpa',              sector: 'MedSpa' },
  { org: 'branta', campaign_name_pattern: 'Medspa',              sector: 'MedSpa' },
  { org: 'branta', campaign_name_pattern: 'Dental',              sector: 'Dental' },
  { org: 'branta', campaign_name_pattern: 'Vision',              sector: 'Vision / Optometry' },
  { org: 'branta', campaign_name_pattern: 'Auto',                sector: 'Auto Services' },
  { org: 'branta', campaign_name_pattern: 'Funeral',             sector: 'Funeral Home' },
  { org: 'branta', campaign_name_pattern: 'Physical Therapy',    sector: 'Healthcare Services' },
  { org: 'branta', campaign_name_pattern: 'Pest',                sector: 'Multi-Site Consumer Services' },
  { org: 'branta', campaign_name_pattern: 'Asphalt',             sector: 'Roofing / Claims' },

  // ─── My Organization — mixed portfolio ────────────────────────────────────
  { org: 'my_org', campaign_name_pattern: 'Auto-Tires',          sector: 'Auto Services' },
  { org: 'my_org', campaign_name_pattern: 'Auto',                sector: 'Auto Services' },
  { org: 'my_org', campaign_name_pattern: 'Landscape',           sector: 'Landscaping' },
  { org: 'my_org', campaign_name_pattern: 'Dental',              sector: 'Dental' },
  { org: 'my_org', campaign_name_pattern: 'Archway',             sector: 'Dental' },
  { org: 'my_org', campaign_name_pattern: 'Medspa',              sector: 'MedSpa' },
  { org: 'my_org', campaign_name_pattern: 'MedSpa',              sector: 'MedSpa' },
  { org: 'my_org', campaign_name_pattern: 'Koniver',             sector: 'MedSpa' },
  { org: 'my_org', campaign_name_pattern: 'Vision',              sector: 'Vision / Optometry' },
  { org: 'my_org', campaign_name_pattern: 'AEG',                 sector: 'Vision / Optometry' },
  { org: 'my_org', campaign_name_pattern: 'Vet',                 sector: 'Veterinary / Pet Services' },
  { org: 'my_org', campaign_name_pattern: 'Pet',                 sector: 'Veterinary / Pet Services' },
  { org: 'my_org', campaign_name_pattern: 'Roofing',             sector: 'Roofing / Claims' },
  { org: 'my_org', campaign_name_pattern: 'Asphalt',             sector: 'Roofing / Claims' },
  { org: 'my_org', campaign_name_pattern: 'Funeral',             sector: 'Funeral Home' },
  { org: 'my_org', campaign_name_pattern: 'Physical Therapy',    sector: 'Healthcare Services' },
  { org: 'my_org', campaign_name_pattern: 'Pest',                sector: 'Multi-Site Consumer Services' },
  { org: 'my_org', campaign_name_pattern: 'Sun Auto',            sector: 'Auto Services' },
  // GES, DealMAX, PortCos → Financial/Professional Services
  { org: 'my_org', campaign_name_pattern: 'GES',                 sector: 'Financial / Professional Services' },
  { org: 'my_org', campaign_name_pattern: 'DealMAX',             sector: 'Financial / Professional Services' },
  { org: 'my_org', campaign_name_pattern: 'PortCo',              sector: 'Financial / Professional Services' },
  // Global catch-alls for any org
  { campaign_name_pattern: 'GES',                                sector: 'Financial / Professional Services' },
  { campaign_name_pattern: 'DealMAX',                            sector: 'Financial / Professional Services' },
  { campaign_name_pattern: 'PortCo',                             sector: 'Financial / Professional Services' },
  { campaign_name_pattern: 'Funeral',                            sector: 'Funeral Home' },
  { campaign_name_pattern: 'Physical Therapy',                   sector: 'Healthcare Services' },
  { campaign_name_pattern: 'Pest Control',                       sector: 'Multi-Site Consumer Services' },
  { campaign_name_pattern: 'Asphalt',                            sector: 'Roofing / Claims' },
  // Towing Service — including common misspellings in campaign names
  { campaign_name_pattern: 'Towing',                             sector: 'Towing Service' },
  { campaign_name_pattern: 'Tow Service',                        sector: 'Towing Service' },
  { campaign_name_pattern: 'Tow Svc',                            sector: 'Towing Service' },
  { campaign_name_pattern: 'Toing',                              sector: 'Towing Service' }, // misspell
  { campaign_name_pattern: 'Towng',                              sector: 'Towing Service' }, // misspell
  { campaign_name_pattern: 'Towring',                            sector: 'Towing Service' }, // misspell
  { campaign_name_pattern: 'Tow Co',                             sector: 'Towing Service' },
  { campaign_name_pattern: 'Auto Tow',                           sector: 'Towing Service' },
  { campaign_name_pattern: 'Road Service',                       sector: 'Towing Service' },
  // Marina
  { campaign_name_pattern: 'Marina',                             sector: 'Marina' },
];

export const SECTOR_OPTIONS = [
  'Auto Services',
  'Vision / Optometry',
  'Veterinary / Pet Services',
  'Dental',
  'MedSpa',
  'Landscaping',
  'Roofing / Claims',
  'Environmental / Waste / Recycling',
  'Healthcare Services',
  'Funeral Home',
  'Physical Therapy',
  'Pest Control',
  'Towing Service',
  'Manufacturing',
  'Multi-Site Consumer Services',
  'Financial / Professional Services',
  'Marina',
  'Other / Unmapped',
];

// Known canonical sector names — fallback parser only accepts these
export const KNOWN_SECTORS = new Set(SECTOR_OPTIONS);
