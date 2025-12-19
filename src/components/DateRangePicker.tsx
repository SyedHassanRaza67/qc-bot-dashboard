import * as React from "react";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

type PresetKey = "all" | "today" | "yesterday" | "lastWeek" | "lastMonth" | "custom";

const presets: { key: PresetKey; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "lastWeek", label: "Last Week" },
  { key: "lastMonth", label: "Last Month" },
  { key: "custom", label: "Custom" },
];

const getPresetRange = (key: PresetKey): DateRange | undefined => {
  const now = new Date();
  switch (key) {
    case "all":
      return undefined;
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    case "lastWeek":
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return { from: lastWeekStart, to: lastWeekEnd };
    case "lastMonth":
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      return { from: lastMonthStart, to: lastMonthEnd };
    default:
      return undefined;
  }
};

const detectPreset = (range: DateRange | undefined): PresetKey => {
  if (!range?.from) return "all";
  
  const now = new Date();
  const fromStr = format(range.from, "yyyy-MM-dd");
  const toStr = range.to ? format(range.to, "yyyy-MM-dd") : fromStr;
  
  // Check Today
  const todayRange = getPresetRange("today");
  if (todayRange && format(todayRange.from!, "yyyy-MM-dd") === fromStr && 
      format(todayRange.to!, "yyyy-MM-dd") === toStr) {
    return "today";
  }
  
  // Check Yesterday
  const yesterdayRange = getPresetRange("yesterday");
  if (yesterdayRange && format(yesterdayRange.from!, "yyyy-MM-dd") === fromStr && 
      format(yesterdayRange.to!, "yyyy-MM-dd") === toStr) {
    return "yesterday";
  }
  
  // Check Last Week
  const lastWeekRange = getPresetRange("lastWeek");
  if (lastWeekRange && format(lastWeekRange.from!, "yyyy-MM-dd") === fromStr && 
      format(lastWeekRange.to!, "yyyy-MM-dd") === toStr) {
    return "lastWeek";
  }
  
  // Check Last Month
  const lastMonthRange = getPresetRange("lastMonth");
  if (lastMonthRange && format(lastMonthRange.from!, "yyyy-MM-dd") === fromStr && 
      format(lastMonthRange.to!, "yyyy-MM-dd") === toStr) {
    return "lastMonth";
  }
  
  return "custom";
};

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  
  const activePreset = detectPreset(dateRange);

  const handlePresetClick = (key: PresetKey) => {
    if (key === "custom") {
      setShowCalendar(true);
    } else {
      setShowCalendar(false);
      onDateRangeChange(getPresetRange(key));
      setOpen(false);
    }
  };

  const getDisplayLabel = () => {
    if (!dateRange?.from) return "All Time";
    if (activePreset !== "custom") {
      return presets.find(p => p.key === activePreset)?.label || "All Time";
    }
    if (dateRange.to) {
      return `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd, yyyy")}`;
    }
    return format(dateRange.from, "MMM dd, yyyy");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[200px] justify-between text-left font-normal rounded-xl",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>{getDisplayLabel()}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r border-border p-2 space-y-1 min-w-[120px]">
            {presets.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handlePresetClick(preset.key)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                  (activePreset === preset.key || (preset.key === "custom" && showCalendar))
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          
          {/* Calendar (shown when Custom is selected) */}
          {showCalendar && (
            <div className="p-3">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  onDateRangeChange(range);
                }}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
