/**
 * Canonical 17-step workflow event definitions.
 * All timing is relative to Report Publish Date (offset 0).
 * Mapped directly from Workflow Template tab in the Google Sheet.
 */

export interface WorkflowEvent {
  key:     string
  wfSteps: string          // e.g. "WF09–10" — used in tooltips only
  phase:   string
  label:   string          // clean display label (no WF prefix)
  bg:      string
  border:  string
  text:    string
  sOff:    number          // start day offset from publish date
  eOff:    number          // end day offset (inclusive)
  owners:  OwnerRole[]     // which sector role gets this block
}

export type OwnerRole = 'mr' | 'mrsupport' | 'bd' | 'sm' | 'mp'

export const ROLE_LABELS: Record<OwnerRole, string> = {
  mr:        'Market Research',
  mrsupport: 'MR Support',
  bd:        'BD',
  sm:        'Senior Manager',
  mp:        'MP',
}

export const WORKFLOW_EVENTS: WorkflowEvent[] = [
  { key: 'dataprep',   wfSteps: 'WF01–08', phase: 'Research/Data', label: 'Data Prep',         bg: '#e0e7ff', border: '#6366f1', text: '#3730a3', sOff: -35, eOff: -22, owners: ['mrsupport'] },
  { key: 'mrresearch', wfSteps: 'WF01–08', phase: 'Research/Data', label: 'Sector Research',    bg: '#ddd6fe', border: '#7c3aed', text: '#4c1d95', sOff: -35, eOff: -22, owners: ['mr']         },
  { key: 'build',      wfSteps: 'WF09–10', phase: 'Report',        label: 'Build & QA Report',  bg: '#c7d2fe', border: '#818cf8', text: '#3730a3', sOff: -21, eOff: -1,  owners: ['mr']         },
  { key: 'connect',    wfSteps: 'WF11',    phase: 'Outreach',      label: 'LinkedIn Outreach',  bg: '#bfdbfe', border: '#3b82f6', text: '#1e3a8a', sOff: -14, eOff: -1,  owners: ['bd']         },
  { key: 'connectsm',  wfSteps: 'WF11',    phase: 'Outreach',      label: 'Connection Support', bg: '#ccfbf1', border: '#14b8a6', text: '#134e4a', sOff: -14, eOff: -1,  owners: ['sm']         },
  { key: 'publish',    wfSteps: 'WF12',    phase: 'Report',        label: 'Publish Report',     bg: '#bbf7d0', border: '#22c55e', text: '#14532d', sOff:  0,  eOff:  0,  owners: ['mr']         },
  { key: 'sendreport', wfSteps: 'WF13',    phase: 'Outreach',      label: 'Send Report',        bg: '#99f6e4', border: '#0d9488', text: '#134e4a', sOff:  0,  eOff:  1,  owners: ['bd']         },
  { key: 'tipcreate',  wfSteps: 'WF14',    phase: 'TIP',           label: 'Create TIP',         bg: '#fed7aa', border: '#f97316', text: '#7c2d12', sOff:  1,  eOff:  2,  owners: ['mr']         },
  { key: 'tipsend',    wfSteps: 'WF15',    phase: 'TIP',           label: 'Send TIP',           bg: '#e9d5ff', border: '#a855f7', text: '#4c1d95', sOff:  5,  eOff:  5,  owners: ['bd', 'sm']   },
  { key: 'followup',   wfSteps: 'WF16',    phase: 'Calls/Intel',   label: 'Calls & Intel',      bg: '#fef08a', border: '#eab308', text: '#713f12', sOff:  8,  eOff: 14,  owners: ['bd']         },
  { key: 'mpcall',     wfSteps: 'WF17',    phase: 'Calls/Intel',   label: 'MP Follow-on',       bg: '#fce7f3', border: '#ec4899', text: '#831843', sOff: 15,  eOff: 21,  owners: ['mp']         },
]

// Quick lookup by event key (available for future use)
export const WF_BY_KEY = Object.fromEntries(WORKFLOW_EVENTS.map(e => [e.key, e]))
