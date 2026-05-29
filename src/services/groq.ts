import { Skill, Course, Proficiency, PsychEvaluation, CareerGoal, RoadmapStep, ProficiencyScores, UserProfile } from "../types.js";

const getApiKey = () => {
  return process.env.GROQ_API_KEY || "";
};

const callGroq = async (systemPrompt: string, userPrompt: string, isJson: boolean = false) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Groq API Key is not set. Please set the GROQ_API_KEY environment variable in your secrets panel or .env.local file.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      response_format: isJson ? { type: "json_object" } : undefined
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content || "";
};

export const getProficiencyCategorization = async (
  skills: Skill[],
  goals: CareerGoal[]
): Promise<ProficiencyScores> => {
  const goalTitles = goals.map(g => g.title).join(", ");
  
  const systemPrompt = `Act as a Senior Technical Career Coach. 
You must categorize the user's proficiency into exactly five categories: Frontend, Backend, DevOps, DataScience, and MachineLearning.
Each score must be an integer between 0 and 100 based on their current skill levels.

Goal Bias Rules:
- If the user mentions 'Full Stack' or related terms in their goals, weight Backend and Frontend higher.
- If they mention 'AI/ML' or 'Artificial Intelligence' or related terms, identify gaps in Linear Algebra, Python, or Model Deployment and adjust scores accordingly.

You MUST respond with a JSON object in this exact format:
{
  "Frontend": number,
  "Backend": number,
  "DevOps": number,
  "DataScience": number,
  "MachineLearning": number
}`;

  const userPrompt = `Skills: ${JSON.stringify(skills)}
Goals: "${goalTitles}"`;

  const text = await callGroq(systemPrompt, userPrompt, true);
  try {
    return JSON.parse(text || "{}");
  } catch (e) {
    console.error("Failed to parse Proficiency JSON", text);
    throw new Error("Failed to parse proficiency scores from AI response.");
  }
};

export const generateRoadmap = async (skills: Skill[], goal: CareerGoal): Promise<RoadmapStep[]> => {
  const systemPrompt = `Act as an expert technical curriculum designer.
Based on the user's current skills and their career goal (with a target date), create a chronological learning roadmap with 4-6 specific milestones.
Each milestone should have a title, a realistic deadline (relative to today or specific dates in YYYY-MM-DD format before the target date), a list of specific skills to acquire, the tech stack involved, and a brief description.

You MUST respond with a JSON array of objects in this exact format:
[
  {
    "id": "milestone-1",
    "title": "Milestone Title",
    "deadline": "YYYY-MM-DD",
    "skills": ["Skill 1", "Skill 2"],
    "techStack": ["React", "TypeScript"],
    "description": "Milestone description..."
  }
]`;

  const userPrompt = `Current Date: ${new Date().toISOString().split('T')[0]}
Current Skills: ${JSON.stringify(skills)}
Career Goal: "${goal.title}" (Target Date: ${goal.targetDate}, Description: ${goal.description})`;

  const text = await callGroq(systemPrompt, userPrompt, true);
  try {
    const steps = JSON.parse(text || "[]");
    return steps.map((step: any) => ({ ...step, status: 'pending' }));
  } catch (e) {
    console.error("Failed to parse Roadmap JSON", text);
    throw new Error("Failed to generate learning roadmap from AI response.");
  }
};

export const generatePsychReport = async (
  answers: { question: string, answer: string }[],
  userProfile: any
): Promise<PsychEvaluation> => {
  const systemPrompt = `Act as an expert Occupational Psychologist and Career Coach.
Analyze the user's psychological assessment answers alongside their technical profile.
Generate a detailed psychological career report in beautiful Markdown. Be professional, insightful, and provide specific behavioral advice.
Also provide scores (integers from 0-100) for: leadership, collaboration, innovation, resilience, and analytical.

You MUST respond with a JSON object in this exact format:
{
  "report": "Detailed markdown report content...",
  "scores": {
    "leadership": number,
    "collaboration": number,
    "innovation": number,
    "resilience": number,
    "analytical": number
  }
}`;

  const userPrompt = `User Profile: ${JSON.stringify(userProfile)}
Survey Answers: ${JSON.stringify(answers)}`;

  const text = await callGroq(systemPrompt, userPrompt, true);
  try {
    const data = JSON.parse(text || "{}");
    return {
      ...data,
      date: new Date().toISOString()
    };
  } catch (e) {
    console.error("Failed to parse Psych Report JSON", text);
    throw new Error("Failed to generate psychological evaluation from AI response.");
  }
};

export const getCareerCounseling = async (
  message: string,
  history: { role: 'user' | 'model', text: string }[],
  userProfile: UserProfile,
  roadmap: RoadmapStep[]
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Groq API Key is not set.");
  }

  const systemInstruction = `You are an expert Career Counselor ("Zohaib's Path Counselor"). Your goal is to help users navigate their professional journey.
  
Current User Profile: ${JSON.stringify(userProfile)}
Current Roadmap: ${JSON.stringify(roadmap)}

When generating advice, pay close attention to:
1. **Proficiency Scores**: Use the 'proficiencyScores' (Frontend, Backend, DevOps, DataScience, MachineLearning) to identify strengths and weaknesses. Reference their score and suggest ways to improve or leverage them.
2. **Roadmap Progress**: Reference the user's 'roadmap' milestones. Suggest the next logical step from their roadmap.
3. **Skill Gaps**: Compare their current skills against their career goals.
4. **Industry Trends**: Provide context on how their current skills and goals align with the market.
5. **Empathetic Strategy**: Provide actionable, empathetic, and strategic advice on networking, resume, interview tips, and salary negotiation.

Keep responses concise, warm, professional, and formatted in clean Markdown.`;

  // Map history roles: 'model' -> 'assistant'
  const messages = [
    { role: "system", content: systemInstruction },
    ...history.slice(-10).map(h => ({
      role: h.role === "model" ? "assistant" as const : "user" as const,
      content: h.text
    })),
    { role: "user" as const, content: message }
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content || "";
};

export const evaluateSkillsAndSuggestCourses = async (
  skills: Skill[],
  goal: string
): Promise<{
  evaluation: string;
  suggestedCourses: Course[];
}> => {
  const systemPrompt = `Act as an expert technical mentor.
Evaluate the user's technical skills against their career goal.
Provide a brief evaluation summary of the skill gaps, and suggest 3-4 specific online courses from platforms like Coursera, Udemy, edX, etc. to bridge the gaps.

You MUST respond with a JSON object in this exact format:
{
  "evaluation": "Summary of the skill gap analysis.",
  "suggestedCourses": [
    {
      "id": "course-1",
      "title": "Course Title",
      "provider": "Coursera / Udemy / edX",
      "url": "https://example.com/course",
      "difficulty": "Beginner / Intermediate / Advanced / Expert",
      "description": "Brief description of the course content.",
      "relevance": "Why this course is recommended for their goals."
    }
  ]
}`;

  const userPrompt = `Skills: ${JSON.stringify(skills)}
Goal: "${goal}"`;

  const text = await callGroq(systemPrompt, userPrompt, true);
  try {
    return JSON.parse(text || "{}");
  } catch (e) {
    console.error("Failed to parse Skill Evaluation JSON", text);
    throw new Error("Failed to evaluate skills and suggest courses from AI response.");
  }
};
