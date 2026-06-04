import type { InstantlyEmail, ReplyClassification } from './types';
import { POSITIVE_CLASSIFICATIONS } from './types';

// ─── Strip quoted/threaded content ───────────────────────────────────────────
// Email body.text includes the full thread. We only want to classify the
// actual reply — everything after a quote marker is the original outreach
// and will produce false positives (e.g. "give me a call" in our own email).

function stripQuotedContent(text: string): string {
  if (!text) return '';

  // Common patterns that mark the start of quoted/original content
  const quoteMarkers = [
    // "On Mon, Apr 14 2026, Name <email> wrote:"
    /\nOn .{10,100}wrote:\s*\n/i,
    // "> quoted line" (standard email quoting)
    /\n>+ /,
    // "-----Original Message-----" or "--- Original Message ---"
    /\n-{3,}.*original.*message.*-{3,}/i,
    // "From: "Name" <email>" or "From: email@domain.com"
    /\nFrom:\s+["\w]/i,
    // "________________________________" separator
    /\n_{5,}/,
    // "[Name] wrote:" on its own line
    /\n.{2,50} wrote:\s*\n/,
  ];

  let earliest = text.length;
  for (const marker of quoteMarkers) {
    const match = marker.exec(text);
    if (match && match.index > 0 && match.index < earliest) {
      earliest = match.index;
    }
  }

  return text.slice(0, earliest).trim();
}

// ─── Pattern sets ─────────────────────────────────────────────────────────────
// Order: OOO → Unsubscribe → NOT_INTERESTED → Meeting → Referral → More Info → Positive → Neutral

const OOO_PATTERNS = [
  /out of office/i,
  /on vacation/i,
  /on (annual |parental |maternity |paternity )?leave/i,
  /away from (the )?office/i,
  /will (be back|return) on/i,
  /automatic(ally)? reply/i,
  /auto.?reply/i,
  /i am currently (out|away|unavailable)/i,
  /returning (on|the week of)/i,
];

const UNSUBSCRIBE_PATTERNS = [
  /please (remove|unsubscribe|take me off)/i,
  /\bunsubscribe\b/i,
  /\bopt.?out\b/i,
  /stop (emailing|contacting|reaching out|sending)/i,
  /do not (contact|email|reach out to) (me|us) again/i,
  /remove (me|us) from your (list|database)/i,
  /no more emails/i,
  /off your (list|mailing list)/i,
  // Short "stop" commands — "No. Stop" / "Stop." / "Please stop."
  /^(no[.,]?\s+)?stop[.,]?\s*$/im,
  /^stop (this|it|now|please)[.,]?\s*$/im,
  /\bstop (this|it|now)\b/i,
];

// IMPORTANT: Check NOT interested BEFORE positive to avoid false positives
const NOT_INTERESTED_PATTERNS = [
  /not (interested|looking|selling|ready)/i,
  /no (interest|thanks|thank you)/i,
  /not (a fit|right for us|for us|for me)/i,
  /not (in a position|considering|exploring)/i,
  /happy with (what we have|our current|our existing)/i,
  /not (open to|thinking about|planning)/i,
  /recently (sold|sold it|closed)/i,
  /already (sold|have a buyer|under contract|in process)/i,
  /not (available|for sale|on the market)/i,
  /wrong (person|number|email|contact)/i,
  /not the (right|best) person/i,
  /don't (own|have|operate)/i,
  /no longer (own|operate|have)/i,
  /retired/i,
  /closed (down|the business|permanently)/i,
  /passed away/i,
];

const MEETING_PATTERNS = [
  /\bschedule (a )?call\b/i,
  /\bbook (a )?(meeting|call|time|appointment)\b/i,
  /\bset up (a )?(time|call|meeting)\b/i,
  /let'?s (chat|talk|connect|speak|meet)/i,
  /happy to (connect|chat|discuss|hop on)/i,
  /available (to speak|for a call|to connect|this week)/i,
  /when (are you|is a good time|would work)/i,
  /what (time|day) works/i,
  /free (for a call|to (chat|talk|connect))/i,
  /could (we|you and I) (meet|talk|chat|speak|connect)/i,
  /open to (a call|a chat|chatting|talking|connecting|meeting)/i,
  /calendly/i,
  /\bschedule (a )?(time|meeting)\b/i,
  /give me a call/i,
  /call me (at|on)/i,
  /reach me (at|on)/i,
];

const REFERRAL_PATTERNS = [
  /you (should|may want to|might want to) (talk|contact|reach out to|speak with)/i,
  /better (person|contact|one to talk to)/i,
  /right (person|contact|one)/i,
  /our (owner|ceo|president|gm|general manager|partner|principal|managing|director)/i,
  /please (contact|reach out to|talk to|speak with)/i,
  /forwarding (this|your email|your message)/i,
  /cc'?ing (them|our|the)/i,
  /copying (them|our|the)/i,
  /i (sold|sold the business|sold it) (last year|recently|in \d{4})/i,
  /we (sold|sold the business) (last year|recently|in \d{4})/i,
  /sold (last year|recently|in \d{4})/i,
  /i already (sold|exited|left)/i,
];

const MORE_INFO_PATTERNS = [
  /tell me more/i,
  /more (information|info|details)/i,
  /send (me|us) (more|details|info|the details|information)/i,
  /what (exactly|specifically) (is|does|are) this/i,
  /can you (explain|clarify|elaborate|share more)/i,
  /how does (this|the process|it) work/i,
  /what would (this|that|the process) look like/i,
  /curious (about|to (hear|learn|know))/i,
  /interested in (learning|hearing|knowing) more/i,
  /could you (share|send|provide) (more|details|info)/i,
  /what is (the|your) process/i,
  /how (do you|does this|would this) work/i,
  /what does (that|this) involve/i,
];

const POSITIVE_PATTERNS = [
  /\bopen to (exploring|a conversation|discussing|the idea|selling|an offer|it)\b/i,
  /\bwould (consider|be open|be interested|be willing)\b/i,
  /\b(actively |been |have been )?(looking|thinking|considering|exploring) (to |a )?(sell|exit|retire|transition|sale|an offer)\b/i,
  /\bgood timing\b/i,
  /\bactually (been thinking|considering)\b/i,
  /sounds (interesting|good|great|promising)/i,
  /\b(this|that) (sounds|seems) (interesting|relevant|timely|worth)/i,
  /\b(might|may|could) be (interested|worth|a fit)\b/i,
  /yes,? (I'm|I am|we are|we're) (interested|open|considering)/i,
  /I'?d (like|love|be happy|be willing) to (learn|hear|discuss|explore)/i,
  /I'?m (interested|open|curious|intrigued)/i,
  /we'?re (interested|open|considering|exploring)/i,
  /\b(please|can you) (share|send|provide|tell me about) (your|the|more) (details|info|offer|valuation|process)\b/i,
];

function match(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// Classify only the reply portion (quoted content stripped)
function classifyFromText(rawText: string): ReplyClassification {
  const text = stripQuotedContent(rawText);
  if (!text || text.trim().length < 3) return 'neutral_needs_review';

  if (match(text, OOO_PATTERNS))          return 'out_of_office';
  if (match(text, UNSUBSCRIBE_PATTERNS))  return 'unsubscribe';
  // NOT interested BEFORE positive — avoids "not interested" matching positive patterns
  if (match(text, NOT_INTERESTED_PATTERNS)) return 'not_interested';
  if (match(text, MEETING_PATTERNS))      return 'meeting_requested';
  if (match(text, REFERRAL_PATTERNS))     return 'referral_given';
  if (match(text, MORE_INFO_PATTERNS))    return 'more_info_requested';
  if (match(text, POSITIVE_PATTERNS))     return 'positive_interested';

  return 'neutral_needs_review';
}

export function classifyEmail(email: InstantlyEmail): ReplyClassification {
  const bodyText = email.body?.text ?? email.content_preview ?? '';
  const textClass = classifyFromText(bodyText);

  // Instantly's AI value:
  //   >= 2 = clearly positive
  //    1   = mild interest / borderline
  //    0   = neutral
  //   -1   = negative
  if (email.ai_interest_value != null) {

    if (email.ai_interest_value >= 2) {
      // AI says positive — but text overrides for clear negatives
      if (textClass === 'out_of_office')    return 'out_of_office';
      if (textClass === 'unsubscribe')      return 'unsubscribe';
      if (textClass === 'not_interested')   return 'not_interested';
      if (textClass === 'meeting_requested') return 'meeting_requested';
      if (textClass === 'referral_given')   return 'referral_given';
      if (textClass === 'more_info_requested') return 'more_info_requested';
      return 'positive_interested';
    }

    if (email.ai_interest_value === 1) {
      // Mild AI interest — only upgrade if text confirms a clear positive signal
      if (textClass === 'out_of_office')    return 'out_of_office';
      if (textClass === 'unsubscribe')      return 'unsubscribe';
      if (textClass === 'not_interested')   return 'not_interested';
      if (textClass === 'meeting_requested') return 'meeting_requested';
      if (textClass === 'referral_given')   return 'referral_given';
      if (textClass === 'more_info_requested') return 'more_info_requested';
      if (textClass === 'positive_interested') return 'positive_interested';
      return 'neutral_needs_review';
    }

    if (email.ai_interest_value === -1) {
      // Instantly says NEGATIVE — only override for genuine referrals or OOO.
      // NEVER override to meeting_requested: if AI says -1, it's not a meeting.
      if (textClass === 'referral_given')  return 'referral_given';
      if (textClass === 'out_of_office')   return 'out_of_office';
      if (textClass === 'unsubscribe')     return 'unsubscribe';
      return 'not_interested';
    }

    // ai_interest_value === 0 — fall through to text classification
  }

  return textClass;
}

export function isPositive(classification: ReplyClassification): boolean {
  return POSITIVE_CLASSIFICATIONS.includes(classification);
}
