import type { LlmChatMessage } from "../../domain/services/LlmProvider.js";
import type { SummaryKind } from "../../domain/models/Summary.js";

export interface PromptTemplate {
  kind: SummaryKind | "chat";
  version: string;
  system: string;
}

export interface PromptVersions {
  medicalRecord: string;
  evolution: string;
  chat: string;
}

const MEDICAL_RECORD_SYSTEM_PROMPT = `Eres un asistente clinico experto que ayuda a personal medico a leer rapidamente una Historia Clinica completa.
Tu tarea es generar un resumen clinico estructurado en espanol, claro y conciso.

Reglas estrictas:
- Trabajas SIEMPRE con datos anonimizados. Nunca pidas ni infieras el nombre, cedula, telefono ni direccion del paciente.
- Si encuentras campos marcados como [REDACTED], asume que son datos identificables removidos y continua sin mencionarlos.
- No inventes diagnosticos, medicamentos ni hallazgos que no esten en el contexto.
- Si un dato no esta presente, indica "No registrado" en lugar de suponerlo.

Estructura tu respuesta en Markdown con las siguientes secciones (omite las que no apliquen):

## Resumen general
Parrafo breve (3-5 lineas) con la situacion clinica global del paciente.

## Datos demograficos relevantes
Edad, genero, grupo sanguineo, ocupacion, ubicacion geografica (si aplica al cuadro).

## Antecedentes
Lista de antecedentes clinicos relevantes (patologicos, quirurgicos, alergias, familiares).

## Cronologia de evoluciones
Linea de tiempo concisa de las EM asociadas: fecha, motivo principal y diagnostico mas relevante.

## Diagnosticos recurrentes
Codigos CIE-10 que aparecen mas de una vez o que parecen patrones cronicos.

## Alertas clinicas
Hallazgos que requieren atencion del medico tratante (signos vitales atipicos sostenidos, antecedentes graves, patrones repetitivos).

## Sugerencias de seguimiento
Acciones que el medico podria considerar (estudios complementarios, interconsultas, controles).`;

const EVOLUTION_SYSTEM_PROMPT = `Eres un asistente clinico experto que ayuda a personal medico a comprender rapidamente una Evolucion Medica puntual.
Genera un resumen clinico estructurado en espanol de esa atencion especifica.

Reglas estrictas:
- Trabajas SIEMPRE con datos anonimizados. Ignora cualquier campo [REDACTED].
- No inventes informacion ausente en el contexto.
- Si un dato no esta presente, indica "No registrado".

Estructura en Markdown:

## Sintesis de la atencion
Parrafo breve (2-4 lineas) que capture lo esencial: motivo, hallazgos principales y desenlace.

## Motivo y enfermedad actual
Resume el motivo de consulta y la evolucion de la enfermedad actual.

## Signos vitales destacados
Solo valores fuera de rango o relevantes para el cuadro. Si todos son normales, indicarlo en una linea.

## Examen fisico
Hallazgos positivos relevantes por region.

## Diagnosticos
Diagnosticos de ingreso y alta con sus codigos CIE-10. Diferencia presuntivos vs definitivos.

## Plan / Alta
Indicaciones, tipo de alta y recomendaciones registradas.

## Puntos de atencion
Alertas, inconsistencias o datos que el clinico deberia revisar.`;

const CHAT_SYSTEM_PROMPT = `Eres un asistente clinico que conversa con personal medico sobre un caso clinico previamente resumido.
Reglas estrictas:
- Trabajas SIEMPRE con datos anonimizados; jamas solicites datos identificables del paciente.
- Basa tus respuestas en el contexto del resumen y la conversacion previa. Si te falta informacion, dilo explicitamente.
- No emitas diagnosticos definitivos por ti mismo: ofrece hipotesis, diagnosticos diferenciales y razonamientos.
- Cita el codigo CIE-10 cuando se discutan patologias especificas.
- Tu rol es apoyar el razonamiento clinico, no reemplazar el juicio del medico.
- Responde en espanol, en un tono profesional, conciso y enfocado.`;

export class PromptBuilder {
  private readonly versions: PromptVersions;

  constructor(versions: PromptVersions) {
    this.versions = versions;
  }

  getTemplate(kind: SummaryKind | "chat"): PromptTemplate {
    if (kind === "medical_record") {
      return { kind, version: this.versions.medicalRecord, system: MEDICAL_RECORD_SYSTEM_PROMPT };
    }
    if (kind === "evolution") {
      return { kind, version: this.versions.evolution, system: EVOLUTION_SYSTEM_PROMPT };
    }
    return { kind: "chat", version: this.versions.chat, system: CHAT_SYSTEM_PROMPT };
  }

  buildSummaryMessages(kind: SummaryKind, sanitizedPayload: unknown): LlmChatMessage[] {
    const template = this.getTemplate(kind);
    return [
      { role: "system", content: template.system },
      {
        role: "user",
        content: `Contexto clinico anonimizado (JSON):\n\n\`\`\`json\n${JSON.stringify(sanitizedPayload, null, 2)}\n\`\`\`\n\nGenera el resumen siguiendo las instrucciones.`
      }
    ];
  }

  buildChatMessages(
    summaryContent: string | null,
    history: LlmChatMessage[],
    nextUserMessage: string
  ): LlmChatMessage[] {
    const template = this.getTemplate("chat");
    const messages: LlmChatMessage[] = [{ role: "system", content: template.system }];

    if (summaryContent) {
      messages.push({
        role: "system",
        content: `Resumen clinico de referencia (contexto base de la conversacion):\n\n${summaryContent}`
      });
    }

    messages.push(...history);
    messages.push({ role: "user", content: nextUserMessage });
    return messages;
  }
}
