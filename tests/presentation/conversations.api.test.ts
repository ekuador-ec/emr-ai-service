import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildHarness } from "../fakes/buildHarness.js";

const RECORD_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const PATIENT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

async function createConversation(h: ReturnType<typeof buildHarness>) {
  const response = await request(h.app)
    .post("/v1/conversations")
    .send({ kind: "medical_record", entityId: RECORD_ID, modelPreference: "auto" });
  expect(response.status).toBe(201);
  return response.body.conversation as { id: string };
}

describe("POST /v1/conversations", () => {
  it("crea una conversacion", async () => {
    const h = buildHarness();
    const response = await request(h.app)
      .post("/v1/conversations")
      .send({ kind: "evolution", entityId: RECORD_ID, modelPreference: "auto" });

    expect(response.status).toBe(201);
    expect(response.body.conversation.kind).toBe("evolution");
    expect(response.body.conversation.entityId).toBe(RECORD_ID);
    expect(response.body.conversation.userId).toBe(h.userId);
  });

  it("rechaza con 400 si el kind es invalido", async () => {
    const h = buildHarness();
    const response = await request(h.app)
      .post("/v1/conversations")
      .send({ kind: "bad-kind", entityId: RECORD_ID });
    expect(response.status).toBe(400);
  });
});

describe("GET /v1/conversations", () => {
  it("lista solo las conversaciones del usuario autenticado", async () => {
    const h = buildHarness();
    await createConversation(h);

    const myList = await request(h.app).get("/v1/conversations");
    expect(myList.status).toBe(200);
    expect(myList.body.items).toHaveLength(1);

    h.setAuth({ client: h.client, userId: "99999999-9999-9999-9999-999999999999", userRole: null });
    const otherList = await request(h.app).get("/v1/conversations");
    expect(otherList.status).toBe(200);
    expect(otherList.body.items).toHaveLength(0);
  });
});

describe("GET /v1/conversations/:id", () => {
  it("devuelve la conversacion y sus mensajes", async () => {
    const h = buildHarness();
    const conv = await createConversation(h);

    const response = await request(h.app).get(`/v1/conversations/${conv.id}`);
    expect(response.status).toBe(200);
    expect(response.body.conversation.id).toBe(conv.id);
    expect(response.body.messages).toEqual([]);
  });

  it("devuelve 404 cuando la conversacion no existe", async () => {
    const h = buildHarness();
    const response = await request(h.app).get(
      "/v1/conversations/00000000-0000-0000-0000-000000000000"
    );
    expect(response.status).toBe(404);
  });
});

describe("DELETE /v1/conversations/:id", () => {
  it("elimina una conversacion propia y devuelve 204", async () => {
    const h = buildHarness();
    const conv = await createConversation(h);
    const del = await request(h.app).delete(`/v1/conversations/${conv.id}`);
    expect(del.status).toBe(204);

    const list = await request(h.app).get("/v1/conversations");
    expect(list.body.items).toHaveLength(0);
  });
});

describe("POST /v1/conversations/:id/messages (SSE)", () => {
  it("transmite chunks via SSE y persiste user + assistant messages", async () => {
    const h = buildHarness();
    const conv = await createConversation(h);

    const response = await request(h.app)
      .post(`/v1/conversations/${conv.id}/messages`)
      .set("Accept", "text/event-stream")
      .send({ message: "Que diagnostico diferencial sugieres?" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");

    const body = response.text;
    expect(body).toContain("event: conversation");
    expect(body).toContain("event: delta");
    expect(body).toContain("event: done");
    expect(body).toContain("event: completed");

    const detail = await request(h.app).get(`/v1/conversations/${conv.id}`);
    expect(detail.body.messages).toHaveLength(2);
    expect(detail.body.messages[0].role).toBe("user");
    expect(detail.body.messages[1].role).toBe("assistant");
  });

  it("rechaza con 400 si el mensaje es vacio", async () => {
    const h = buildHarness();
    const conv = await createConversation(h);
    const response = await request(h.app)
      .post(`/v1/conversations/${conv.id}/messages`)
      .send({ message: "   " });
    expect(response.status).toBe(400);
  });

  it("emite evento error via SSE si el caso de uso lanza", async () => {
    const h = buildHarness();
    const conv = await createConversation(h);

    h.setAuth({
      client: h.client,
      userId: "99999999-9999-9999-9999-999999999999",
      userRole: null
    });

    const response = await request(h.app)
      .post(`/v1/conversations/${conv.id}/messages`)
      .send({ message: "ayuda" });

    expect(response.status).toBe(200);
    expect(response.text).toContain("event: error");
    expect(response.text).toContain("NOT_FOUND");
  });

  it("incluye el resumen previo en el contexto enviado al LLM", async () => {
    let capturedContent = "";
    const h = buildHarness({
      responder: (input) => {
        capturedContent = input.messages.map((m) => m.content).join("\n");
        return "respuesta";
      }
    });

    await request(h.app)
      .post("/v1/summaries/medical-record")
      .send({
        entityId: RECORD_ID,
        payload: { patientId: PATIENT_ID, note: "alguna info" }
      })
      .expect(201);

    const conv = await createConversation(h);

    await request(h.app)
      .post(`/v1/conversations/${conv.id}/messages`)
      .send({ message: "que opinas?" })
      .expect(200);

    expect(capturedContent).toContain("Resumen clinico de referencia");
  });
});

describe("GET /health", () => {
  it("responde 200 con timestamp", async () => {
    const h = buildHarness();
    const response = await request(h.app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.timestamp).toBeTruthy();
  });
});
