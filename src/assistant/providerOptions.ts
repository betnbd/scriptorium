import type { ProviderId } from "../types";

export interface ProviderOption {
  value: string;
  label: string;
}

export const openaiModelOptions: ProviderOption[] = [
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
  { value: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark" },
];

export const anthropicModelOptions: ProviderOption[] = [
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
];

export const openaiEffortOptions: ProviderOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
];

export const anthropicEffortOptions: ProviderOption[] = [
  ...openaiEffortOptions,
  { value: "max", label: "Max" },
];

export function modelOptionsForProvider(provider: ProviderId) {
  if (provider === "anthropic-subscription") {
    return anthropicModelOptions;
  }

  return openaiModelOptions;
}

export function effortOptionsForProvider(provider: ProviderId) {
  if (provider === "anthropic-subscription") {
    return anthropicEffortOptions;
  }

  return openaiEffortOptions;
}
