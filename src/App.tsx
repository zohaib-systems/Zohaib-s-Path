/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Target, 
  BookOpen, 
  Plus, 
  Trash2, 
  Send, 
  Sparkles, 
  ChevronRight,
  TrendingUp,
  Award,
  BrainCircuit,
  User,
  X,
  Flag,
  Calendar,
  Edit2,
  ClipboardCheck,
  ShieldCheck,
  Zap,
  Users,
  Lightbulb,
  Shield,
  BarChart3,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import Markdown from 'react-markdown';
import { Skill, Course, Proficiency, UserProfile, ChatMessage, PsychEvaluation, RoadmapStep, CareerGoal, ProficiencyScores } from './types.js';
import { getCareerCounseling, evaluateSkillsAndSuggestCourses, generatePsychReport, generateRoadmap, getProficiencyCategorization } from './services/gemini.js';
import { cn } from './lib/utils.js';

const INITIAL_SKILLS: Skill[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'skills' | 'goals' | 'counselor' | 'courses' | 'psych' | 'settings'>('dashboard');
  const [user, setUser] = useState<any>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isMongoConnected, setIsMongoConnected] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Guest User',
    currentRole: 'Software Engineer',
    skills: INITIAL_SKILLS,
    goals: [{ 
      title: 'Senior Software Architect', 
      targetDate: '2026-12-01', 
      description: 'Lead large-scale system designs and mentor teams.' 
    }],
    learningHours: 0
  });
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello Zohaib! I am your AI Career Counselor. How can I help you advance your career today?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [evaluation, setEvaluation] = useState<string>('');
  const [suggestedCourses, setSuggestedCourses] = useState<Course[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapStep[]>([]);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoalIndex, setEditingGoalIndex] = useState<number | null>(null);
  const [selectedGoalIndex, setSelectedGoalIndex] = useState(0);
  const [newGoal, setNewGoal] = useState({ title: '', targetDate: '', description: '' });

  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', category: 'Tech' });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Notification and Confirmation state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Psych Test State
  const [currentPsychStep, setCurrentPsychStep] = useState(0);
  const [psychAnswers, setPsychAnswers] = useState<string[]>([]);
  const [isGeneratingPsychReport, setIsGeneratingPsychReport] = useState(false);
  const [isAnalyzingProficiency, setIsAnalyzingProficiency] = useState(false);

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const hasGeminiKey = Boolean(GEMINI_API_KEY);

  // Fetch User on Mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const text = await res.text();
          try {
            const status = JSON.parse(text);
            setIsMongoConnected(status.mongodb);
          } catch (e) {
            console.error('Failed to parse status JSON', text);
          }
        }
      } catch (err) {
        console.error('Status check failed', err);
      }
    };
    
    // Load local data first for immediate UI feedback
    const localData = localStorage.getItem('career_counselor_data');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (parsed.userProfile) {
          setUserProfile(prev => ({ 
            ...prev, 
            ...parsed.userProfile,
            // Ensure goals are preserved if they exist in local storage
            goals: parsed.userProfile.goals || prev.goals 
          }));
        }
        if (parsed.chatMessages) setChatMessages(parsed.chatMessages);
        if (parsed.evaluation) setEvaluation(parsed.evaluation);
        if (parsed.suggestedCourses) setSuggestedCourses(parsed.suggestedCourses);
        if (parsed.roadmap) setRoadmap(parsed.roadmap);
      } catch (e) {
        console.error('Failed to parse local data', e);
      }
    }

    checkStatus();
    fetchUser();
    
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      // Validate origin is from AI Studio preview or localhost
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchUser();
        setNotification({ message: "Successfully logged in!", type: 'success' });
      }
    };
    
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse user JSON', text);
          return;
        }
        
        setUser(data);
        // Sync state from DB
        setUserProfile({
          name: data.name || 'Guest User',
          currentRole: data.currentRole || 'Software Engineer',
          skills: data.skills || [],
          goals: data.goals || [],
          psychEvaluation: data.psychEvaluation,
          proficiencyScores: data.proficiencyScores,
          learningHours: data.learningHours || 0
        });
        if (data.chatMessages?.length > 0) setChatMessages(data.chatMessages);
        if (data.evaluation) setEvaluation(data.evaluation);
        if (data.suggestedCourses) setSuggestedCourses(data.suggestedCourses);
        if (data.roadmap) setRoadmap(data.roadmap);
      } else {
        // Not logged in, ensure name is Guest
        setUserProfile(prev => ({ ...prev, name: prev.name === 'Guest User' ? 'Guest User' : prev.name }));
      }
    } catch (err) {
      console.error('Failed to fetch user', err);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleLogin = async () => {
    // Open the window immediately to avoid popup blockers
    const authWindow = window.open('about:blank', 'google_auth', 'width=600,height=700');
    if (!authWindow) {
      setNotification({ message: "Popup blocked! Please allow popups for this site.", type: 'error' });
      return;
    }
    
    try {
      const res = await fetch('/api/auth/url');
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned invalid response: ${text.substring(0, 100)}...`);
      }
      
      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }
      authWindow.location.href = data.url;
    } catch (err: any) {
      console.error('Login failed', err);
      authWindow.close();
      setNotification({ message: err.message || "Login failed. Please try again.", type: 'error' });
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    window.location.reload();
  };

  // Persistence Effect (Sync to DB if logged in, otherwise localStorage)
  useEffect(() => {
    // Prevent syncing default state over server data during initial load
    if (isLoadingUser) return;

    const dataToSync = { 
      userProfile, 
      chatMessages, 
      evaluation, 
      suggestedCourses, 
      roadmap 
    };

    if (user) {
      const syncData = async () => {
        try {
          await fetch('/api/user/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              name: userProfile.name, 
              currentRole: userProfile.currentRole,
              skills: userProfile.skills,
              goals: userProfile.goals,
              chatMessages: chatMessages,
              evaluation, 
              suggestedCourses, 
              roadmap,
              psychEvaluation: userProfile.psychEvaluation,
              proficiencyScores: userProfile.proficiencyScores
            })
          });
          // Also update local storage as a backup
          localStorage.setItem('career_counselor_data', JSON.stringify(dataToSync));
        } catch (err) {
          console.error('Sync failed', err);
        }
      };

      const timeoutId = setTimeout(syncData, 1000); 
      return () => clearTimeout(timeoutId);
    } else {
      // Guest user - save to localStorage
      localStorage.setItem('career_counselor_data', JSON.stringify(dataToSync));
    }
  }, [userProfile, chatMessages, evaluation, suggestedCourses, roadmap, user, isLoadingUser]);

  const resetApp = async () => {
    setConfirmModal({
      title: 'Reset All Data',
      message: 'Are you sure you want to reset all your data? This cannot be undone.',
      onConfirm: async () => {
        if (user) {
          try {
            await fetch('/api/user/reset', { method: 'POST' });
            window.location.reload();
          } catch (err) {
            console.error('Failed to reset cloud data', err);
            setNotification({ message: 'Failed to reset cloud data. Please try again.', type: 'error' });
          }
        } else {
          localStorage.clear();
          window.location.reload();
        }
      }
    });
  };

  const PSYCH_QUESTIONS = [
    { q: "When faced with a complex technical problem, do you prefer to dive into the code immediately or spend time architecting the solution on paper?", options: ["Dive into code", "Architect first", "Balanced approach"] },
    { q: "How do you typically handle critical feedback on your work during a code review?", options: ["Take it personally but improve", "View it as a learning opportunity", "Defend my choices if I believe I'm right"] },
    { q: "In a team setting, are you more likely to lead the discussion or support the implementation of others' ideas?", options: ["Lead discussion", "Support implementation", "Facilitate consensus"] },
    { q: "What motivates you more: solving a difficult technical challenge or seeing your product used by millions?", options: ["Technical challenge", "User impact", "Both equally"] },
    { q: "How do you feel about working in a high-pressure environment with tight deadlines?", options: ["Thrive under pressure", "Prefer steady pace", "Depends on the project"] },
    { q: "When a project fails, what is your first reaction?", options: ["Analyze what went wrong", "Focus on the next steps", "Feel discouraged"] },
    { q: "How much do you value autonomy versus clear guidance in your daily work?", options: ["Full autonomy", "Clear guidance", "Mix of both"] }
  ];

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMsg = inputMessage;
    setInputMessage('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await getCareerCounseling(userMsg, chatMessages, userProfile, roadmap);
      setChatMessages(prev => [...prev, { role: 'model', text: response || 'I am sorry, I could not process that.' }]);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message?.includes('max tokens') 
        ? 'The response was too long for the AI to complete. Try asking a more specific question.'
        : 'An error occurred while talking to the AI. Please check your API key and connection.';
      setChatMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
      setNotification({ message: "AI Counselor error. Check chat for details.", type: 'error' });
    } finally {
      setIsTyping(false);
    }
  };

  const runEvaluation = async (goalIndex: number = selectedGoalIndex, specificGoal?: CareerGoal) => {
    const goal = specificGoal || userProfile.goals[goalIndex];
    if (!goal) {
      setNotification({ message: "Please add a career goal first.", type: 'info' });
      return;
    }

    setIsLoadingEvaluation(true);
    setIsLoadingRoadmap(true);
    setActiveTab('courses');
    setSelectedGoalIndex(goalIndex);
    try {
      const [evalResult, roadmapResult] = await Promise.all([
        evaluateSkillsAndSuggestCourses(userProfile.skills, goal.title || 'Career Growth'),
        generateRoadmap(userProfile.skills, goal)
      ]);
      setEvaluation(evalResult.evaluation);
      setSuggestedCourses(evalResult.suggestedCourses);
      setRoadmap(roadmapResult);
      setNotification({ message: "Evaluation and roadmap generated!", type: 'success' });
    } catch (error: any) {
      console.error(error);
      setNotification({ 
        message: error.message?.includes('max tokens') 
          ? "Generation failed: Response too long. Try simplifying your goals." 
          : "Failed to generate evaluation. Check your AI configuration.", 
        type: 'error' 
      });
    } finally {
      setIsLoadingEvaluation(false);
      setIsLoadingRoadmap(false);
    }
  };

  const updateLearningHours = async (hours: number) => {
    const newHours = (userProfile.learningHours || 0) + hours;
    setUserProfile(prev => ({ ...prev, learningHours: newHours }));
    
    if (user) {
      try {
        await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ learningHours: newHours })
        });
        setNotification({ message: `Added ${hours} learning hours!`, type: 'success' });
      } catch (err) {
        console.error('Failed to update hours', err);
      }
    } else {
      setNotification({ message: `Locally added ${hours} hours. Login to sync!`, type: 'info' });
    }
  };
  const runProficiencyAnalysis = async () => {
    if (userProfile.skills.length === 0) {
      setNotification({ message: "Please add some skills first to analyze your proficiency.", type: 'info' });
      return;
    }
    setIsAnalyzingProficiency(true);
    try {
      const scores = await getProficiencyCategorization(userProfile.skills, userProfile.goals);
      setUserProfile(prev => ({ ...prev, proficiencyScores: scores }));
      setNotification({ message: "Proficiency analysis complete!", type: 'success' });
    } catch (error) {
      console.error(error);
      setNotification({ message: "Failed to analyze proficiency. Please try again.", type: 'error' });
    } finally {
      setIsAnalyzingProficiency(false);
    }
  };

  const addOrUpdateGoal = () => {
    if (!newGoal.title) return;

    const goalToProcess = { ...newGoal };

    setUserProfile(prev => {
      const updatedGoals = [...prev.goals];
      if (editingGoalIndex !== null) {
        updatedGoals[editingGoalIndex] = goalToProcess;
      } else {
        updatedGoals.push(goalToProcess);
      }
      return { ...prev, goals: updatedGoals };
    });

    // Automatically trigger evaluation for the new/updated goal
    const targetIndex = editingGoalIndex === null ? userProfile.goals.length : editingGoalIndex;
    runEvaluation(targetIndex, goalToProcess);

    setIsGoalModalOpen(false);
    setEditingGoalIndex(null);
    setNewGoal({ title: '', targetDate: '', description: '' });
  };

  const getProgressData = () => {
    if (roadmap.length === 0) return [];
    let completedCount = 0;
    return roadmap.map((step, index) => {
      if (step.status === 'completed') completedCount++;
      return {
        name: `Milestone ${index + 1}`,
        progress: Math.round((completedCount / roadmap.length) * 100),
        title: step.title,
        status: step.status
      };
    });
  };

  const progressPercentage = roadmap.length > 0 
    ? Math.round((roadmap.filter(s => s.status === 'completed').length / roadmap.length) * 100)
    : 0;

  const toggleRoadmapStep = (stepId: string) => {
    setRoadmap(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status: step.status === 'completed' ? 'pending' : 'completed' } 
        : step
    ));
  };

  const removeGoal = (index: number) => {
    setUserProfile(prev => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index)
    }));
    if (selectedGoalIndex === index) setSelectedGoalIndex(0);
  };

  const openEditGoal = (index: number) => {
    setEditingGoalIndex(index);
    setNewGoal(userProfile.goals[index]);
    setIsGoalModalOpen(true);
  };

  const handlePsychAnswer = async (answer: string) => {
    const updatedAnswers = [...psychAnswers, answer];
    setPsychAnswers(updatedAnswers);

    if (currentPsychStep < PSYCH_QUESTIONS.length - 1) {
      setCurrentPsychStep(prev => prev + 1);
    } else {
      setIsGeneratingPsychReport(true);
      try {
        const formattedAnswers = PSYCH_QUESTIONS.map((q, i) => ({
          question: q.q,
          answer: updatedAnswers[i]
        }));
        const report = await generatePsychReport(formattedAnswers, userProfile);
        setUserProfile(prev => ({ ...prev, psychEvaluation: report }));
        setNotification({ message: "Psychological report generated!", type: 'success' });
      } catch (error: any) {
        console.error(error);
        setNotification({ 
          message: error.message?.includes('max tokens') 
            ? "Report generation failed: Content too long." 
            : "Failed to generate psych report.", 
          type: 'error' 
        });
      } finally {
        setIsGeneratingPsychReport(false);
      }
    }
  };

  const addSkill = (name: string, category: string) => {
    const newSkill: Skill = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      category,
      level: 10,
      proficiency: Proficiency.BEGINNER
    };
    setUserProfile(prev => ({ ...prev, skills: [...prev.skills, newSkill] }));
  };

  const updateSkillLevel = (id: string, level: number) => {
    setUserProfile(prev => ({
      ...prev,
      skills: prev.skills.map(s => {
        if (s.id === id) {
          let proficiency = Proficiency.BEGINNER;
          if (level > 80) proficiency = Proficiency.EXPERT;
          else if (level > 60) proficiency = Proficiency.ADVANCED;
          else if (level > 30) proficiency = Proficiency.INTERMEDIATE;
          return { ...s, level, proficiency };
        }
        return s;
      })
    }));
  };

  const removeSkill = (id: string) => {
    setUserProfile(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s.id !== id)
    }));
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Syncing your career path...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen font-sans flex flex-col md:flex-row overflow-hidden transition-colors duration-300",
      darkMode ? "bg-[#0F172A] text-slate-100" : "bg-[#F8F9FA] text-slate-900"
    )}>
      {/* Mobile Header */}
      <div className={cn(
        "md:hidden flex items-center justify-between p-4 z-40 border-b transition-colors",
        darkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <BrainCircuit size={18} />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Zohaib's Path</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <nav className={cn(
        "fixed md:relative inset-y-0 left-0 z-50 w-72 md:w-64 flex flex-col p-6 shrink-0 transition-all duration-300 md:translate-x-0 border-r h-full",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        darkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-3 py-4 mb-8 shrink-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <BrainCircuit size={24} />
          </div>
          <h1 className={cn("font-bold text-xl tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Zohaib's Path</h1>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-2 -mr-2 custom-scrollbar pb-24">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            darkMode={darkMode}
          />
          <NavItem 
            active={activeTab === 'skills'} 
            onClick={() => { setActiveTab('skills'); setIsMobileMenuOpen(false); }} 
            icon={<Target size={20} />} 
            label="Skills Tracker" 
            darkMode={darkMode}
          />
          <NavItem 
            active={activeTab === 'goals'} 
            onClick={() => { setActiveTab('goals'); setIsMobileMenuOpen(false); }} 
            icon={<Flag size={20} />} 
            label="Career Goals" 
            darkMode={darkMode}
          />
          <NavItem 
            active={activeTab === 'psych'} 
            onClick={() => { setActiveTab('psych'); setIsMobileMenuOpen(false); }} 
            icon={<ClipboardCheck size={20} />} 
            label="Psych Evaluation" 
            darkMode={darkMode}
          />
          <NavItem 
            active={activeTab === 'counselor'} 
            onClick={() => { setActiveTab('counselor'); setIsMobileMenuOpen(false); }} 
            icon={<MessageSquare size={20} />} 
            label="AI Counselor" 
            darkMode={darkMode}
          />
          <NavItem 
            active={activeTab === 'courses'} 
            onClick={() => { setActiveTab('courses'); setIsMobileMenuOpen(false); }} 
            icon={<BookOpen size={20} />} 
            label="Learning Path" 
            darkMode={darkMode}
          />
        </div>

        {/* Sync Status in Sidebar */}
        <div className={cn(
          "mt-auto p-4 rounded-2xl mx-2 mb-4 text-xs space-y-2",
          darkMode ? "bg-slate-800/50" : "bg-slate-50"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Cloud Sync</span>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isMongoConnected ? "bg-emerald-500" : "bg-amber-500"
              )} />
              <span className={cn("font-medium", isMongoConnected ? "text-emerald-600" : "text-amber-600")}>
                {isMongoConnected ? "Connected" : "Offline"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Auth Status</span>
            <span className={cn("font-medium", user ? "text-indigo-600" : "text-slate-400")}>
              {user ? "Authenticated" : "Guest Mode"}
            </span>
          </div>
          {!user && (
            <button 
              onClick={handleLogin}
              className="w-full mt-2 py-1.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
            >
              Login to Sync
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              {!user && (
                <div className={cn(
                  "p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 mb-8",
                  darkMode ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-100"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className={cn("font-bold", darkMode ? "text-indigo-400" : "text-indigo-900")}>Cloud Sync Disabled</h4>
                      <p className="text-sm text-slate-500">Login with Google to save your progress and access it from any device.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsProfileModalOpen(true)}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 whitespace-nowrap"
                  >
                    Connect Now
                  </button>
                </div>
              )}

              <header>
                <h2 className="text-3xl font-bold tracking-tight">Welcome back, {userProfile.name}!</h2>
                <p className="text-slate-500 mt-1">Here's your career progress at a glance.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title="Skills Tracked" 
                  value={userProfile.skills.length} 
                  icon={<Target className="text-indigo-600" />} 
                  trend="+2 this month"
                  darkMode={darkMode}
                />
                <StatCard 
                  title="Current Goal" 
                  value={userProfile.goals[selectedGoalIndex]?.title || 'None'} 
                  icon={<TrendingUp className="text-emerald-600" />} 
                  trend={userProfile.goals[selectedGoalIndex]?.targetDate ? `Target: ${userProfile.goals[selectedGoalIndex].targetDate}` : "No date set"}
                  darkMode={darkMode}
                />
                <StatCard 
                  title="Learning Hours" 
                  value={userProfile.learningHours?.toString() || "0"} 
                  icon={<BookOpen className="text-amber-600" />} 
                  trend="+4.2h vs last week"
                  darkMode={darkMode}
                  action={
                    <div className="flex gap-1 mt-2">
                      {[0.5, 1, 2].map(h => (
                        <button 
                          key={h}
                          onClick={() => updateLearningHours(h)}
                          className={cn(
                            "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                            darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                          )}
                        >
                          +{h}h
                        </button>
                      ))}
                    </div>
                  }
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className={cn(
                  "p-6 rounded-2xl border shadow-sm transition-colors",
                  darkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
                )}>
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Award size={20} className="text-indigo-600" />
                    Skill Distribution
                  </h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={userProfile.skills}>
                        <PolarGrid stroke={darkMode ? "#334155" : "#E2E8F0"} />
                        <PolarAngleAxis dataKey="name" tick={{ fill: darkMode ? '#94A3B8' : '#64748B', fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          name="Skills"
                          dataKey="level"
                          stroke="#4F46E5"
                          fill="#4F46E5"
                          fillOpacity={0.2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={cn(
                  "p-6 rounded-2xl border shadow-sm flex flex-col transition-colors",
                  darkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
                )}>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Sparkles size={20} className="text-amber-500" />
                    Career Insight
                  </h3>
                  <div className="flex-1 flex flex-col justify-center space-y-4">
                    <p className={cn(
                      "leading-relaxed transition-colors",
                      darkMode ? "text-slate-400" : "text-slate-600"
                    )}>
                      {userProfile.skills.length > 0 ? (
                        <>
                          Based on your current skills in <span className="font-semibold text-indigo-400">{userProfile.skills.slice(0, 2).map(s => s.name).join(' and ')}</span>, 
                          you are building a strong foundation. To reach your goal of <span className="font-semibold italic">{userProfile.goals[selectedGoalIndex]?.title || 'Growth'}</span>, 
                          continuous learning is key.
                        </>
                      ) : (
                        <>
                          Start by adding your skills to get personalized career insights and a roadmap to your goal of <span className="font-semibold italic">{userProfile.goals[selectedGoalIndex]?.title || 'Growth'}</span>.
                        </>
                      )}
                    </p>
                    <button 
                      onClick={() => runEvaluation(selectedGoalIndex)}
                      className={cn(
                        "w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 group",
                        darkMode ? "bg-slate-100 text-slate-900 hover:bg-white" : "bg-slate-900 text-white hover:bg-slate-800"
                      )}
                    >
                      Evaluate Goal Progress
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border shadow-sm transition-colors",
                darkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
              )}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <ShieldCheck size={20} className="text-indigo-600" />
                    Technical Proficiency Analysis
                  </h3>
                  <button 
                    onClick={runProficiencyAnalysis}
                    disabled={isAnalyzingProficiency}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isAnalyzingProficiency ? <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div> : <Zap size={14} />}
                    {userProfile.proficiencyScores ? 'Re-analyze' : 'Analyze Now'}
                  </button>
                </div>
                
                {userProfile.proficiencyScores ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Frontend', score: userProfile.proficiencyScores.Frontend },
                        { name: 'Backend', score: userProfile.proficiencyScores.Backend },
                        { name: 'DevOps', score: userProfile.proficiencyScores.DevOps },
                        { name: 'Data Sci', score: userProfile.proficiencyScores.DataScience },
                        { name: 'ML', score: userProfile.proficiencyScores.MachineLearning },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#334155" : "#f1f5f9"} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: darkMode ? '#94A3B8' : '#64748B', fontSize: 12 }} />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip 
                          cursor={{ fill: darkMode ? '#334155' : '#f8fafc' }}
                          contentStyle={{ 
                            backgroundColor: darkMode ? '#1E293B' : '#FFFFFF',
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            color: darkMode ? '#F1F5F9' : '#0F172A'
                          }}
                        />
                        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                          {
                            [0, 1, 2, 3, 4].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#4F46E5', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'][index]} />
                            ))
                          }
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className={cn(
                    "h-64 flex flex-col items-center justify-center text-center space-y-3 rounded-xl border border-dashed transition-colors",
                    darkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  )}>
                    <div className={cn(
                      "p-3 rounded-full shadow-sm",
                      darkMode ? "bg-slate-800" : "bg-white"
                    )}>
                      <BrainCircuit size={24} className="text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 max-w-[200px]">
                      Get a breakdown of your technical proficiency across key domains.
                    </p>
                    <button 
                      onClick={runProficiencyAnalysis}
                      disabled={isAnalyzingProficiency}
                      className="text-sm font-bold text-indigo-400 hover:underline disabled:opacity-50"
                    >
                      {isAnalyzingProficiency ? 'Analyzing...' : 'Start Analysis'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'skills' && (
            <motion.div 
              key="skills"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={cn("text-3xl font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Skills Tracker</h2>
                  <p className="text-slate-500 mt-1">Manage and update your professional skill set.</p>
                </div>
                <button 
                  onClick={() => setIsSkillModalOpen(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  <Plus size={20} /> Add Skill
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {userProfile.skills.map((skill) => (
                  <div key={skill.id} className={cn(
                    "p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center gap-6 group transition-colors",
                    darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                  )}>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h4 className={cn("font-bold text-lg", darkMode ? "text-slate-100" : "text-slate-900")}>{skill.name}</h4>
                          <span className={cn(
                            "px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-md",
                            darkMode ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-600"
                          )}>
                            {skill.category}
                          </span>
                        </div>
                        <span className={cn(
                          "text-xs font-bold px-2 py-1 rounded-full",
                          skill.proficiency === Proficiency.EXPERT ? (darkMode ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-700") :
                          skill.proficiency === Proficiency.ADVANCED ? (darkMode ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-100 text-indigo-700") :
                          skill.proficiency === Proficiency.INTERMEDIATE ? (darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700") :
                          (darkMode ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-700")
                        )}>
                          {skill.proficiency}
                        </span>
                      </div>
                      <div className={cn("relative h-2 rounded-full overflow-hidden", darkMode ? "bg-slate-700" : "bg-slate-100")}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${skill.level}%` }}
                          className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={skill.level} 
                        onChange={(e) => updateSkillLevel(skill.id, parseInt(e.target.value))}
                        className="w-32 accent-indigo-600"
                      />
                      <button 
                        onClick={() => removeSkill(skill.id)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          darkMode ? "text-slate-500 hover:text-amber-400 hover:bg-amber-400/10" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                        )}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'goals' && (
            <motion.div 
              key="goals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={cn("text-3xl font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Career Goals</h2>
                  <p className="text-slate-500 mt-1">Define and manage your professional milestones.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingGoalIndex(null);
                    setNewGoal({ title: '', targetDate: '', description: '' });
                    setIsGoalModalOpen(true);
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  <Plus size={20} /> Add Goal
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {userProfile.goals.map((goal, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "p-6 rounded-3xl border transition-all flex flex-col relative group",
                      selectedGoalIndex === idx 
                        ? (darkMode ? "bg-slate-800 border-indigo-500 ring-1 ring-indigo-500" : "bg-white border-indigo-600 ring-1 ring-indigo-600") 
                        : (darkMode ? "bg-slate-800 border-slate-700 shadow-sm" : "bg-white border-slate-200 shadow-sm")
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "p-2 rounded-lg",
                          selectedGoalIndex === idx 
                            ? "bg-indigo-600 text-white" 
                            : (darkMode ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500")
                        )}>
                          <Flag size={20} />
                        </div>
                        {selectedGoalIndex === idx && (
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Active Focus</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditGoal(idx)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            darkMode ? "text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          )}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => removeGoal(idx)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            darkMode ? "text-slate-500 hover:text-amber-400 hover:bg-amber-400/10" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                          )}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <h4 className={cn("font-bold text-xl mb-2", darkMode ? "text-slate-100" : "text-slate-900")}>{goal.title}</h4>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                      <Calendar size={14} />
                      <span>Target: {goal.targetDate || 'No date set'}</span>
                    </div>
                    <p className={cn("text-sm mb-6 line-clamp-3 flex-1", darkMode ? "text-slate-400" : "text-slate-600")}>
                      {goal.description || 'No description provided.'}
                    </p>
                    <button 
                      onClick={() => setSelectedGoalIndex(idx)}
                      className={cn(
                        "w-full py-2 rounded-xl font-semibold text-sm transition-all",
                        selectedGoalIndex === idx 
                          ? (darkMode ? "bg-indigo-900/30 text-indigo-400 cursor-default" : "bg-indigo-50 text-indigo-700 cursor-default") 
                          : (darkMode ? "bg-slate-700 text-white hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-800")
                      )}
                    >
                      {selectedGoalIndex === idx ? 'Currently Focused' : 'Set as Primary Focus'}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <header>
                <h2 className="text-3xl font-bold tracking-tight">Settings & Configuration</h2>
                <p className="text-slate-500 mt-1">Manage your account and application setup.</p>
              </header>

              <div className={cn(
                "p-6 rounded-2xl border shadow-sm space-y-6 transition-colors",
                darkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h4 className={cn("font-bold transition-colors", darkMode ? "text-white" : "text-slate-900")}>Appearance</h4>
                      <p className="text-xs text-slate-500">Switch between light and dark themes.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className={cn(
                      "px-4 py-2 rounded-xl font-bold transition-all",
                      darkMode ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {darkMode ? 'Dark Mode' : 'Light Mode'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className={cn("font-bold transition-colors", darkMode ? "text-white" : "text-slate-900")}>Cloud Sync</h4>
                      <p className="text-xs text-slate-500">{isMongoConnected ? 'Connected to MongoDB' : 'Cloud Sync Active'}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h4 className={cn("font-bold mb-4 flex items-center gap-2 transition-colors", darkMode ? "text-white" : "text-slate-900")}>
                    <Zap size={18} className="text-amber-500" />
                    Setup Guide
                  </h4>
                  <div className="space-y-4">
                    <div className={cn(
                      "p-4 rounded-xl border transition-colors",
                      darkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    )}>
                      <h5 className={cn("text-sm font-bold mb-2 transition-colors", darkMode ? "text-white" : "text-slate-900")}>1. Google OAuth Setup</h5>
                      <p className="text-xs text-slate-500 leading-relaxed mb-3">
                        To enable Google Login, add your credentials to the Secrets panel (⚙️ gear icon):
                      </p>
                      <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                        <li><code>GOOGLE_CLIENT_ID</code></li>
                        <li><code>GOOGLE_CLIENT_SECRET</code></li>
                        <li><code>SESSION_SECRET</code> (any random string)</li>
                      </ul>
                      <p className="text-xs text-slate-500 mt-3">
                        Add these Redirect URIs to your Google Cloud Console:
                        <br />
                        <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded mt-1 block break-all">
                          {window.location.origin}/auth/google/callback
                        </code>
                      </p>
                    </div>

                    <div className={cn(
                      "p-4 rounded-xl border transition-colors",
                      darkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                    )}>
                      <h5 className={cn("text-sm font-bold mb-2 transition-colors", darkMode ? "text-white" : "text-slate-900")}>2. MongoDB Atlas Setup</h5>
                      <p className="text-xs text-slate-500 leading-relaxed mb-2">
                        For data persistence, add your connection string:
                      </p>
                      <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                        <li><code>MONGODB_URI</code></li>
                      </ul>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                        ⚠️ Ensure you have whitelisted "0.0.0.0/0" in your MongoDB Atlas Network Access.
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        <strong>Note:</strong> If your password contains special characters (@, #, $), they must be <strong>URL-encoded</strong> (e.g., @ as %40).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={resetApp}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold transition-all border",
                      darkMode 
                        ? "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700" 
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    Reset All Application Data
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'psych' && (
            <motion.div 
              key="psych"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              {!userProfile.psychEvaluation && !isGeneratingPsychReport && psychAnswers.length === 0 && (
                <div className={cn(
                  "p-12 rounded-3xl border shadow-xl text-center space-y-6 transition-colors",
                  darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                )}>
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                    darkMode ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                  )}>
                    <ShieldCheck size={40} />
                  </div>
                  <div className="space-y-2">
                    <h2 className={cn("text-3xl font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Psychological Career Assessment</h2>
                    <p className="text-slate-500 max-w-lg mx-auto">
                      Discover your professional personality, risk tolerance, and behavioral patterns to optimize your career path.
                    </p>
                  </div>
                  <button 
                    onClick={() => setCurrentPsychStep(0)}
                    className={cn(
                      "px-8 py-3 rounded-2xl font-bold transition-all shadow-lg",
                      darkMode 
                        ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-900/20" 
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                    )}
                  >
                    Start Assessment
                  </button>
                </div>
              )}

              {!userProfile.psychEvaluation && !isGeneratingPsychReport && (psychAnswers.length > 0 || currentPsychStep >= 0) && currentPsychStep < PSYCH_QUESTIONS.length && (
                <div className={cn(
                  "p-8 rounded-3xl border shadow-xl space-y-8 transition-colors",
                  darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Question {currentPsychStep + 1} of {PSYCH_QUESTIONS.length}</span>
                    <div className={cn("w-32 h-1.5 rounded-full overflow-hidden transition-colors", darkMode ? "bg-slate-700" : "bg-slate-100")}>
                      <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${((currentPsychStep + 1) / PSYCH_QUESTIONS.length) * 100}%` }} />
                    </div>
                  </div>
                  <h3 className={cn("text-2xl font-bold leading-tight", darkMode ? "text-slate-100" : "text-slate-900")}>{PSYCH_QUESTIONS[currentPsychStep].q}</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {PSYCH_QUESTIONS[currentPsychStep].options.map((option, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handlePsychAnswer(option)}
                        className={cn(
                          "p-4 text-left border rounded-2xl transition-all font-medium group flex items-center justify-between",
                          darkMode 
                            ? "border-slate-700 text-slate-300 hover:border-indigo-500 hover:bg-indigo-500/10" 
                            : "border-slate-200 text-slate-700 hover:border-indigo-600 hover:bg-indigo-50/50"
                        )}
                      >
                        {option}
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isGeneratingPsychReport && (
                <div className={cn(
                  "p-12 rounded-3xl border shadow-xl text-center space-y-6 transition-colors",
                  darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                )}>
                  <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                  <div className="space-y-2">
                    <h3 className={cn("text-xl font-bold", darkMode ? "text-white" : "text-slate-900")}>Generating Your Psychological Report</h3>
                    <p className="text-slate-500">Our AI is analyzing your behavioral patterns and work values...</p>
                  </div>
                </div>
              )}

              {userProfile.psychEvaluation && !isGeneratingPsychReport && (
                <div className="space-y-8">
                  <div className={cn(
                    "p-8 rounded-3xl border shadow-xl space-y-8 transition-colors",
                    darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                  )}>
                    <div className="flex items-center justify-between">
                      <h2 className={cn("text-2xl font-bold flex items-center gap-2", darkMode ? "text-white" : "text-slate-900")}>
                        <ShieldCheck className="text-emerald-500" />
                        Psychometric Profile
                      </h2>
                      <button 
                        onClick={() => {
                          setPsychAnswers([]);
                          setCurrentPsychStep(0);
                          setUserProfile(prev => ({ ...prev, psychEvaluation: undefined }));
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors"
                      >
                        Retake Test
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <PsychScore label="Leadership" score={userProfile.psychEvaluation.scores.leadership} icon={<Users size={16} />} color="bg-indigo-500" darkMode={darkMode} />
                      <PsychScore label="Collaboration" score={userProfile.psychEvaluation.scores.collaboration} icon={<Users size={16} />} color="bg-emerald-500" darkMode={darkMode} />
                      <PsychScore label="Innovation" score={userProfile.psychEvaluation.scores.innovation} icon={<Lightbulb size={16} />} color="bg-amber-500" darkMode={darkMode} />
                      <PsychScore label="Resilience" score={userProfile.psychEvaluation.scores.resilience} icon={<Shield size={16} />} color="bg-violet-500" darkMode={darkMode} />
                      <PsychScore label="Analytical" score={userProfile.psychEvaluation.scores.analytical} icon={<BarChart3 size={16} />} color="bg-blue-500" darkMode={darkMode} />
                    </div>

                    <div className={cn(
                      "prose prose-slate max-w-none p-6 rounded-2xl border transition-colors",
                      darkMode 
                        ? "bg-slate-900/50 border-slate-700 prose-invert" 
                        : "bg-slate-50 border-slate-100"
                    )}>
                      <Markdown>{userProfile.psychEvaluation.report}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'counselor' && (
            <motion.div 
              key="counselor"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={cn(
                "max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col rounded-3xl border shadow-xl overflow-hidden transition-colors",
                darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
              )}
            >
              <div className={cn(
                "p-4 border-b flex items-center gap-3 transition-colors",
                darkMode ? "bg-slate-900/50 border-slate-700" : "bg-slate-50/50 border-slate-100"
              )}>
                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <h3 className={cn("font-bold", darkMode ? "text-white" : "text-slate-900")}>AI Career Counselor</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs text-slate-500 font-medium">Online & Ready</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={cn(
                    "flex",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}>
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                      msg.role === 'user' 
                        ? "bg-indigo-600 text-white rounded-tr-none" 
                        : (darkMode ? "bg-slate-700 text-slate-100 rounded-tl-none" : "bg-slate-100 text-slate-800 rounded-tl-none")
                    )}>
                      <div className={cn(
                        "prose prose-sm max-w-none prose-p:leading-relaxed prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0",
                        msg.role === 'user' ? "prose-invert" : (darkMode ? "prose-invert" : "")
                      )}>
                        <Markdown>
                          {msg.text}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className={cn(
                      "p-4 rounded-2xl rounded-tl-none flex gap-1",
                      darkMode ? "bg-slate-700" : "bg-slate-100"
                    )}>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className={cn(
                "p-4 border-t transition-colors",
                darkMode ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-100"
              )}>
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about career growth, skill gaps, or interview tips..."
                    className={cn(
                      "w-full border rounded-2xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm",
                      darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    className="absolute right-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'courses' && (
            <motion.div 
              key="courses"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={cn("text-3xl font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Learning Path</h2>
                  <p className="text-slate-500 mt-1">
                    Suggestions for: <span className={cn("font-bold", darkMode ? "text-indigo-400" : "text-indigo-600")}>{userProfile.goals[selectedGoalIndex]?.title || 'Career Growth'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select 
                    value={selectedGoalIndex}
                    onChange={(e) => runEvaluation(parseInt(e.target.value))}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors",
                      darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}
                  >
                    {userProfile.goals.map((goal, idx) => (
                      <option key={idx} value={idx}>{goal.title}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => runEvaluation(selectedGoalIndex)}
                    disabled={isLoadingEvaluation}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all disabled:opacity-50",
                      darkMode ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700" : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Sparkles size={18} className="text-amber-500" />
                    Refresh Recommendations
                  </button>
                </div>
              </div>

              {isLoadingEvaluation ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className={cn("w-12 h-12 border-4 rounded-full animate-spin", darkMode ? "border-slate-700 border-t-indigo-500" : "border-indigo-200 border-t-indigo-600")} />
                  <p className="text-slate-500 font-medium animate-pulse">Analyzing your skills and goals...</p>
                </div>
              ) : evaluation ? (
                <div className="space-y-8">
                  <div className={cn(
                    "p-6 rounded-3xl border transition-colors",
                    darkMode ? "bg-indigo-900/20 border-indigo-500/30" : "bg-indigo-50 border-indigo-100"
                  )}>
                    <h3 className={cn("font-bold mb-2 flex items-center gap-2 transition-colors", darkMode ? "text-indigo-300" : "text-indigo-900")}>
                      <BrainCircuit size={20} />
                      AI Evaluation Summary
                    </h3>
                    <p className={cn("leading-relaxed transition-colors", darkMode ? "text-indigo-200/80" : "text-indigo-800/80")}>
                      {evaluation}
                    </p>
                  </div>

                  {/* Progress Tracker Section */}
                  {roadmap.length > 0 && (
                    <div className={cn(
                      "p-8 rounded-[2.5rem] border shadow-sm transition-colors",
                      darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                    )}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                          <h3 className={cn("text-2xl font-bold mb-1 flex items-center gap-2 transition-colors", darkMode ? "text-white" : "text-slate-900")}>
                            <TrendingUp className={darkMode ? "text-indigo-400" : "text-indigo-600"} />
                            Progress Analytics
                          </h3>
                          <p className="text-slate-500 text-sm">Visualizing your journey towards {userProfile.goals[selectedGoalIndex]?.title}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={cn("text-3xl font-black transition-colors", darkMode ? "text-indigo-400" : "text-indigo-600")}>{progressPercentage}%</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Overall Completion</div>
                          </div>
                          <div className={cn("w-16 h-16 rounded-full border-4 flex items-center justify-center relative transition-colors", darkMode ? "border-slate-700" : "border-slate-100")}>
                            <svg className="w-full h-full -rotate-90">
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                fill="transparent"
                                stroke="currentColor"
                                strokeWidth="4"
                                className={cn("transition-colors", darkMode ? "text-indigo-400" : "text-indigo-600")}
                                strokeDasharray={175.9}
                                strokeDashoffset={175.9 - (175.9 * progressPercentage) / 100}
                              />
                            </svg>
                            <Award className={cn("transition-colors", darkMode ? "text-indigo-400" : "text-indigo-600")} size={20} />
                          </div>
                        </div>
                      </div>

                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getProgressData()}>
                            <defs>
                              <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#334155" : "#f1f5f9"} />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fontWeight: 600, fill: darkMode ? "#64748b" : "#94a3b8" }}
                              dy={10}
                            />
                            <YAxis 
                              hide 
                              domain={[0, 100]}
                            />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className={cn(
                                      "p-3 border shadow-xl rounded-2xl",
                                      darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                                    )}>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{payload[0].payload.name}</p>
                                      <p className={cn("text-sm font-bold mb-1", darkMode ? "text-slate-100" : "text-slate-900")}>{payload[0].payload.title}</p>
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", darkMode ? "bg-indigo-400" : "bg-indigo-600")}></div>
                                        <p className={cn("text-xs font-medium", darkMode ? "text-indigo-400" : "text-indigo-600")}>{payload[0].value}% Complete</p>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="progress" 
                              stroke="#4f46e5" 
                              strokeWidth={3}
                              fillOpacity={1} 
                              fill="url(#colorProgress)" 
                              animationDuration={1500}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Roadmap Section */}
                  <div className="space-y-6">
                    <h3 className={cn("text-2xl font-bold flex items-center gap-2", darkMode ? "text-white" : "text-slate-900")}>
                      <TrendingUp className={darkMode ? "text-indigo-400" : "text-indigo-600"} />
                      Career Roadmap Milestones
                    </h3>
                    <div className={cn(
                      "relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b",
                      darkMode ? "before:from-transparent before:via-slate-700 before:to-transparent" : "before:from-transparent before:via-slate-300 before:to-transparent"
                    )}>
                      {roadmap.map((step, idx) => (
                        <div key={step.id || idx} className={cn(
                          "relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group",
                          step.status === 'completed' ? "is-completed" : "is-active"
                        )}>
                          {/* Icon */}
                          <div 
                            onClick={() => toggleRoadmapStep(step.id)}
                            className={cn(
                              "flex items-center justify-center w-10 h-10 rounded-full border shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 cursor-pointer transition-all z-10",
                              step.status === 'completed' 
                                ? "bg-emerald-500 text-white border-emerald-200" 
                                : "bg-indigo-600 text-white border-indigo-200",
                              darkMode ? "border-slate-800" : "border-white"
                            )}
                          >
                            {step.status === 'completed' ? <Award size={16} /> : <Zap size={16} />}
                          </div>
                          {/* Content */}
                          <div className={cn(
                            "w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-3xl border transition-all",
                            step.status === 'completed' 
                              ? (darkMode ? "border-emerald-900/30 bg-emerald-900/10 opacity-75" : "border-emerald-100 bg-emerald-50/30 opacity-75") 
                              : (darkMode ? "bg-slate-800 border-slate-700 shadow-sm group-hover:shadow-md" : "bg-white border-slate-200 shadow-sm group-hover:shadow-md")
                          )}>
                            <div className="flex items-center justify-between mb-2">
                              <time className={cn(
                                "font-mono text-xs font-bold uppercase tracking-widest",
                                step.status === 'completed' ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-400"
                              )}>{step.deadline}</time>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Milestone {idx + 1}</span>
                            </div>
                            <h4 className={cn(
                              "font-bold text-lg mb-2",
                              step.status === 'completed' ? "line-through text-slate-500" : (darkMode ? "text-white" : "text-slate-900")
                            )}>{step.title}</h4>
                            <p className="text-slate-500 text-sm mb-4">{step.description}</p>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {step.skills.map((skill, sIdx) => (
                                <span key={sIdx} className={cn(
                                  "px-2 py-0.5 text-[10px] font-bold rounded-md",
                                  step.status === 'completed' 
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                    : "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                                )}>
                                  {skill}
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {step.techStack.map((tech, tIdx) => (
                                <span key={tIdx} className={cn(
                                  "px-2 py-0.5 text-[10px] font-bold rounded-md",
                                  darkMode ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-600"
                                )}>
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {suggestedCourses.map((course) => (
                      <div key={course.id} className={cn(
                        "p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all flex flex-col group",
                        darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                      )}>
                        <div className="flex items-start justify-between mb-4">
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            darkMode ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-600"
                          )}>
                            {course.provider}
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                            course.difficulty === Proficiency.EXPERT ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                            course.difficulty === Proficiency.ADVANCED ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" :
                            course.difficulty === Proficiency.INTERMEDIATE ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                            "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400"
                          )}>
                            {course.difficulty}
                          </span>
                        </div>
                        <h4 className={cn(
                          "font-bold text-lg mb-2 group-hover:text-indigo-600 transition-colors",
                          darkMode ? "text-white group-hover:text-indigo-400" : "text-slate-900"
                        )}>{course.title}</h4>
                        <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                          {course.description}
                        </p>
                        <div className={cn(
                          "mt-auto pt-4 border-t",
                          darkMode ? "border-slate-700" : "border-slate-50"
                        )}>
                          <p className="text-xs text-slate-400 italic mb-4">
                            <span className={cn("font-semibold not-italic", darkMode ? "text-slate-300" : "text-slate-600")}>Why this?</span> {course.relevance}
                          </p>
                          <a 
                            href={course.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={cn(
                              "w-full py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
                              darkMode 
                                ? "bg-slate-900 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white hover:border-slate-600" 
                                : "bg-slate-50 text-slate-900 border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900"
                            )}
                          >
                            View Course <ChevronRight size={16} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "border-2 border-dashed rounded-3xl p-12 text-center transition-colors",
                  darkMode ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200"
                )}>
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors",
                    darkMode ? "bg-slate-800 text-slate-600" : "bg-slate-50 text-slate-400"
                  )}>
                    <BookOpen size={32} />
                  </div>
                  <h3 className={cn("font-bold text-xl mb-2", darkMode ? "text-white" : "text-slate-900")}>No recommendations yet</h3>
                  <p className="text-slate-500 max-w-md mx-auto mb-8">
                    Run an evaluation to get personalized course suggestions based on your current skills and career goals.
                  </p>
                  <button 
                    onClick={() => runEvaluation(selectedGoalIndex)}
                    className={cn(
                      "px-8 py-3 rounded-2xl font-bold transition-all shadow-lg",
                      darkMode 
                        ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-900/20" 
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                    )}
                  >
                    Start Evaluation
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isSkillModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transition-colors",
                darkMode ? "bg-slate-800 border border-slate-700" : "bg-white"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between transition-colors",
                darkMode ? "border-slate-700" : "border-slate-100"
              )}>
                <h3 className={cn("font-bold text-xl", darkMode ? "text-white" : "text-slate-900")}>Add New Skill</h3>
                <button onClick={() => setIsSkillModalOpen(false)} className={cn("p-2 rounded-full transition-colors", darkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Skill Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. System Design"
                    value={newSkill.name}
                    onChange={(e) => setNewSkill(prev => ({ ...prev, name: e.target.value }))}
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
                      darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                  <select 
                    value={newSkill.category}
                    onChange={(e) => setNewSkill(prev => ({ ...prev, category: e.target.value }))}
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
                      darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  >
                    <option value="Tech">Technical</option>
                    <option value="Soft">Soft Skill</option>
                    <option value="Design">Design</option>
                    <option value="Management">Management</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className={cn(
                "p-6 border-t transition-colors",
                darkMode ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-100"
              )}>
                <button 
                  onClick={() => {
                    if (newSkill.name.trim()) {
                      addSkill(newSkill.name, newSkill.category);
                      setNewSkill({ name: '', category: 'Tech' });
                      setIsSkillModalOpen(false);
                    }
                  }}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold transition-all shadow-lg",
                    darkMode ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-900/20" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  Add Skill
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transition-colors",
                darkMode ? "bg-slate-800 border border-slate-700" : "bg-white"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between transition-colors",
                darkMode ? "border-slate-700" : "border-slate-100"
              )}>
                <h3 className={cn("font-bold text-xl", darkMode ? "text-white" : "text-slate-900")}>Edit Profile</h3>
                <button onClick={() => setIsProfileModalOpen(false)} className={cn("p-2 rounded-full transition-colors", darkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                  <input 
                    type="text" 
                    value={userProfile.name}
                    onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
                      darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Role</label>
                  <input 
                    type="text" 
                    value={userProfile.currentRole}
                    onChange={(e) => setUserProfile(prev => ({ ...prev, currentRole: e.target.value }))}
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
                      darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>
              </div>
              <div className={cn(
                "p-6 border-t space-y-3 transition-colors",
                darkMode ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-100"
              )}>
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold transition-all shadow-lg",
                    darkMode ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-900/20" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  Save Changes
                </button>
                {user ? (
                  <button 
                    onClick={handleLogout}
                    className={cn(
                      "w-full py-2 text-sm font-semibold rounded-xl transition-all",
                      darkMode ? "text-amber-400 hover:bg-amber-900/20" : "text-amber-600 hover:bg-amber-50"
                    )}
                  >
                    Logout
                  </button>
                ) : (
                  <button 
                    onClick={handleLogin}
                    className={cn(
                      "w-full py-2 text-sm font-semibold rounded-xl transition-all",
                      darkMode ? "text-indigo-400 hover:bg-indigo-900/20" : "text-indigo-600 hover:bg-indigo-50"
                    )}
                  >
                    Login with Google to Sync
                  </button>
                )}
                <button 
                  onClick={resetApp}
                  className={cn(
                    "w-full py-2 text-xs font-medium rounded-xl transition-all",
                    darkMode ? "text-slate-500 hover:bg-slate-700" : "text-slate-400 hover:bg-slate-100"
                  )}
                >
                  Reset Local Data
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Goal Modal */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transition-colors",
                darkMode ? "bg-slate-800 border border-slate-700" : "bg-white"
              )}
            >
              <div className={cn(
                "p-6 border-b flex items-center justify-between transition-colors",
                darkMode ? "border-slate-700" : "border-slate-100"
              )}>
                <h3 className={cn("font-bold text-xl", darkMode ? "text-white" : "text-slate-900")}>{editingGoalIndex !== null ? 'Edit Career Goal' : 'Add Career Goal'}</h3>
                <button onClick={() => setIsGoalModalOpen(false)} className={cn("p-2 rounded-full transition-colors", darkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Goal Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Senior Software Architect"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
                      darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Date</label>
                  <input 
                    type="date" 
                    value={newGoal.targetDate}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, targetDate: e.target.value }))}
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
                      darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                  <textarea 
                    rows={3}
                    placeholder="What does this goal mean to you?"
                    value={newGoal.description}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none",
                      darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>
              </div>
              <div className={cn(
                "p-6 border-t transition-colors",
                darkMode ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-100"
              )}>
                <button 
                  onClick={addOrUpdateGoal}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold transition-all shadow-lg",
                    darkMode ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-900/20" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  {editingGoalIndex !== null ? 'Update Goal' : 'Add Goal'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modals and Notifications */}
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              "fixed bottom-8 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border transition-colors",
              notification.type === 'success' 
                ? (darkMode ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-200" : "bg-emerald-50 border-emerald-200 text-emerald-800") :
              notification.type === 'error' 
                ? (darkMode ? "bg-amber-950/50 border-amber-500/30 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-800") :
              (darkMode ? "bg-indigo-950/50 border-indigo-500/30 text-indigo-200" : "bg-indigo-50 border-indigo-200 text-indigo-800")
            )}
          >
            {notification.type === 'success' && <Award size={20} className={darkMode ? "text-emerald-400" : "text-emerald-500"} />}
            {notification.type === 'error' && <X size={20} className={darkMode ? "text-amber-400" : "text-amber-500"} />}
            {notification.type === 'info' && <Sparkles size={20} className={darkMode ? "text-indigo-400" : "text-indigo-500"} />}
            <span className="font-medium">{notification.message}</span>
            <button onClick={() => setNotification(null)} className={cn("ml-2 transition-opacity hover:opacity-70", darkMode ? "text-slate-400" : "text-slate-500")}>
              <X size={16} />
            </button>
          </motion.div>
        )}

        {confirmModal && (
          <div className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm",
            darkMode ? "bg-slate-950/80" : "bg-slate-900/60"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "rounded-3xl p-8 max-w-md w-full shadow-2xl border transition-colors",
                darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center gap-3 mb-4 text-amber-600">
                <Shield size={24} />
                <h3 className={cn("text-xl font-bold", darkMode ? "text-white" : "text-slate-900")}>{confirmModal.title}</h3>
              </div>
              <p className={cn("mb-8 leading-relaxed", darkMode ? "text-slate-400" : "text-slate-600")}>
                {confirmModal.message}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-semibold transition-colors",
                    darkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className={cn(
                    "flex-1 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-lg",
                    darkMode ? "shadow-amber-900/20" : "shadow-amber-100"
                  )}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Fixed Profile Button - High z-index for visibility */}
      <button
        onClick={() => setIsProfileModalOpen(true)}
        className={cn(
          "fixed bottom-6 left-6 z-[9999] w-12 h-12 rounded-full flex items-center justify-center shadow-2xl border transition-all active:scale-95 hover:scale-110 overflow-hidden",
          darkMode ? "bg-slate-800 border-slate-700 text-indigo-400" : "bg-white border-slate-200 text-indigo-600"
        )}
      >
        {user?.avatar ? (
          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <>
            <User size={24} />
          </>
        )}
      </button>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, darkMode }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, darkMode?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all w-full text-left group relative",
        active 
          ? (darkMode ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600")
          : (darkMode ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")
      )}
    >
      <span className={cn(
        "transition-colors",
        active ? (darkMode ? "text-indigo-400" : "text-indigo-600") : "text-slate-400 group-hover:text-slate-600"
      )}>
        {icon}
      </span>
      <span className="text-sm">{label}</span>
      {active && (
        <motion.div 
          layoutId="active-nav" 
          className="absolute right-4 w-1.5 h-1.5 bg-indigo-600 rounded-full" 
        />
      )}
    </button>
  );
}

function StatCard({ title, value, icon, trend, darkMode, action }: { title: string, value: string | number, icon: React.ReactNode, trend: string, darkMode?: boolean, action?: React.ReactNode }) {
  return (
    <div className={cn(
      "p-6 rounded-2xl border shadow-sm transition-colors flex flex-col gap-4",
      darkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
    )}>
      <div className="flex items-center justify-between">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
          darkMode ? "bg-slate-800" : "bg-slate-50"
        )}>
          {icon}
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{trend}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{title}</span>
        <span className={cn(
          "text-xl font-bold tracking-tight transition-colors",
          darkMode ? "text-white" : "text-slate-900"
        )}>{value}</span>
      </div>
      {action && (
        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
          {action}
        </div>
      )}
    </div>
  );
}

function PsychScore({ label, score, icon, color, darkMode }: { label: string, score: number, icon: React.ReactNode, color: string, darkMode?: boolean }) {
  return (
    <div className={cn(
      "p-4 rounded-2xl border flex flex-col items-center text-center space-y-2 transition-colors",
      darkMode ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-100"
    )}>
      <div className={cn("p-2 rounded-lg text-white", color)}>
        {icon}
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={cn("text-xl font-bold transition-colors", darkMode ? "text-white" : "text-slate-900")}>{score}%</span>
      <div className={cn("w-full h-1 rounded-full overflow-hidden transition-colors", darkMode ? "bg-slate-700" : "bg-slate-200")}>
        <div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
