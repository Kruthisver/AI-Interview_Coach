from fastapi import FastAPI, Form, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
from pydantic import BaseModel, Field
import fitz  # PyMuPDF
import io
import asyncio
import re
from typing import List, Dict, Optional

# --- Pydantic Models ---
class Message(BaseModel):
    role: str
    content: str

class EvaluationRequest(BaseModel):
    question: str
    answer: str
    history: List[Message] = Field(default_factory=list)

class InterviewSummaryRequest(BaseModel):
    history: List[Message] = Field(default_factory=list)
    job_role: str

app = FastAPI()

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Ollama & Model Configuration ---
OLLAMA_URL = "http://localhost:11434/api/generate"
QUESTION_MODELS = ["llama3"] 

# --- Helper Functions ---
def call_ollama(model: str, prompt: str, timeout: int = 60):
    """Call Ollama API with optimized settings for better responses."""
    try:
        payload = {
            "model": model, 
            "prompt": prompt, 
            "stream": False,
            "options": {
                "temperature": 0.3,  # Lower temperature for more consistent responses
                "top_p": 0.8,
                "num_predict": 500,  # Limit response length
                "stop": ["---", "**Next question:**", "Next question:", "STOP"]
            }
        }
        response = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        return data.get("response", "").strip()
    except Exception as e:
        print(f"Ollama API error: {e}")
        return ""

def parse_questions(text: str):
    """Extract numbered questions from text."""
    question_matches = re.findall(r'^\s*\d+[\.\)]\s*(.*)', text, re.MULTILINE)
    return [q.strip() for q in question_matches if q.strip()]

def detect_interview_end_intent(user_message: str) -> bool:
    """Detect if user wants to end the interview."""
    user_lower = user_message.lower().strip()
    
    # Strong end indicators
    end_phrases = [
        "i'm done", "we're done", "that's it", "i think we're finished",
        "let's end", "let's finish", "let's conclude", "i'd like to end",
        "can we finish", "i want to stop", "no more questions", "let's wrap up",
        "i think that's enough", "that concludes", "i'm ready to finish"
    ]
    
    for phrase in end_phrases:
        if phrase in user_lower:
            return True
    
    # Short responses indicating end
    if len(user_lower.split()) <= 3:
        end_words = ["done", "finished", "end", "finish", "thanks", "thank you"]
        if any(word in user_lower for word in end_words):
            return True
    
    return False

def count_questions_asked(history: List[Message]) -> int:
    """Count questions asked by interviewer."""
    count = 0
    for msg in history:
        if msg.role == "assistant":
            if "?" in msg.content:
                count += msg.content.count("?")
    return count

def format_evaluation_response(score: str, feedback: str, next_question: str) -> str:
    """Format the evaluation response properly."""
    # Clean up the inputs
    score = score.strip()
    feedback = feedback.strip()
    next_question = next_question.strip()
    
    # Ensure score format
    if not score.endswith("/10"):
        if score.isdigit():
            score = f"{score}/10"
        else:
            score = "7/10"
    
    # Format the response
    formatted_response = f"""**Score:** {score}

**Feedback:** {feedback}

**Next Question:** {next_question}"""
    
    return formatted_response

# --- API Endpoints ---
@app.get("/")
def root():
    return {"message": "AI Interview Coach Backend is running 🚀"}

@app.post("/generate_questions")
async def generate_questions(job_role: str = Form(...), resume: UploadFile = File(...)):
    try:
        pdf_bytes = await resume.read()
        resume_text = ""
        with fitz.open(stream=io.BytesIO(pdf_bytes), filetype="pdf") as pdf_document:
            for page in pdf_document:
                resume_text += page.get_text()

        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the PDF.")

        prompt = f"""Based on this resume, generate exactly 5 interview questions for a {job_role} position.

Resume:
{resume_text[:1500]}

Generate 5 specific questions about their projects, skills, and experience. Return ONLY the numbered questions:

1. [Question 1]
2. [Question 2]
3. [Question 3]
4. [Question 4]
5. [Question 5]"""

        response = call_ollama("llama3", prompt)
        
        if response:
            questions = parse_questions(response)
            if questions:
                final_questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions[:5]))
                return {"questions": final_questions_text}

        # Fallback questions
        fallback_questions = [
            f"Tell me about your most challenging project and how you solved the main technical problems.",
            "Describe a specific technology from your resume and how you've applied it in a real project.", 
            "Walk me through your approach when debugging a complex issue.",
            "Explain a technical concept from one of your projects in simple terms.",
            f"What aspects of this {job_role} role align with your experience and interests?"
        ]
        
        final_questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(fallback_questions))
        return {"questions": final_questions_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating questions: {str(e)}")

@app.post("/evaluate_answer")
def evaluate_answer(request: EvaluationRequest):
    try:
        # Check if user wants to end interview
        if detect_interview_end_intent(request.answer):
            return generate_interview_summary(InterviewSummaryRequest(
                history=request.history + [Message(role="user", content=request.answer)],
                job_role="Software Developer"
            ))

        questions_asked = count_questions_asked(request.history)
        
        # Simple, focused prompt for better responses
        prompt = f"""You are interviewing a candidate. Evaluate their answer and ask the next question.

Question asked: {request.question}
Candidate's answer: {request.answer}

Provide exactly this format:

SCORE: [Give a score from 1-10]

FEEDBACK: [Give 1-2 sentences of constructive feedback]

NEXT_QUESTION: [Ask one relevant follow-up question or move to a new topic]

Do not add anything else. Stop after NEXT_QUESTION."""

        response = call_ollama("llama3", prompt)
        
        if response:
            # Parse the response
            score_match = re.search(r'SCORE:\s*(\d+)', response, re.IGNORECASE)
            feedback_match = re.search(r'FEEDBACK:\s*(.*?)(?=NEXT_QUESTION:)', response, re.IGNORECASE | re.DOTALL)
            question_match = re.search(r'NEXT_QUESTION:\s*(.*?)$', response, re.IGNORECASE | re.DOTALL)
            
            score = score_match.group(1) if score_match else "7"
            feedback = feedback_match.group(1).strip() if feedback_match else "Thank you for your response. Let me ask you more about this topic."
            next_question = question_match.group(1).strip() if question_match else "Can you tell me more about your experience with this technology?"
            
            # Clean up the extracted parts
            feedback = re.sub(r'\n+', ' ', feedback).strip()
            next_question = re.sub(r'\n+', ' ', next_question).strip()
            
            formatted_response = format_evaluation_response(score, feedback, next_question)
            
            return {
                "evaluation": formatted_response,
                "interview_ended": False,
                "questions_asked": questions_asked
            }

        # Fallback response
        return {
            "evaluation": format_evaluation_response(
                "7", 
                "Thank you for your response. I'd like to explore this topic further.",
                "Can you provide more specific details about the challenges you faced and how you overcame them?"
            ),
            "interview_ended": False
        }

    except Exception as e:
        print(f"Evaluation error: {e}")
        return {
            "evaluation": format_evaluation_response(
                "7",
                "Thank you for sharing your experience with me.",
                "Let's move on to discuss another aspect of your background. What other projects are you proud of?"
            ),
            "interview_ended": False
        }

@app.post("/generate_summary")
def generate_interview_summary(request: InterviewSummaryRequest):
    """Generate final interview summary."""
    try:
        questions_asked = count_questions_asked(request.history)
        
        # Extract recent conversation for context
        recent_conversation = []
        for msg in request.history[-10:]:
            role = "Interviewer" if msg.role == "assistant" else "Candidate"
            content = msg.content[:200] + "..." if len(msg.content) > 200 else msg.content
            recent_conversation.append(f"{role}: {content}")
        
        conversation_context = "\n".join(recent_conversation)

        prompt = f"""The interview is ending. Provide a professional summary.

Interview context:
- Position: {request.job_role}
- Questions discussed: {questions_asked}

Recent conversation:
{conversation_context}

Write a warm, professional closing message (3-4 sentences) that:
1. Thanks the candidate
2. Gives brief positive assessment
3. Mentions next steps
4. Ends encouragingly

Write in paragraph form, not bullet points."""

        summary = call_ollama("llama3", prompt)
        
        if not summary:
            summary = f"Thank you for taking the time to interview with us today. Based on our conversation, you've shown good technical knowledge and communication skills. Our team will review your responses and be in touch regarding next steps. Best of luck with your job search!"

        # Clean up the summary
        summary = re.sub(r'\n+', ' ', summary).strip()
        
        return {
            "evaluation": summary,
            "interview_ended": True,
            "summary": summary,
            "total_questions": questions_asked,
            "message": "Interview concluded successfully."
        }

    except Exception as e:
        print(f"Summary error: {e}")
        return {
            "evaluation": "Thank you for our interview today. Our team will be in touch regarding next steps. Have a great day!",
            "interview_ended": True,
            "summary": "Interview completed successfully.",
            "total_questions": questions_asked
        }

@app.post("/force_end_interview")
def force_end_interview(request: InterviewSummaryRequest):
    """Manually end interview."""
    return generate_interview_summary(request)