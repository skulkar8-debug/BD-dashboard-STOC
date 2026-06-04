// US state whitelist for parsing campaign names
// Any parsed state segment not in this set is treated as "Unmapped"

export const US_STATE_NAMES = new Set([
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  'District of Columbia', 'DC', 'National', 'Multi-State',
]);

export const US_STATE_ABBR = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]);

// Common multi-word and city/region references that should map to a state
const REGION_TO_STATE: Record<string, string> = {
  'New York City': 'New York',
  'NYC': 'New York',
  'Los Angeles County': 'California',
  'Orange County': 'California',
  'San Antonio': 'Texas',
  'Dallas': 'Texas',
  'Houston': 'Texas',
  'Austin': 'Texas',
  'Oklahoma City': 'Oklahoma',
  'Kansas City': 'Missouri',
  'Nashville': 'Tennessee',
  'Atlanta': 'Georgia',
  'Tampa': 'Florida',
  'Orlando': 'Florida',
  'Miami': 'Florida',
  'Chicago': 'Illinois',
  'Detroit': 'Michigan',
  'Cleveland': 'Ohio',
  'Columbus': 'Ohio',
  'Cincinnati': 'Ohio',
  'Pittsburgh': 'Pennsylvania',
  'Pittsburg': 'Pennsylvania',
  'Philadelphia': 'Pennsylvania',
  'Charlotte': 'North Carolina',
  'Denver': 'Colorado',
  'Seattle': 'Washington',
  'Phoenix': 'Arizona',
  'Minneapolis': 'Minnesota',
  'St. Louis': 'Missouri',
  'St Louis': 'Missouri',
  'Baltimore': 'Maryland',
  'Washington D.C': 'District of Columbia',
  'Washington DC': 'District of Columbia',
  'Washington D.C.': 'District of Columbia',
  'Michigen': 'Michigan', // typo in data
  // Multi-city strings → use first state
  'Cleveland, Cincinnati, Columbus': 'Ohio',
  'Columbus Cincinnatti': 'Ohio',
  'Charlotte/Raleigh/Greensboro': 'North Carolina',
  'Seattle/ Tacoma- Washington': 'Washington',
  'Florida (Small Markets)': 'Florida',
  'Georgia (Small Markets)': 'Georgia',
  'Ohio (Smaller Markets)': 'Ohio',
  'Georgia 2': 'Georgia',
  'California 2': 'California',
  'New York 2': 'New York',
  'New Jersey 2': 'New Jersey',
  'Illinois 2': 'Illinois',
  'Texas 2': 'Texas',
  'Virginia 2': 'Virginia',
  'Washington 2': 'Washington',
  'Oregon 2': 'Oregon',
  'Missouri 2': 'Missouri',
  'Arizona 2': 'Arizona',
  'Nevada 2': 'Nevada',
  'Tennessee 2': 'Tennessee',
  'Wisconsin 2': 'Wisconsin',
  'Minnesota 2': 'Minnesota',
  'Michigan 2': 'Michigan',
};

/** Normalize a raw parsed state segment into a valid US state name, or null if invalid */
export function normalizeState(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Direct hit
  if (US_STATE_NAMES.has(trimmed)) return trimmed;
  if (US_STATE_ABBR.has(trimmed.toUpperCase())) return trimmed.toUpperCase();

  // Region/city/variant alias
  const alias = REGION_TO_STATE[trimmed];
  if (alias) return alias;

  // Case-insensitive check against state names
  const lower = trimmed.toLowerCase();
  for (const s of US_STATE_NAMES) {
    if (s.toLowerCase() === lower) return s;
  }

  return null; // Not a valid state
}
