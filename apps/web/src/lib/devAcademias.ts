export const DEV_ACADEMIAS_CHANGED = "dev-academias-changed";

export function notifyDevAcademiasChanged(): void {
  window.dispatchEvent(new CustomEvent(DEV_ACADEMIAS_CHANGED));
}
