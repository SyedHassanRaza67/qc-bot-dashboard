import * as React from "react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
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

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<PresetKey>("all");
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const handlePresetClick = (preset: PresetKey) => {
    setSelectedPreset(preset);
    const today = new Date();
    
    switch (preset) {
      case "all":
        onDateRangeChange(undefined);
        setShowCalendar(false);
        setIsOpen(false);
        break;
      case "today":
        onDateRangeChange({ from: today, to: today });
        setShowCalendar(false);
        setIsOpen(false);
        break;
      case "yesterday":
        const yesterday = subDays(today, 1);
        onDateRangeChange({ from: yesterday, to: yesterday });
        setShowCalendar(false);
        setIsOpen(false);
        break;
      case "lastWeek":
        const lastWeekStart = startOfWeek(subWeeks(today, 1));
        const lastWeekEnd = endOfWeek(subWeeks(today, 1));
        onDateRangeChange({ from: lastWeekStart, to: lastWeekEnd });
        setShowCalendar(false);
        setIsOpen(false);
        break;
      case "lastMonth":
        const lastMonthStart = startOfMonth(subMonths(today, 1));
        const lastMonthEnd = endOfMonth(subMonths(today, 1));
        onDateRangeChange({ from: lastMonthStart, to: lastMonthEnd });
        setShowCalendar(false);
        setIsOpen(false);
        break;
      case "custom":
        setShowCalendar(true);
        break;
    }
  };

  const getButtonLabel = () => {
    if (selectedPreset === "custom" && dateRange?.from) {
      if (dateRange.to) {
        return `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd, yyyy")}`;
      }
      return format(dateRange.from, "MMM dd, yyyy");
    }
    return presets.find(p => p.key === selectedPreset)?.label || "All Time";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[180px] justify-between text-left font-normal rounded-xl",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>{getButtonLabel()}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col">
          {/* Preset Options */}
          <div className="p-2 border-b border-border">
            {presets.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handlePresetClick(preset.key)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                  selectedPreset === preset.key
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          
          {/* Calendar for Custom Range */}
          {showCalendar && (
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => {
                onDateRangeChange(range);
                if (range?.from && range?.to) {
                  setIsOpen(false);
                }
              }}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
