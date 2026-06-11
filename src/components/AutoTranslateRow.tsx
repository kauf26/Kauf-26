import React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type AutoTranslateRowProps = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  labelClassName?: string;
};

/** Matches mobile IdentifyScreen auto-translate row (label left, switch right, green/red colors). */
export function AutoTranslateRow({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  label = "Auto-translate listings",
  labelClassName,
}: AutoTranslateRowProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between gap-3 min-h-[48px]",
        className
      )}
    >
      <span
        className={cn(
          "flex-1 text-[15px] font-semibold text-[#1F2937]",
          labelClassName
        )}
      >
        {label}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "h-7 w-12 shrink-0 border-0 shadow-none data-[state=unchecked]:bg-[#FCA5A5]",
          checked ? "data-[state=checked]:bg-[#86EFAC]" : "data-[state=unchecked]:bg-[#FCA5A5]"
        )}
        thumbClassName={cn(
          "h-6 w-6 data-[state=checked]:translate-x-5",
          checked ? "bg-[#22C55E]" : "bg-[#EF4444]"
        )}
      />
    </div>
  );
}
