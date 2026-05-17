export interface SanitizationFinding {
  path: string;
  reason: "blacklisted_key" | "regex_match";
  matchedPattern?: string;
}

export interface SanitizationResult<T> {
  sanitized: T;
  findings: SanitizationFinding[];
}

export interface Sanitizer {
  sanitize<T>(payload: T): SanitizationResult<T>;
}
