"use client";

import { LAYOUT_LABELS } from "@/lib/media/compositing";

type Layout = keyof typeof LAYOUT_LABELS;

type LayoutPickerProps = {
  value: Layout;
  onChange: (layout: Layout) => void;
  disabled?: boolean;
};

export function LayoutPicker({ value, onChange, disabled }: LayoutPickerProps) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        How you appear in scenes
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Layout)}
        className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {(Object.keys(LAYOUT_LABELS) as Layout[]).map((key) => (
          <option key={key} value={key}>
            {LAYOUT_LABELS[key]}
          </option>
        ))}
      </select>
    </div>
  );
}
