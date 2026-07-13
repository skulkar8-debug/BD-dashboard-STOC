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
// Priority order (first match wins):
//   Bounce → Auto-reply → OOO → Unsubscribe → NOT_INTERESTED
//   → Meeting → Referral → More Info → Positive → Neutral

// Delivery failures / mailer-daemon — check FIRST (distinctive headers)
const BOUNCE_PATTERNS = [
  /mailer.daemon/i,
  /postmaster@/i,
  /delivery (status notification|failed|failure|report)/i,
  /mail delivery (failed|subsystem|error)/i,
  /\bundeliverable\b/i,
  /message not delivered/i,
  /delivery has failed/i,
  /failed to deliver/i,
  /this is an automatically generated deliver/i,
  /permanent (error|failure).*user (unknown|not found)/i,
  /550.*(no such user|user unknown|mailbox not found)/i,
  /\baddress not found\b/i,
  /\bemail address.*does not exist\b/i,
  /\bno such (user|address|account)\b/i,
  /\binvalid (email|address|mailbox)\b/i,
  /recipient address rejected/i,
];

// System / automated replies — not a human, not OOO
const AUTO_REPLY_PATTERNS = [
  /inbox (is )?not monitored/i,
  /mailbox (is )?not monitored/i,
  /(this |the )?(email|mailbox|address|email address) is not monitored/i,
  /please do not (reply|respond) to this (email|message|address)/i,
  /do not (reply|respond) to this (email|message|address|notification)/i,
  /this (is |was )?an? (automated|automatic|system) (email|message|notification|response)/i,
  /unusual (level|volume|amount) of (activity|email|emails|messages)/i,
  // Security / challenge responses
  /\bchallenge.response\b/i,
  /(this is a )?(security |email )?(challenge|verification) (email|message|response)/i,
  /verify (you are|that you are|your email|your identity)/i,
  /confirm (you are|that you are|your identity|your humanity)/i,
  /prove (you are|that you are) (human|a person)/i,
  // "No longer with the company" — not a personal not-interested
  /no longer (with|at) (the company|our company|this (company|organization|org|firm))/i,
  /has left (the company|our (company|organization|team|firm))/i,
  /no longer (an employee|employed here|works here)/i,
  /(has|have) (left|departed) (the company|our (company|organization|team))/i,
  /this (person|employee|individual) is no longer/i,
  // Generic "this email is no longer active/valid"
  /this (email|address) is no longer (valid|active|in use|monitored)/i,
  /email address is (inactive|no longer active|no longer valid)/i,
];

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
  // "Remove from list" / "remove us from this list" / "remove [X] from your marketing"
  /\bremove\b.{0,80}\bfrom\b.{0,30}\b(list|email list|mailing list|marketing|database|emails?)\b/i,
  // "removed from your/this/the list"
  /\bremoved\b.{0,30}\bfrom\b.{0,30}\b(list|email list|mailing list|marketing|database|emails?)\b/i,
  // "contact info to be removed" / "to be removed"
  /\bto be removed\b/i,
  // "I'd like my contact info / email address removed"
  /\b(contact|email) (info|information|address|details).{0,50}\bremov/i,
  // "please don't contact me again" / "please don't reach out"
  /please don'?t (contact|email|reach out|send)/i,
  /don'?t (contact|email|reach out to) (me|us) (again|anymore|further)/i,
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
  // Formal scheduling language
  /\bschedule (a )?(call|meeting|time|chat)\b/i,
  /\bbook (a )?(meeting|call|time|appointment)\b/i,
  /\bset up (a )?(time|call|meeting|chat)\b/i,
  /\bschedule (a )?(time|meeting)\b/i,
  /calendly/i,
  // "Let's" / "happy to" connect
  /let'?s (chat|talk|connect|speak|meet|hop on)/i,
  /happy to (connect|chat|discuss|hop on|jump on|talk|speak)/i,
  /open to (a call|a chat|chatting|talking|connecting|meeting)/i,
  /could (we|you and I) (meet|talk|chat|speak|connect)/i,
  // "Are you free / available" — casual proposals
  /\bare you free\b/i,
  /\bwhen are you (free|available|open)\b/i,
  /\bi'?m (available|free|open)\b.*\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(:\d{2})?\s*(am|pm))/i,
  /\bavailable (anytime|next|this|monday|tuesday|wednesday|thursday|friday)/i,
  // "Does X time work?" patterns
  /\bdoes\s+\d{1,2}(:\d{2})?\s*(am|pm)?\s*work\b/i,
  /\bis\s+\d{1,2}(:\d{2})?\s*(am|pm)?\s*(good|ok|fine|work)\b/i,
  /\bwhat (time|day) works\b/i,
  /\bwhat'?s (a good time|your availability)\b/i,
  // Rescheduling / "Can we push/move"
  /\bcan we (push|move|reschedule|shift|change)\b/i,
  /\bpush (it|the call|the meeting) to\b/i,
  // "I can chat/talk on X day"
  /\bi can (chat|talk|connect|speak|hop on)\b/i,
  /\bi'?m (good|available|free) (on|for|this|next)\b/i,
  // Phone numbers and call-back requests
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,          // 818-518-4582
  /\bbest (number|phone|cell|line|way) (to reach|to contact|is)\b/i,
  /\breach me (at|on)\s*[\d(]/i,
  /give me a call/i,
  /call me (at|on|back)/i,
  /\bmy (number|cell|phone) is\b/i,
  // "Available at X time" blocks
  /\b\d{1,2}(:\d{2})?\s*(am|pm)\s*(to|-|–)\s*\d{1,2}(:\d{2})?\s*(am|pm)/i,  // "11am to 2pm"
  // General availability / response
  /available (to speak|for a call|to connect|this week|next week)/i,
  /when (is a good time|would work|works for you)/i,
  /free (for a call|to (chat|talk|connect))/i,
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

  // System/automated detection first — these are never human replies
  if (match(text, BOUNCE_PATTERNS))        return 'bounce';
  if (match(text, AUTO_REPLY_PATTERNS))    return 'auto_reply';
  if (match(text, OOO_PATTERNS))           return 'out_of_office';
  if (match(text, UNSUBSCRIBE_PATTERNS))   return 'unsubscribe';
  // NOT interested BEFORE positive — avoids "not interested" matching positive patterns
  if (match(text, NOT_INTERESTED_PATTERNS)) return 'not_interested';
  if (match(text, MEETING_PATTERNS))       return 'meeting_requested';
  if (match(text, REFERRAL_PATTERNS))      return 'referral_given';
  if (match(text, MORE_INFO_PATTERNS))     return 'more_info_requested';
  if (match(text, POSITIVE_PATTERNS))      return 'positive_interested';

  return 'neutral_needs_review';
}

export function classifyEmail(email: InstantlyEmail): ReplyClassification {
  const bodyText = email.body?.text ?? email.content_preview ?? '';
  const textClass = classifyFromText(bodyText);

  // Automated/system signals always take precedence — these are never human intent
  if (textClass === 'bounce')        return 'bounce';
  if (textClass === 'auto_reply')    return 'auto_reply';
  if (textClass === 'out_of_office') return 'out_of_office';
  if (textClass === 'unsubscribe')   return 'unsubscribe';

  // Trust Instantly's i_status as the primary positive/negative signal
  // i_status 1 = Instantly marked interested, -1 = not interested, 0/null = not set
  if (email.i_status === 1) {
    if (textClass === 'not_interested')      return 'not_interested'; // explicit opt-out overrides
    if (textClass === 'meeting_requested')   return 'meeting_requested';
    if (textClass === 'referral_given')      return 'referral_given';
    if (textClass === 'more_info_requested') return 'more_info_requested';
    return 'positive_interested';
  }
  if (email.i_status === -1) return 'not_interested';

  // Trust Instantly's AI interest value as secondary signal
  // >= 1 = positive interest, -1 = negative, 0/null = no signal
  if (email.ai_interest_value != null && email.ai_interest_value >= 1) {
    if (textClass === 'not_interested')      return 'not_interested';
    if (textClass === 'meeting_requested')   return 'meeting_requested';
    if (textClass === 'referral_given')      return 'referral_given';
    if (textClass === 'more_info_requested') return 'more_info_requested';
    return 'positive_interested';
  }
  if (email.ai_interest_value === -1) return 'not_interested';

  // No Instantly signal set — fall back to text classification
  return textClass;
}

export function isPositive(classification: ReplyClassification): boolean {
  return POSITIVE_CLASSIFICATIONS.includes(classification);
}
