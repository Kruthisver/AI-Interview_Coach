'use client';

import { useState, useRef, useEffect, FormEvent, ChangeEvent } from 'react';
import React from 'react';

// --- SVG Icon Components ---
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

const BotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-indigo-500">
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
    </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
);

const UploadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
);


// --- Type Definitions ---
interface Message {
  role: 'user' | 'bot';
  content: string;
}

// --- Main Application Component ---
export default function Home() {
  // --- State Management ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [interviewState, setInterviewState] = useState<'initial' | 'loading' | 'ready' | 'ongoing' | 'finished'>('initial');
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Event Handlers ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  // --- API Handlers ---
  const handleStartInterview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resumeFile || !jobRole.trim()) {
      alert('Please provide both a resume PDF and a job role.');
      return;
    }
    setInterviewState('loading');
    setIsLoading(true);
    setMessages([]);

    const formData = new FormData();
    formData.append('job_role', jobRole);
    formData.append('resume', resumeFile);

    try {
      const response = await fetch('http://localhost:8000/generate_questions', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Request failed with status ${response.status}`);
      }
      
      if (typeof data.questions !== 'string' || data.questions.trim() === '') {
        throw new Error('Backend response did not contain valid questions text.');
      }

      const questionsText = data.questions;
      
      const questionMatches = questionsText.match(/^\s*\d+[\.\)]\s*(.*)/gm);

      if (!questionMatches || questionMatches.length === 0) {
        throw new Error('Could not parse any numbered questions from the backend response.');
      }
      
      const generatedQuestions = questionMatches
        .map((q: string) => q.replace(/^\s*\d+[\.\)]\s*/, '').trim()) 
        .filter((q: string) => q.length > 5); 

      if (generatedQuestions.length === 0) {
        throw new Error('No valid questions were found after parsing.');
      }
      
      setQuestions(generatedQuestions);
      const combinedReadyMessage = "Great! I've analyzed your resume and prepared some questions.\n\nAre you ready to begin the interview?";
      setMessages([{ role: 'bot', content: combinedReadyMessage }]);
      setInterviewState('ready');

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setMessages([{ role: 'bot', content: `${errorMessage}` }]);
      setInterviewState('initial');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAnswer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userAnswer = input;
    const userMessage: Message = { role: 'user', content: userAnswer };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Handle the "ready" confirmation state
    if (interviewState === 'ready') {
        const positiveResponse = /yes|yeah|ok|ready|sure|yep/i.test(userAnswer);
        if (positiveResponse) {
            const firstQuestionContent = `Excellent! Let's start. Here is your first question:\n\n${questions[0]}`;
            setMessages((prev) => [...prev, { role: 'bot', content: firstQuestionContent }]);
            setInterviewState('ongoing');
            setCurrentQuestionIndex(0);
        } else {
            setMessages((prev) => [...prev, { role: 'bot', content: "No problem. Just let me know when you are ready to start." }]);
        }
        setIsLoading(false);
        return;
    }
    
    // --- Main Evaluation Logic ---
    const currentQuestion = questions[currentQuestionIndex];
    const historyForBackend = [...messages, userMessage];

    try {
        const response = await fetch('http://localhost:8000/evaluate_answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: currentQuestion, 
                answer: userAnswer, 
                history: historyForBackend,
                job_role: jobRole // Pass job role for summary context
            }),
        });
        
        const data = await response.json();
        if (!response.ok) {
           throw new Error(data.detail || `Request failed with status ${response.status}`);
        }
        
        // ** FIX: Handle new backend response structure **
        const botResponseText = data.evaluation;
        const interviewHasEnded = data.interview_ended;

        const botResponse: Message = { role: 'bot', content: botResponseText };
        setMessages((prev) => [...prev, botResponse]);

        if (interviewHasEnded) {
            setInterviewState('finished');
        } else {
            // Move to the next question in the pre-generated list
            const nextQuestionIndex = currentQuestionIndex + 1;
            if (nextQuestionIndex < questions.length) {
                 setCurrentQuestionIndex(nextQuestionIndex);
            } else {
                 // If we run out of questions, force the end.
                 const endResponse = await fetch('http://localhost:8000/force_end_interview', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ history: [...historyForBackend, botResponse], job_role: jobRole }),
                 });
                 const endData = await endResponse.json();
                 setMessages((prev) => [...prev, { role: 'bot', content: endData.summary }]);
                 setInterviewState('finished');
            }
        }

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setMessages((prev) => [...prev, { role: 'bot', content: `Sorry, there was an error. Error: ${errorMessage}` }]);
    } finally {
        setIsLoading(false);
    }
  };
  
  // --- UI RENDER ---
  const renderInitialForm = () => (
    <div className="h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-slate-800">
      <div className="w-full max-w-2xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg p-8 rounded-2xl shadow-2xl text-center border border-gray-200/50 dark:border-gray-700/50 transition-all duration-500">
         {messages.length > 0 && messages[0].role === 'bot' && (
             <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-left shadow-inner">
                <p className="font-bold text-lg">An error occurred:</p>
                <p className="text-sm whitespace-pre-wrap font-mono mt-2">{messages[0].content}</p>
             </div>
         )}
        <div className="mx-auto mb-6 p-4 bg-indigo-100 dark:bg-indigo-900/50 rounded-full w-fit shadow-lg">
          <BotIcon />
        </div>
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-3">AI Interview Coach</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">Upload your resume and enter a job role to begin a personalized technical interview.</p>
        <form onSubmit={handleStartInterview} className="space-y-6">
          <input
            type="text"
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value)}
            placeholder="e.g., Senior Software Engineer"
            className="w-full bg-gray-100 dark:bg-gray-700/80 text-gray-800 dark:text-gray-200 rounded-lg px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-all duration-300 placeholder-gray-400 dark:placeholder-gray-500 border border-transparent focus:border-indigo-500"
          />
          <div>
            <label htmlFor="resume-upload" className="w-full p-3.5 bg-gray-200 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-300 cursor-pointer flex items-center justify-center">
                <UploadIcon />
                {resumeFile ? resumeFile.name : 'Upload Resume (PDF)'}
            </label>
            <input
                id="resume-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
            />
          </div>
          <button type="submit" disabled={isLoading} className="w-full p-3.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/40 transform hover:-translate-y-0.5">
            {isLoading ? 'Generating Questions...' : 'Start Interview'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderChatInterface = () => (
     <div className="font-sans bg-gray-100 dark:bg-slate-900 flex flex-col h-screen">
      <header className="bg-white dark:bg-slate-800/50 backdrop-blur-sm shadow-md p-4 flex items-center gap-4 border-b border-gray-200 dark:border-slate-700">
        <div className="p-2 bg-gray-200 dark:bg-slate-700 rounded-full"><BotIcon /></div>
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">AI Interview Coach</h1>
          <p className="text-sm text-green-500 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Interview in Progress
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'bot' && <div className="flex-shrink-0 p-2 bg-gray-200 dark:bg-slate-700 rounded-full"><BotIcon /></div>}
            <div className={`max-w-xs md:max-w-md lg:max-w-2xl px-4 py-3 rounded-2xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-gradient-to-br from-indigo-500 to-blue-500 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-bl-none'} shadow-md`}>
              <p className="text-sm leading-relaxed">{msg.content}</p>
            </div>
            {msg.role === 'user' && <div className="flex-shrink-0 p-2 bg-gray-200 dark:bg-slate-700 rounded-full"><UserIcon /></div>}
          </div>
        ))}
         {isLoading && (
            <div className="flex items-start gap-3 justify-start">
                <div className="flex-shrink-0 p-2 bg-gray-200 dark:bg-slate-700 rounded-full"><BotIcon /></div>
                <div className="max-w-xs md:max-w-md lg:max-w-2xl px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-md">
                    <div className="flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse [animation-delay:0.4s]"></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-t border-gray-200 dark:border-slate-700 p-4">
        <form onSubmit={handleSendAnswer} className="flex items-center max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={interviewState === 'finished' ? 'The interview is complete.' : 'Type your answer...'}
            disabled={isLoading || interviewState === 'finished'}
            className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow duration-200 disabled:opacity-50"
          />
          <button type="submit" disabled={!input.trim() || isLoading || interviewState === 'finished'} className="ml-4 p-3 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            <SendIcon />
          </button>
        </form>
      </footer>
    </div>
  );

  const renderLogic = () => {
    if (interviewState === 'initial' || interviewState === 'loading') {
      return renderInitialForm();
    }
    return renderChatInterface();
  };

  return (
    <div className="antialiased text-gray-800 dark:text-gray-200">
      {renderLogic()}
    </div>
  );
}

