import type { OrgConfig } from './types';

// IMPORTANT: Use raw env values as Bearer token — do not decode, do not split
export const ORGS: OrgConfig[] = [
  {
    id: 'my_org',
    label: 'My Organization',
    envKey: 'INSTANTLY_MY_ORG_API_KEY',
    apiKey: process.env.INSTANTLY_MY_ORG_API_KEY?.trim(),
    enabled: !!process.env.INSTANTLY_MY_ORG_API_KEY,
  },
  {
    id: 'embark',
    label: 'Embark Pet Services',
    envKey: 'INSTANTLY_EMBARK_API_KEY',
    apiKey: process.env.INSTANTLY_EMBARK_API_KEY?.trim(),
    enabled: !!process.env.INSTANTLY_EMBARK_API_KEY,
  },
  {
    id: 'sun_auto',
    label: 'Sun Auto',
    envKey: 'INSTANTLY_SUN_AUTO_API_KEY',
    apiKey: process.env.INSTANTLY_SUN_AUTO_API_KEY?.trim(),
    enabled: !!process.env.INSTANTLY_SUN_AUTO_API_KEY,
  },
  {
    id: 'aeg_vision',
    label: 'AEG Vision',
    envKey: 'INSTANTLY_AEG_VISION_API_KEY',
    apiKey: process.env.INSTANTLY_AEG_VISION_API_KEY?.trim(),
    enabled: !!process.env.INSTANTLY_AEG_VISION_API_KEY,
  },
  {
    id: 'mclerran',
    label: 'McLerran',
    envKey: 'INSTANTLY_MCLERRAN_API_KEY',
    apiKey: process.env.INSTANTLY_MCLERRAN_API_KEY?.trim(),
    enabled: !!process.env.INSTANTLY_MCLERRAN_API_KEY,
  },
  {
    id: 'branta',
    label: 'Branta Partners',
    envKey: 'INSTANTLY_BRANTA_API_KEY',
    apiKey: process.env.INSTANTLY_BRANTA_API_KEY?.trim(),
    enabled: !!process.env.INSTANTLY_BRANTA_API_KEY,
  },
  {
    id: 'corvia',
    label: 'Corvia Capital',
    envKey: 'INSTANTLY_CORVIA_API_KEY',
    apiKey: process.env.INSTANTLY_CORVIA_API_KEY?.trim(),
    enabled: !!process.env.INSTANTLY_CORVIA_API_KEY,
  },
];

export function getEnabledOrgs(): OrgConfig[] {
  return ORGS.filter((o) => o.enabled && o.apiKey);
}

export function getOrgById(id: string): OrgConfig | undefined {
  return ORGS.find((o) => o.id === id);
}
