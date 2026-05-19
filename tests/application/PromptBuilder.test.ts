import { describe, expect, it } from "vitest";
import { PromptBuilder } from "../../src/application/services/PromptBuilder.js";

const builder = new PromptBuilder({
  medicalRecord: "medical-record-v1",
  evolution: "evolution-v1",
  chat: "chat-system-v1",
  generalChat: "general-chat-v1",
});

describe("PromptBuilder", () => {
  it("devuelve el template adecuado por kind", () => {
    expect(builder.getTemplate("medical_record").version).toBe("medical-record-v1");
    expect(builder.getTemplate("evolution").version).toBe("evolution-v1");
    expect(builder.getTemplate("chat").version).toBe("chat-system-v1");
    expect(builder.getTemplate("general_chat").version).toBe("general-chat-v1");
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
      "medical_record",
      "Resumen previo X",
      [
        { role: "user", content: "Hola" },
        { role: "assistant", content: "Como puedo ayudarte" },
      ],
      "Y ahora?",
    );

    expect(msgs[0]?.role).toBe("system");
    expect(msgs[1]?.role).toBe("system");
    expect(msgs[1]?.content).toContain("Resumen previo X");
    expect(msgs[msgs.length - 1]?.role).toBe("user");
    expect(msgs[msgs.length - 1]?.content).toBe("Y ahora?");
  });

  it("omite el bloque de resumen si no hay summary disponible", () => {
    const msgs = builder.buildChatMessages("medical_record", null, [], "Hola");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe("system");
    expect(msgs[1]?.role).toBe("user");
  });

  it("para kind 'general' usa el prompt general y NO inyecta resumen aunque se pase", () => {
    const msgs = builder.buildChatMessages(
      "general",
      "Resumen previo X",
      [],
      "Cual es el manejo inicial del shock septico?",
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe("system");
    expect(msgs[0]?.content).toContain("consulta general");
    expect(msgs[0]?.content).toContain("RESTRICCION DE DOMINIO");
    expect(msgs.some((m) => m.content.includes("Resumen previo X"))).toBe(false);
  });

  it("el prompt general contiene la frase de rechazo para temas no medicos", () => {
    const template = builder.getTemplate("general_chat");
    expect(template.system).toContain("Soy un asistente clinico especializado");
  });
});
