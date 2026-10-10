export function assertSupportedRuntime(version, minimum) {
  const actual = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "");
  const required = /^(\d+)\.(\d+)\.(\d+)$/.exec(minimum ?? "");
  if (!required) throw new Error("La version de Node de .nvmrc es invalida.");
  const floor = required.slice(1).map(Number);
  const parts = actual?.slice(1).map(Number);
  const meetsMinimum = parts && (parts[1] > floor[1] || (parts[1] === floor[1] && parts[2] >= floor[2]));
  if (!parts || parts[0] !== floor[0] || !meetsMinimum) {
    throw new Error(`Node incompatible: se requiere >=${minimum} <${floor[0] + 1}; se recibio ${version || "desconocido"}. Activa la version de .nvmrc antes de ejecutar npm.`);
  }
}
