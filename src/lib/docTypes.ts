export const DOC_TYPE_PRESETS = [
  "Quotation",
  "Specification",
  "Invoice",
  "Proposal",
  "Estimate",
] as const;

export type DocTypePreset = (typeof DOC_TYPE_PRESETS)[number];
