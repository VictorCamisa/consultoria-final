export type LogEntry = {
  id: string;
  agent: string;
  status: "ok" | "erro";
  msg: string;
  ts: Date;
};

export type AgentStat = {
  label: string;
  value: string | number;
};

export type AgentConfig = {
  id: string;
  icon: React.ElementType;
  gradient: string;
  title: string;
  description: string;
  stats: AgentStat[];
  action: string | null;
  disabled: boolean;
  loading: boolean;
};
