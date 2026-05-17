import { describe, expect, it } from "vitest";
import { PromptBuilder } from "../../src/application/services/PromptBuilder.js";

const builder = new PromptBuilder({
  medicalRecord: "medical-record-v1",
  evolution: "evolution-v1",
  chat: "chat-system-v1"
});

describe("PromptBuilder", () => {
  it("devuelve el template adecuado por kind", () => {
    expect(builder.getTemplate("medical_record").version).toBe("medical-record-v1");
    expect(builder.getTemplate("evolution").version).toBe("evolution-v1");
    expect(builder.getTemplate("chat").version).toBe("chat-system-v1");
  });

  it("construye mensajes de resumen con system + user", () => {
    const msgs = builder.buildSummaryMessages("medical_record", { foo: "bar" });
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe("system");
    expect(msgs[1]?.role).toBe("user");
    expect(msgs[1]?.content).toContain("\"foo\": \"bar\"");
  });

  it("construye mensajes de chat con system + summary + history + user", () => {
    const msgs = builder.buildChatMessages(
      "Resumen previo X",
      [
        { role: "user", content: "Hola" },
        { role: "assistant", content: "Como puedo ayudarte" }
      ],
      "Y ahora?"
    );

    expect(msgs[0]?.role).toBe("system");
    expect(msgs[1]?.role).toBe("system");
    expect(msgs[1]?.content).toContain("Resumen previo X");
    expect(msgs[msgs.length - 1]?.role).toBe("user");
    expect(msgs[msgs.length - 1]?.content).toBe("Y ahora?");
  });

  it("omite el bloque de resumen si no hay summary disponible", () => {
    const msgs = builder.buildChatMessages(null, [], "Hola");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe("system");
    expect(msgs[1]?.role).toBe("user");
  });
});
