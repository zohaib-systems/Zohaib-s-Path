export enum Proficiency {
  BEGINNER = "Beginner",
  INTERMEDIATE = "Intermediate",
  ADVANCED = "Advanced",
  EXPERT = "Expert"
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: number; // 0-100
  proficiency: Proficiency;
}

export interface Course {
  id: string;
  title: string;
  provider: string;
  url: string;
  difficulty: Proficiency;
  description: string;
  relevance: string; // Why it was recommended
}

export interface CareerGoal {
  title: string;
  targetDate: string;
  description: string;
}

export interface PsychEvaluation {
  date: string;
  report: string;
  scores: {
    leadership: number;
    collaboration: number;
    innovation: number;
    resilience: number;
    analytical: number;
  };
}

export interface RoadmapStep {
  id: string;
  title: string;
  deadline: string;
  skills: string[];
  techStack: string[];
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface ProficiencyScores {
  Frontend: number;
  Backend: number;
  DevOps: number;
  DataScience: number;
  MachineLearning: number;
}

export interface UserProfile {
  name: string;
  currentRole: string;
  skills: Skill[];
  goals: CareerGoal[];
  psychEvaluation?: PsychEvaluation;
  proficiencyScores?: ProficiencyScores;
  learningHours?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
