export function hasOwnerSession(): boolean {
  return sessionStorage.getItem("ownerSession") === "true";
}

export function setOwnerSession(): void {
  sessionStorage.setItem("ownerSession", "true");
}

export function clearOwnerSession(): void {
  sessionStorage.removeItem("ownerSession");
}
