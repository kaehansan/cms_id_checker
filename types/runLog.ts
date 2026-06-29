export type UserSession = {
  name: string;
  email: string;
};

export type RunLog = {
  id: string;
  fileName: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  total: number;
  matched: number;
  totalProblems: number;
  ambiguous: number;
  missingEn: number;
  missingTh: number;
  overrideMismatch: number;
  unpairedRaw: number;
};

export type RunLogInput = Omit<RunLog, "id" | "createdAt">;
