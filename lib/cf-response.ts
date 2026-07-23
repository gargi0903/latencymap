export function getCloudflareResponseColo(response: Response): string | null {
  const colo = (response as Response & { cf?: { colo?: string } }).cf?.colo;
  return typeof colo === "string" && colo.trim().length > 0 ? colo : null;
}
