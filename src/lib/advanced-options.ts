import { recommendedFlags, flagApplies, flagOptions } from "./converter.ts";
import type { FormState, Flag } from "./converter.ts";
export const advancedTextKeys = [
  "include",
  "exclude",
  "rename",
  "filename",
  "interval",
  "dev_id",
  "diyua",
] as const;
export type AdvancedOptions = Pick<
  FormState,
  | (typeof advancedTextKeys)[number]
  | "flags"
  | "extraParams"
  | "extraParamsTarget"
>;
export function advancedOptions(form: FormState): AdvancedOptions {
  return {
    include: form.include,
    exclude: form.exclude,
    rename: form.rename,
    filename: form.filename,
    interval: form.interval,
    dev_id: form.dev_id,
    diyua: form.diyua,
    flags: { ...form.flags },
    extraParams: form.extraParams.map(([k, v]) => [k, v]),
    extraParamsTarget: form.extraParamsTarget,
  };
}
export function defaultAdvanced(
  required: Partial<Record<Flag, boolean>> = {},
  format = "clash",
): AdvancedOptions {
  return {
    include: "",
    exclude: "",
    rename: "",
    filename: "",
    interval: "",
    dev_id: "",
    diyua: "",
    flags: recommendedFlags(format, required),
    extraParams: [],
    extraParamsTarget: null,
  };
}
export function advancedCount(
  form: FormState,
  required: Partial<Record<Flag, boolean>> = {},
) {
  return (
    advancedTextKeys.filter((k) => form[k].trim()).length +
    form.extraParams.length +
    flagOptions.filter(
      ({ key }) =>
        flagApplies(key, form.format) &&
        form.flags[key] !== recommendedFlags(form.format, required)[key],
    ).length
  );
}
export function validateAdvanced(options: AdvancedOptions) {
  if (
    options.interval &&
    (!Number.isFinite(Number(options.interval)) ||
      Math.round(Number(options.interval) * 86400) < 1)
  )
    return "更新间隔不能小于 1 秒，请以天为单位填写。";
  return "";
}
