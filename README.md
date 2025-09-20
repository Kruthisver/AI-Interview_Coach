# 🤖 AI Interview Coach


An intelligent, conversational AI-powered interview coach that conducts personalized technical interviews based on a candidate's resume.
This project leverages local LLMs via Ollama to generate tailored questions, evaluate answers in real-time, and provide professional interview feedback.

# 📌 Project Overview

The AI Interview Coach simulates real-world technical interviews:

Parses a candidate's resume PDF to extract skills and experience.

Uses a multi-model AI engine (Llama3 + Deepseek-Coder) to generate diverse and role-specific questions.

Maintains a conversational flow, evaluates answers instantly, and provides constructive feedback.

Ends with a summary report for the candidate to reflect on strengths and weaknesses.

This project is designed to help candidates practice for interviews in a realistic and interactive way—all while running completely locally with no API costs.

# ⚙️ Features

✅ Resume-Based Questioning – Tailored interview questions from uploaded resumes
✅ Multi-Model AI Engine – Combines Llama3 for conversational flow and Deepseek-Coder for coding/technical expertise
✅ Conversational Chat – Smooth back-and-forth interview experience
✅ Real-Time Evaluation – Instant scoring & feedback for every answer
✅ Context Awareness – Maintains conversation history for follow-ups
✅ Professional Summary – Generates structured feedback at the end of the session

# 📊 Tech Stack
Component	Technology
Frontend	Next.js (React), TypeScript, Tailwind CSS
Backend	FastAPI (Python), Pydantic
AI Models	Ollama (Llama3, Deepseek-Coder)
PDF Parsing	PyMuPDF
Tooling	Node.js, Uvicorn
🛠️ Installation & Setup
🔹 Prerequisites

Ollama
 (for running local LLMs)

Python 3.8+

Node.js 18+

1. Set Up Ollama Models
ollama pull llama3
ollama pull deepseek-coder

2. Configure the Backend
cd backend
python -m venv .venv

# Activate virtual environment
# On Windows:
```bash
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend
uvicorn main:app --reload
```

📍 Backend will run on: http://localhost:8000

3. Configure the Frontend
```bash
cd frontend
npm install
npm run dev
```

📍 Frontend will run on: http://localhost:3000

# 🖥️ How to Use

Open http://localhost:3000
 in your browser.

Enter your job role and upload a resume PDF.

Click "Start Interview" to begin.

Answer the AI’s questions in a chat-like interface.

Get real-time scores & feedback.

Type "end interview" to finish and receive a final summary.

🚀 Future Enhancements

🎤 Voice-based interviews (speech-to-text + text-to-speech)

📊 Analytics dashboard for performance trends over multiple sessions

📚 Integration with job descriptions for even more tailored questions

🌐 Multi-language support

🤝 Contributing

Contributions are welcome!
Feel free to fork this repo, submit issues, or create PRs to add new features.

# 📜 License

This project is licensed under the MIT License – feel free to use and modify.


✨ With AI Interview Coach, candidates can practice anytime, anywhere with a powerful AI mentor running completely locally.