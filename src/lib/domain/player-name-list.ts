export const MAX_PLAYER_LIST_SIZE = 60;

export function parsePlayerNameList(input: string): string[] {
  if (input.length > 6000) throw new Error("La lista es demasiado larga. Pegá hasta 60 nombres.");
  const lines = input.split(/\r?\n/).map((line) => line.trim().replace(/^\d+[.)-]\s*/, "").replace(/\s+/g, " ")).filter(Boolean);
  if (!lines.length) throw new Error("Pegá al menos un nombre, uno por línea.");
  if (lines.length > MAX_PLAYER_LIST_SIZE) throw new Error("Podés cargar hasta 60 jugadores por vez.");
  if (lines.some((name) => name.length < 3 || name.length > 80)) throw new Error("Cada nombre debe tener entre 3 y 80 caracteres. Podés usar nombre y apellido o un apodo.");
  const seen = new Set<string>();
  return lines.filter((name) => {
    const key = name.toLocaleLowerCase("es");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
