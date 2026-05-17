/**
 * Contexto clinico anonimizado para enviar al LLM.
 * Por contrato, NUNCA debe contener: cedula, nombres, apellidos, email,
 * telefono, direccion ni datos identificables del paciente. Solo IDs internos
 * (UUIDs) y datos clinicos.
 */

export interface AnonymizedPatientContext {
  patientId: string;
  ageYears: number | null;
  gender: string | null;
  bloodType: string | null;
  maritalStatus: string | null;
  culturalGroup: string | null;
  educationLevel: string | null;
  occupation: string | null;
  geographicLocation: {
    province: string | null;
    canton: string | null;
    parish: string | null;
  } | null;
  healthInsurance: string | null;
  clinicalAntecedents: AnonymizedClinicalAntecedent[];
}

export interface AnonymizedClinicalAntecedent {
  type: string;
  description: string | null;
  pathology: {
    code: string;
    description: string;
  } | null;
  startedAt: string | null;
  isActive: boolean;
}

export interface AnonymizedVitalSigns {
  systolicPressure: number | null;
  diastolicPressure: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperatureCelsius: number | null;
  oxygenSaturation: number | null;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  glucose: number | null;
}

export interface AnonymizedDiagnosis {
  type: string;
  certainty: string;
  pathology: {
    code: string;
    description: string;
  };
  notes: string | null;
}

export interface AnonymizedEvolutionContext {
  evolutionId: string;
  patientId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  arrivalMethod: string | null;
  clinicalCause: string | null;
  reasonForConsultation: string | null;
  currentIllness: string | null;
  systemsReview: Array<{ system: string; condition: string; notes: string | null }>;
  vitalSigns: AnonymizedVitalSigns | null;
  physicalExams: Array<{ region: string; findings: string | null }>;
  injuries: Array<{ type: string; region: string | null; description: string | null }>;
  diagnoses: AnonymizedDiagnosis[];
  discharge: {
    type: string;
    notes: string | null;
  } | null;
}

export interface AnonymizedMedicalRecordContext {
  medicalRecordId: string;
  patient: AnonymizedPatientContext;
  evolutions: AnonymizedEvolutionContext[];
}
