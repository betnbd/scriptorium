export function shouldSwitchFile(
  isDirty: boolean,
  confirmDiscard: () => boolean,
): boolean {
  if (!isDirty) {
    return true;
  }

  return confirmDiscard();
}
