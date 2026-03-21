import mongoose from 'mongoose';

const SkillSchema = new mongoose.Schema({
  id: String,
  name: String,
  category: String,
  level: Number,
  proficiency: String
});

const CareerGoalSchema = new mongoose.Schema({
  title: String,
  targetDate: String,
  description: String
});

const PsychEvaluationSchema = new mongoose.Schema({
  date: String,
  report: String,
  scores: {
    leadership: Number,
    collaboration: Number,
    innovation: Number,
    resilience: Number,
    analytical: Number
  }
});

const ChatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'model'] },
  text: String,
  timestamp: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  profileId: { type: String, required: true, unique: true },
  name: { type: String, default: 'Guest User' },
  avatar: String,
  currentRole: { type: String, default: 'Software Engineer' },
  learningHours: { type: Number, default: 0 },
  skills: [SkillSchema],
  goals: [CareerGoalSchema],
  psychEvaluation: PsychEvaluationSchema,
  chatMessages: [ChatMessageSchema],
  roadmap: [mongoose.Schema.Types.Mixed], // RoadmapStep[]
  evaluation: String, // The text evaluation from Gemini
  suggestedCourses: [mongoose.Schema.Types.Mixed], // Course[]
  proficiencyScores: {
    Frontend: Number,
    Backend: Number,
    DevOps: Number,
    DataScience: Number,
    MachineLearning: Number
  }
});

export const User = mongoose.model('User', UserSchema);
