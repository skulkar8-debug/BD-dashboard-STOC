import React from 'react';

const COLOR_MAP: Record<string, string> = {
  // Classification colors
  'Positive / Interested': 'bg-emerald-100 text-emerald-800',
  'Meeting Requested': 'bg-green-100 text-green-800',
  'Referral / Correct Contact Given': 'bg-teal-100 text-teal-800',
  'More Info Requested': 'bg-sky-100 text-sky-800',
  'Neutral / Needs Review': 'bg-gray-100 text-gray-600',
  'Not Interested': 'bg-red-100 text-red-700',
  'Out of Office': 'bg-amber-100 text-amber-700',
  'Unsubscribe': 'bg-orange-100 text-orange-700',
  'Negative / Complaint': 'bg-red-200 text-red-800',
  'Auto Reply': 'bg-gray-100 text-gray-500',
  // Campaign statuses
  Active: 'bg-emerald-100 text-emerald-800',
  Paused: 'bg-amber-100 text-amber-700',
  Completed: 'bg-gray-100 text-gray-600',
  Draft: 'bg-blue-100 text-blue-700',
  Stopped: 'bg-red-100 text-red-700',
  // Recommended actions
  'Follow Up': 'bg-green-100 text-green-800',
  Continue: 'bg-emerald-100 text-emerald-800',
  'Pause / Review': 'bg-red-100 text-red-700',
  Review: 'bg-amber-100 text-amber-700',
  Monitor: 'bg-gray-100 text-gray-600',
  'No data': 'bg-gray-50 text-gray-400',
};

export function StatusBadge({ value }: { value: string }) {
  const cls = COLOR_MAP[value] ?? 'bg-gray-100 text-gray-600';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {value}
    </span>
  );
}
