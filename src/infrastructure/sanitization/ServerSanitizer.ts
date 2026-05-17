import type {
  SanitizationFinding,
  SanitizationResult,
  Sanitizer
} from "../../domain/services/Sanitizer.js";

const REDACTED = "[REDACTED]";

const BLACKLISTED_KEY_PATTERNS: RegExp[] = [
  /^firstName$/i,
  /^lastName$/i,
  /^fullName$/i,
  /^middleName$/i,
  /^mothersLastName$/i,
  /^fathersLastName$/i,
  /name$/i,
  /^email$/i,
  /^phone$/i,
  /^mobile$/i,
  /^cellphone$/i,
  /^telephone$/i,
  /^address$/i,
  /^street$/i,
  /^zipCode$/i,
  /^postalCode$/i,
  /^idNumber$/i,
  /^cedula$/i,
  /^dni$/i,
  /^passport$/i,
  /^socialSecurityNumber$/i,
  /^ssn$/i,
  /^document$/i,
  /^documentNumber$/i
];

const VALUE_REGEX_RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: "ec_cedula", pattern: /(?<!\d)\d{10}(?!\d)/ },
  {
    name: "ec_phone",
    pattern: /(?<!\d)(?:\+593|0)(?:\s|-)?\d{2,3}(?:\s|-)?\d{3}(?:\s|-)?\d{4}(?!\d)/
  }
];

const KEY_SAFELIST: RegExp[] = [
  /^code$/i,
  /^id$/i,
  /Id$/,
  /^path$/i,
  /^kind$/i,
  /^description$/i,
  /^pathology$/i
];

function isBlacklistedKey(key: string): boolean {
  if (KEY_SAFELIST.some((p) => p.test(key))) return false;
  return BLACKLISTED_KEY_PATTERNS.some((p) => p.test(key));
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return REDACTED;
  if (typeof value === "number") return null;
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") return {};
  return null;
}

export class ServerSanitizer implements Sanitizer {
  sanitize<T>(payload: T): SanitizationResult<T> {
    const findings: SanitizationFinding[] = [];
    const sanitized = this.walk(payload, "$", findings);
    return { sanitized: sanitized as T, findings };
  }

  private walk(value: unknown, path: string, findings: SanitizationFinding[]): unknown {
    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
      return this.sanitizeString(value, path, findings);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => this.walk(item, `${path}[${index}]`, findings));
    }

    if (typeof value === "object") {
      const input = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};
      for (const key of Object.keys(input)) {
        const childPath = `${path}.${key}`;
        if (isBlacklistedKey(key)) {
          findings.push({ path: childPath, reason: "blacklisted_key" });
          output[key] = redactValue(input[key]);
          continue;
        }
        output[key] = this.walk(input[key], childPath, findings);
      }
      return output;
    }

    return value;
  }

  private sanitizeString(value: string, path: string, findings: SanitizationFinding[]): string {
    let result = value;
    for (const rule of VALUE_REGEX_RULES) {
      const globalPattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
      if (globalPattern.test(result)) {
        findings.push({ path, reason: "regex_match", matchedPattern: rule.name });
        result = result.replace(globalPattern, REDACTED);
      }
    }
    return result;
  }
}
