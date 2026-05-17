import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildHarness } from "../fakes/buildHarness.js";

const PATIENT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RECORD_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("POST /v1/summaries/medical-record", () => {
  it("genera un resumen y devuelve 201 cuando no hay cache", async () => {
    const h = buildHarness();
    const response = await request(h.app)
      .post("/v1/summaries/medical-record")
      .send({
        entityId: RECORD_ID,
        payload: { patientId: PATIENT_ID, evolutions: [] },
        preference: "auto"
      });

    expect(response.status).toBe(201);
    expect(response.body.cached).toBe(false);
    expect(response.body.summary.kind).toBe("medical_record");
    expect(response.body.summary.entityId).toBe(RECORD_ID);
    expect(response.body.summary.content).toContain("Resumen mock");
  });

  it("devuelve 200 cached=true en la segunda llamada con mismo payload", async () => {
    const h = buildHarness();
    const payload = { patientId: PATIENT_ID, evolutions: [{ id: 1 }] };

    const first = await request(h.app)
      .post("/v1/summaries/medical-record")
      .send({ entityId: RECORD_ID, payload, preference: "auto" });
    expect(first.status).toBe(201);

    const second = await request(h.app)
      .post("/v1/summaries/medical-record")
      .send({ entityId: RECORD_ID, payload, preference: "auto" });

    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(second.body.summary.id).toBe(first.body.summary.id);
  });

  it("rechaza con 400 si el payload no es valido (entityId invalido)", async () => {
    const h = buildHarness();
    const response = await request(h.app)
      .post("/v1/summaries/medical-record")
      .send({ entityId: "not-a-uuid", payload: {} });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("sanitiza PII en el servidor antes de enviar al provider", async () => {
    let captured = "";
    const h = buildHarness({
      responder: (input) => {
        captured = input.messages.find((m) => m.role === "user")?.content ?? "";
        return "resumen";
      }
    });

    await request(h.app)
      .post("/v1/summaries/evolution")
      .send({
        entityId: RECORD_ID,
        payload: {
          patientId: PATIENT_ID,
          firstName: "Juan",
          lastName: "Perez",
          notes: "Contactar al 0991234567 para seguimiento"
        }
      })
      .expect(201);

    expect(captured).not.toContain("Juan");
    expect(captured).not.toContain("Perez");
    expect(captured).not.toContain("0991234567");
    expect(captured).toContain("[REDACTED]");
  });
});

describe("GET /v1/summaries/:kind/:entityId", () => {
  it("devuelve 404 si no hay resumen previo", async () => {
    const h = buildHarness();
    const response = await request(h.app).get(`/v1/summaries/medical_record/${RECORD_ID}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("devuelve el resumen mas reciente cuando existe", async () => {
    const h = buildHarness();
    await request(h.app)
      .post("/v1/summaries/medical-record")
      .send({ entityId: RECORD_ID, payload: { patientId: PATIENT_ID, v: 1 } });

    const response = await request(h.app).get(`/v1/summaries/medical_record/${RECORD_ID}`);
    expect(response.status).toBe(200);
    expect(response.body.summary.entityId).toBe(RECORD_ID);
  });
});
