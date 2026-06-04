"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const label = value?.from
    ? value.to
      ? `${format(value.from, "LLL dd, y")} – ${format(value.to, "LLL dd, y")}`
      : format(value.from, "LLL dd, y")
    : "Pick a date range";

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring whitespace-nowrap"
      >
        <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span>{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[100]" align="end">
        <Calendar
          autoFocus
          mode="range"
          defaultMonth={value?.from}
          selected={value}
          onSelect={(r) => r && onChange(r)}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
