export interface Task {
  uuid: string;
  description: string;
  optional: boolean;
  completed: boolean;
  legendary?: boolean;
  icon?: string;
  gifUrl?: string;
  recurrenceId?: string;
  order?: number;
}

export interface Day {
  uuid: string;
  name: string;
  subtitle: string;
  tasks: Task[];
}

export interface Week {
  uuid: string;
  name: string;
  subtitle: string;
  progress: number;
  conquered?: boolean;
  days: Day[];
}

export interface Month {
  uuid: string;
  name: string;
  subtitle: string;
  progress: number;
  weeks: Week[];
  finished?: boolean;
  createdAt?: string;
  finishedAt?: string;
}
