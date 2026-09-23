// Contrato de dados do TPM (Tailor Pre-Meeting).
// Portado de tailorexec/tailor-pre-meeting sem alteracao de forma: o JSON que a
// IA devolve e o que esta gravado em tpm_reports.report_data seguem esta estrutura,
// entao mudar um campo aqui invalida os relatorios ja salvos.

export interface TailorCase {
  id: string;
  clientName: string;
  sector: string;
  functionSearched: string;
  seniority: "C-Level" | "VP" | "Director" | "Senior Manager" | "Manager";
  complexity: "Alta" | "Média" | "Baixa";
  region: string;
  result: string;
  tags: string[];
  confidential: boolean;
  createdAt: string;
}

export interface Executive {
  id: string;
  name: string;
  linkedinUrl?: string;
  title?: string;
  company?: string;
  trajectory?: string;
  timeAtCompany?: string;
  recentPosts?: string[];
  powerLevel?: "Decisor" | "Influenciador" | "Executor";
  probableAgenda?: string;
  connectionPoints?: string[];
  approachRisks?: string[];
}

export interface TPMInput {
  companyName: string;
  website?: string;
  companyLinkedin?: string;
  executiveLinkedins?: string[];
  executiveName?: string;
  meetingRole?: string;
  location?: string;
  freeText?: string;
  agendaPrint?: File | null;
  agendaBase64?: string;
  agendaMimeType?: string;
  parsedAgenda?: ParsedAgenda | null;
}

export interface ParsedAgendaParticipant {
  name: string;
  email?: string | null;
  title?: string | null;
  company?: string | null;
  linkedinSearchQuery?: string | null;
}

export interface ParsedAgenda {
  participants: ParsedAgendaParticipant[];
  companyName?: string | null;
  website?: string | null;
  meetingSubject?: string | null;
  meetingDate?: string | null;
  meetingLocation?: string | null;
  additionalContext?: string | null;
}

export interface QualityMetrics {
  overallConfidence: number;
  sourcedDataPercent: number;
  hypothesesPercent: number;
  alerts: string[];
}

export interface TPMReport {
  id: string;
  input: TPMInput;
  executiveSummary: string;
  market: {
    overview: string;
    trends: string[];
    pressures: string[];
    competitors: string[];
  };
  company: {
    businessModel: string;
    sizeAndScale?: string;
    productsAndServices?: string;
    clientsAndMarket?: string;
    geographicPresence: string;
    strategicMomentSignals: string[];
    facts: Array<{ text: string; source: string; url: string }>;
    hypotheses: Array<{ text: string; confidence: number }>;
  };
  executives: Executive[];
  strategicReading: {
    painHypotheses: Array<{ text: string; uncertainty: number }>;
    possibleObjections: Array<{ text: string; uncertainty: number }>;
    consultingLevers: Array<{ text: string; uncertainty: number }>;
  };
  surgicalQuestions: {
    strategy: Array<{ text: string; highPower: boolean }>;
    culture: Array<{ text: string; highPower: boolean }>;
    blueprint: Array<{ text: string; highPower: boolean }>;
    decisionProcess: Array<{ text: string; highPower: boolean }>;
  };
  tailorConnections: Array<{
    caseId: string;
    caseName: string;
    sector?: string;
    positions: string[];
    connectionType?: "setorial_direta" | "modelo_negocio" | "operacional" | "desafio";
    similarity: number;
    scoringBreakdown?: {
      subsetor: number;
      operacao: number;
      desafio: number;
      funcao: number;
      geografia: number;
    };
    justification: string;
    sanityCheck?: string;
    howToUse?: string;
    conflictAlert?: string;
  }>;
  tailorAuthority?: {
    summary: string;
    justifications: Array<{
      point: string;
      evidence: string;
    }>;
    relevantSectors: string[];
    relevantClients: string[];
  };
  assumptions: string[];
  gaps: string[];
  quality: QualityMetrics;
  meetingSimulation?: {
    scenarios: Array<{
      scenario: string;
      clientReaction: string;
      bestResponse: string;
    }>;
  };
  createdAt: string;
  version: "internal" | "client";
  /** Token do link público. Só vem preenchido quando o link já foi criado. */
  shareToken?: string | null;
}

export interface SurgicalQuestion {
  id: string;
  category: "Estratégia" | "Cultura" | "Blueprint" | "Processo Decisório";
  text: string;
  tags: string[];
}

export interface Sector {
  id: string;
  name: string;
  description: string;
}
