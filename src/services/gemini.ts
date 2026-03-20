import { GoogleGenAI, Type } from "@google/genai";
import { Skill, Course, Proficiency, PsychEvaluation, CareerGoal, RoadmapStep, ProficiencyScores } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getProficiencyCategorization = async (
  skills: Skill[],
  goals: CareerGoal[]
): Promise<ProficiencyScores> => {
  const model = "gemini-3.1-pro-preview";
  const goalTitles = goals.map(g => g.title).join(", ");
  
  const response = await ai.models.generateContent({
    model,
    contents: `Act as a Senior Technical Career Coach. Based on the user's skills: ${JSON.stringify(skills)} and their career goals: "${goalTitles}", 
    categorize their proficiency into exactly five categories: Frontend, Backend, DevOps, Data Science, and Machine Learning.
    
    Goal Bias: 
    - If the user mentions 'Full Stack' in their goals, weight Backend/Frontend higher. 
    - If they mention 'AI/ML' or 'Artificial Intelligence', identify gaps in Linear Algebra, Python, or Model Deployment and adjust scores accordingly.
    
    Output the result as a JSON object with scores from 0-100 for each category.`,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          Frontend: { type: Type.NUMBER },
          Backend: { type: Type.NUMBER },
          DevOps: { type: Type.NUMBER },
          DataScience: { type: Type.NUMBER },
          MachineLearning: { type: Type.NUMBER }
        },
        required: ["Frontend", "Backend", "DevOps", "DataScience", "MachineLearning"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Proficiency JSON", response.text);
    throw new Error("The AI failed to analyze your proficiency correctly. Please try again.");
  }
};

export const generateRoadmap = async (skills: Skill[], goal: CareerGoal): Promise<RoadmapStep[]> => {
  const model = "gemini-3.1-pro-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Based on the user's current skills: ${JSON.stringify(skills)} and their career goal: "${goal.title}" (Target Date: ${goal.targetDate}), 
    create a chronological learning roadmap with 4-6 specific milestones. 
    Each milestone should have a title, a realistic deadline (relative to today or specific dates before the target date), 
    a list of specific skills to acquire, the tech stack involved, and a brief description.
    Current Date: ${new Date().toISOString().split('T')[0]}`,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            deadline: { type: Type.STRING, description: "YYYY-MM-DD format" },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: { type: Type.STRING }
          },
          required: ["id", "title", "deadline", "skills", "techStack", "description"]
        }
      }
    }
  });

  try {
    const steps = JSON.parse(response.text || "[]");
    return steps.map((step: any) => ({ ...step, status: 'pending' }));
  } catch (e) {
    console.error("Failed to parse Roadmap JSON", response.text);
    throw new Error("The AI failed to generate a valid roadmap. Please try again.");
  }
};

export const generatePsychReport = async (
  answers: { question: string, answer: string }[],
  userProfile: any
): Promise<PsychEvaluation> => {
  const model = "gemini-3.1-pro-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Analyze these psychological assessment answers: ${JSON.stringify(answers)} for the user: ${JSON.stringify(userProfile)}.
    Generate a detailed psychological career report and scores (0-100) for: leadership, collaboration, innovation, resilience, and analytical thinking.
    The report should be professional, insightful, and provide specific behavioral advice.`,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          report: { type: Type.STRING, description: "Detailed markdown report." },
          scores: {
            type: Type.OBJECT,
            properties: {
              leadership: { type: Type.NUMBER },
              collaboration: { type: Type.NUMBER },
              innovation: { type: Type.NUMBER },
              resilience: { type: Type.NUMBER },
              analytical: { type: Type.NUMBER }
            },
            required: ["leadership", "collaboration", "innovation", "resilience", "analytical"]
          }
        },
        required: ["report", "scores"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return {
      ...data,
      date: new Date().toISOString()
    };
  } catch (e) {
    console.error("Failed to parse Psych Report JSON", response.text);
    throw new Error("The AI failed to generate a valid psychological report. Please try again.");
  }
};

export const getCareerCounseling = async (
  message: string,
  history: { role: 'user' | 'model', text: string }[],
  userProfile: any
) => {
  const model = "gemini-3.1-pro-preview";
  const systemInstruction = `You are an expert Career Counselor. Your goal is to help users navigate their professional journey.
  Current User Profile: ${JSON.stringify(userProfile)}
  
  Provide actionable, empathetic, and strategic advice. Focus on:
  1. Skill gaps based on their goals.
  2. Industry trends.
  3. Networking strategies.
  4. Resume and interview tips.
  
  Keep responses concise and professional. Use Markdown for formatting.`;

  // Truncate history to last 10 messages to avoid token limits
  const truncatedHistory = history.slice(-10);

  const response = await ai.models.generateContent({
    model,
    contents: [
      ...truncatedHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      systemInstruction,
      maxOutputTokens: 2048,
    },
  });

  return response.text;
};

export const evaluateSkillsAndSuggestCourses = async (skills: Skill[], goal: string): Promise<{
  evaluation: string;
  suggestedCourses: Course[];
}> => {
  const model = "gemini-3.1-pro-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Evaluate these skills: ${JSON.stringify(skills)} against the goal: "${goal}". 
    Provide a brief evaluation and suggest 3-4 specific online courses (from platforms like Coursera, Udemy, edX, etc.) to bridge the gaps.`,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          evaluation: { type: Type.STRING, description: "A summary of the skill gap analysis." },
          suggestedCourses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                provider: { type: Type.STRING },
                url: { type: Type.STRING },
                difficulty: { type: Type.STRING, enum: Object.values(Proficiency) },
                description: { type: Type.STRING },
                relevance: { type: Type.STRING }
              },
              required: ["id", "title", "provider", "url", "difficulty", "description", "relevance"]
            }
          }
        },
        required: ["evaluation", "suggestedCourses"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Skill Evaluation JSON", response.text);
    throw new Error("The AI failed to evaluate your skills correctly. Please try again.");
  }
};
