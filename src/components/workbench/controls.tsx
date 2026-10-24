import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Label } from "#/components/ui/label";
export type Choice = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
  reason?: string;
};
export function ChoiceSelect({
  id,
  label,
  value,
  choices,
  onChange,
  className = "",
}: {
  id: string;
  label?: string;
  value: string;
  choices: Choice[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const groups = [...new Set(choices.map((c) => c.group || ""))];
  return (
    <div className={`form-field ${className}`}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Select
        value={value}
        onValueChange={(v) => {
          if (v !== null) onChange(v);
        }}
        items={choices}
      >
        <SelectTrigger id={id} aria-label={label || id}>
          <SelectValue>
            {choices.find((c) => c.value === value)?.label || value || "请选择"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          listLabel={label || id}
          align="start"
          alignItemWithTrigger={false}
        >
          {groups.map((group) => (
            <SelectGroup key={group}>
              {group && <SelectLabel>{group}</SelectLabel>}
              {choices
                .filter((c) => (c.group || "") === group)
                .map((c) => (
                  <SelectItem
                    key={c.value}
                    value={c.value}
                    disabled={c.disabled}
                    title={c.reason}
                  >
                    {c.label}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
export function RouteMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 5h5c6 0 2 18 8 18h5M5 23h5c6 0 2-18 8-18h5M5 14h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="5" cy="5" r="2" fill="currentColor" />
      <circle cx="5" cy="23" r="2" fill="currentColor" />
      <circle cx="23" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}
