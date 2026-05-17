import { describe, expect, it } from "vitest";
import { ServerSanitizer } from "../../src/infrastructure/sanitization/ServerSanitizer.js";

const sanitizer = new ServerSanitizer();

describe("ServerSanitizer", () => {
  it("redacta keys blacklisteadas a nivel raiz", () => {
    const input = { firstName: "Juan", lastName: "Perez", patientId: "uuid-1" };
    const { sanitized, findings } = sanitizer.sanitize(input);
    const obj = sanitized as Record<string, unknown>;
    expect(obj["firstName"]).toBe("[REDACTED]");
    expect(obj["lastName"]).toBe("[REDACTED]");
    expect(obj["patientId"]).toBe("uuid-1");
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });

  it("respeta el safelist para keys terminadas en Id", () => {
    const input = { patientId: "abc-123", medicalRecordId: "def-456" };
    const { sanitized, findings } = sanitizer.sanitize(input);
    const obj = sanitized as Record<string, unknown>;
    expect(obj["patientId"]).toBe("abc-123");
    expect(obj["medicalRecordId"]).toBe("def-456");
    expect(findings).toHaveLength(0);
  });

  it("redacta keys anidadas", () => {
    const input = {
      patient: {
        patientId: "u1",
        emergencyContact: {
          firstName: "Maria",
          phone: "0991234567"
        }
      }
    };
    const { sanitized, findings } = sanitizer.sanitize(input);
    const patient = (sanitized as { patient: { emergencyContact: Record<string, unknown> } }).patient;
    expect(patient.emergencyContact["firstName"]).toBe("[REDACTED]");
    expect(patient.emergencyContact["phone"]).toBe("[REDACTED]");
    expect(findings.some((f) => f.path === "$.patient.emergencyContact.firstName")).toBe(true);
  });

  it("detecta cedula ecuatoriana de 10 digitos dentro de un string", () => {
    const input = { notes: "Paciente con cedula 1712345678 acude por dolor" };
    const { sanitized, findings } = sanitizer.sanitize(input);
    const notes = (sanitized as { notes: string }).notes;
    expect(notes).not.toContain("1712345678");
    expect(notes).toContain("[REDACTED]");
    expect(findings.some((f) => f.reason === "regex_match")).toBe(true);
  });

  it("detecta y redacta emails dentro de strings", () => {
    const input = { observations: "Contactar a doctor@clinica.com para seguimiento" };
    const { sanitized } = sanitizer.sanitize(input);
    const observations = (sanitized as { observations: string }).observations;
    expect(observations).not.toContain("doctor@clinica.com");
    expect(observations).toContain("[REDACTED]");
  });

  it("preserva campos clinicos validos", () => {
    const input = {
      vitalSigns: { systolicPressure: 120, diastolicPressure: 80, heartRate: 72 },
      diagnoses: [{ code: "J00", description: "Rinofaringitis aguda" }]
    };
    const { sanitized, findings } = sanitizer.sanitize(input);
    expect(findings).toHaveLength(0);
    expect(sanitized).toEqual(input);
  });

  it("funciona con arrays mixtos", () => {
    const input = {
      contacts: [
        { firstName: "Ana", relation: "madre" },
        { firstName: "Luis", relation: "hijo" }
      ]
    };
    const { sanitized } = sanitizer.sanitize(input);
    const contacts = (sanitized as { contacts: Array<Record<string, unknown>> }).contacts;
    expect(contacts[0]?.["firstName"]).toBe("[REDACTED]");
    expect(contacts[1]?.["firstName"]).toBe("[REDACTED]");
    expect(contacts[0]?.["relation"]).toBe("madre");
  });
});
