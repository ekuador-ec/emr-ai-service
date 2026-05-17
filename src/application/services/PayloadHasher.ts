import { createHash } from "node:crypto";

/**
 * Calcula un hash determinista (SHA-256 hex) sobre un payload arbitrario
 * agrupado con la version del prompt. Dos objetos semanticamente identicos
 * (mismas keys, mismos valores) produciran el mismo hash sin importar el
 * orden de las propiedades. Es la base del cache de resumenes.
 */
export class PayloadHasher {
  hash(payload: unknown, promptVersion: string): string {
    const canonical = this.canonicalize(payload);
    return createHash("sha256").update(`${canonical}|${promptVersion}`).digest("hex");
  }

  private canonicalize(value: unknown): string {
    if (value === null) return "null";
    if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "string") return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.canonicalize(v)).join(",")}]`;
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const parts = keys.map((k) => `${JSON.stringify(k)}:${this.canonicalize(obj[k])}`);
      return `{${parts.join(",")}}`;
    }
    return "null";
  }
}
