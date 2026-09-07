🎬 Production Change Agent
AI-Powered Film Production Scheduling Assistant
"Every schedule change has a price. We tell you what it is before you commit."

📖 Overview
Production Change Agent is an AI-powered tool that helps film production managers evaluate the real cost of schedule changes before making them. It combines natural language understanding, Parallel Search, and a deterministic cost model to generate, validate, and rank alternative shooting schedules.

🎯 The Problem
Film production schedules are complex. A single change - moving a scene, swapping a cast member, or changing a location - can trigger cascading effects:

Cost overruns from overtime and hold days

Violations of union rules (turnaround time, meal penalties)

Logistical nightmares with permits and actor availability

Production managers often make decisions based on intuition, not data.

Our solution: A tool that shows you the cost of every change before you commit.

💡 Key Features
Feature	Description
Natural Language Input	Type "move scene 5 to day 3" - no complex UI needed
AI Agent Trace	Watch the agent's chain of thought in real-time
3 Ranked Plans	See the best alternatives with cost breakdowns
Plan Reasoning	Each plan explains WHY it was chosen
Confidence Scores	See how certain the agent is about each plan
Stripboard Visualization	Industry-standard schedule view that updates in real-time
Parallel Search Integration	Grounds decisions in real production data
Cost Model	Deterministic pricing - same request = same cost
Violation Detection	Shows union rule violations with pre-existing flag
Compare View	Side-by-side comparison of all plans
PDF Export	Export any plan as a professional PDF
Agent Memory	Remembers user preferences (cost savings vs. fewer violations)
Multi-Tool Agent	Uses search, validation, cost, and generation tools
🏗️ Architecture
text
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Tailwind)             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Stripboard  │  Agent Trace  │  Plans  │  Compare   │  │
│  └───────────────────────────────────────────────────────┘  │
│                         ▼ HTTP / SSE                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  /change    │  Agent Trace  │  Parallel Search      │  │
│  │  /schedule  │  Reasoning    │  Confidence Scoring   │  │
│  └───────────────────────────────────────────────────────┘  │
│                         ▼                                   │
│              ┌──────────────────────┐                       │
│              │  Parallel Search API │                       │
│              │  (Real-time data)    │                       │
│              └──────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    CORE LOGIC (Python)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Validator  │  Cost Model  │  Generator  │  Parser   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
🛠️ Tech Stack
Layer	Technology	Purpose
Frontend	React 18 + Vite + Tailwind CSS	UI rendering
Backend	FastAPI (Python 3.11+)	API server
AI Agent	Google Gemini (fallback)	Natural language understanding
Search	Parallel Search API	Production data retrieval
Deployment	Google Cloud Run	Backend hosting
Deployment	Netlify	Frontend hosting
Version Control	Git + GitHub	Code management
PDF Export	jsPDF	Export plans as PDF
📁 Project Structure
text
production-change-agent/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentTrace.jsx       # Chain of thought display
│   │   │   ├── AgentThinking.jsx    # Loading animation with steps
│   │   │   ├── ChangeInput.jsx      # Natural language input
│   │   │   ├── PlanCard.jsx         # Individual plan with reasoning
│   │   │   ├── CompareView.jsx      # Side-by-side comparison
│   │   │   ├── SourceList.jsx       # Parallel Search citations
│   │   │   ├── Stripboard.jsx       # Schedule grid
│   │   │   └── ViolationBadges.jsx  # Rule violation display
│   │   ├── App.jsx                  # Main application
│   │   └── api.js                   # API client
│   ├── package.json
│   └── .env
│
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point
│   │   ├── schemas.py               # Pydantic models
│   │   ├── tools.py                 # Parallel Search client
│   │   ├── validator.py             # Rule validation
│   │   ├── cost_model.py            # Deterministic pricing
│   │   ├── generate.py              # Plan generation & ranking
│   │   ├── parser.py                # NL → intent parsing
│   │   └── config.py                # Environment + data loading
│   ├── data/
│   │   └── production.json          # Sample production data
│   ├── tests/
│   │   └── test_api.py              # API tests
│   ├── requirements.txt
│   └── Dockerfile
│
├── demo/
│   └── demo_script.md               # Video recording script
│
├── README.md
├── LICENSE
└── .env.example
🔧 Installation & Setup
Prerequisites
Python 3.11+

Node.js 18+

Git

Parallel API Key (Sign up for free)

1. Clone Repository
bash
git clone https://github.com/yourusername/production-change-agent.git
cd production-change-agent
2. Backend Setup
bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
Add your API keys to .env:

env
PARALLEL_API_KEY=your_api_key_here
GEMINI_API_KEY=your_gemini_key_here  # Optional
ALLOWED_ORIGINS=http://localhost:5173
3. Frontend Setup
bash
cd frontend
npm install
Create .env:

env
VITE_API_URL=http://localhost:8000
4. Run Locally
bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
Visit http://localhost:5173

🚀 How It Works
The Agent Pipeline
text
┌─────────────────────────────────────────────────────────────────┐
│ 1. User Input                                                 │
│    "move scene 5 to day 3"                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Agent Parses Intent                                        │
│    → Action: "move"                                           │
│    → Scene ID: "5"                                            │
│    → Target Day: 3                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Parallel Search (Concurrent)                               │
│    → Union rules (SAG-AFTRA, IATSE)                          │
│    → Rescheduling cost patterns                               │
│    → Permit lead times                                        │
│    → Night work premiums                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Generate Alternative Schedules                             │
│    → Strategy: Direct Move                                    │
│    → Strategy: Move + Cascade                                 │
│    → Strategy: Swap                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Validate Each Plan                                         │
│    → Hard violations → Reject                                 │
│    → Soft violations → Price into risk score                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Calculate Costs                                            │
│    → Crew base days                                           │
│    → Location fees                                            │
│    → Company moves                                            │
│    → Overtime, meal penalties, night premiums                 │
│    → Cast work days, hold days                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Rank Plans                                                 │
│    → Risk-adjusted cost: delta + risk_delta × $450           │
│    → $5,000 nudge for honoring the literal request            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Add Reasoning + Confidence                                 │
│    → "Why this plan?" explanation                             │
│    → Confidence score (0-100%)                                │
│    → Alternatives considered count                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Return to Frontend                                         │
│    → 3 ranked plans with full details                         │
│    → Rejected plans with reasons                              │
│    → Agent trace (chain of thought)                           │
│    → Parallel Search citations                                │
└─────────────────────────────────────────────────────────────────┘
📊 API Endpoints
Endpoint	Method	Description
/change	POST	Submit change request → ranked plans
/change/stream	POST	SSE stream for live agent trace
/schedule	GET	Current stripboard data
/health	GET	Liveness + Parallel status
Example: POST /change
Request:

json
{
  "request": "move scene 5 to day 3",
  "max_plans": 3,
  "use_search": true
}
Response:

json
{
  "status": "ok",
  "plans": [
    {
      "rank": 1,
      "summary": "Move scene 5 to Day 3 and push the lightest work off that day",
      "reasoning": "Moved scene 5 from Day 4 to Day 3. This saves $28,650 by reducing overtime and hold costs. Reduces violations from 8 to 5.",
      "confidence": 0.87,
      "alternatives_considered": 12,
      "strategy": "move_and_cascade",
      "cost": 340000,
      "risk_delta": -49,
      "changes": [
        {
          "scene_id": "5",
          "action": "move",
          "from_day": 4,
          "to_day": 3,
          "reason": "Scene 5 moved from Day 4 to Day 3."
        }
      ],
      "violations": [
        {
          "code": "TURNAROUND",
          "severity": "soft",
          "day": 5,
          "message": "Only 9.0h turnaround into Day 5",
          "preexisting": true
        }
      ],
      "cost_breakdown": {
        "baseline_total": 368650,
        "plan_total": 340000,
        "delta": -28650,
        "lines": [
          {"label": "Company moves", "amount": -6500},
          {"label": "Crew overtime", "amount": -8400}
        ]
      },
      "parallel_results": [
        {
          "url": "https://...",
          "title": "SAG-AFTRA Turnaround Rules",
          "relevance": "union_rules"
        }
      ]
    }
  ],
  "rejected": [
    {
      "strategy": "alternative_day_5",
      "cost": 41200,
      "reasons": ["Riverside Alley is unavailable", "Day 5 exceeds 14h hard cap"]
    }
  ],
  "baseline_cost": 368650,
  "intent": {"action": "move", "scene_ids": ["5"], "target_day": 3},
  "trace": [
    "Parsed intent: move ['5'] -> day 3",
    "Searching production precedent with Parallel AI...",
    "Generating alternative schedules...",
    "Generated 3 viable plans, 2 rejected",
    "Plan #1 recommended as optimal",
    "Agent confidence in recommended plan: 87%"
  ],
  "search_used": true,
  "elapsed_ms": 812
}
🎬 Demo Script (3 Minutes)
Time	Scene	Action
0:00	Title	Show logo + tagline
0:15	Problem	Show complex schedule + explain challenge
0:30	Solution	Input "move scene 5 to day 3"
0:45	Agent Trace	Show chain of thought appearing
1:15	Results	Show 3 ranked plans with costs
1:45	Reasoning	Expand a plan to show "Why this plan?"
2:00	Comparison	Show Compare View table
2:15	Select	Click a plan → stripboard updates
2:30	Value	"This saves $28,650. What would you decide?"
2:45	Close	Tagline + CTA
🧪 Testing
Backend Tests
bash
cd backend
pytest tests/ -v
Frontend Tests
bash
cd frontend
npm test
Manual Test Cases
Test	Expected Result
"move scene 5 to day 3"	3 plans with trace, reasoning, confidence
"delete scene 999"	404 error with "Unknown scene"
"fix the schedule"	422 error with example phrasing
Offline mode (DEMO=1)	Uses fixtures, no API calls
🔒 Environment Variables
Variable	Required	Purpose
PARALLEL_API_KEY	✅ Yes	Parallel Search API key
GEMINI_API_KEY	❌ No	Google Gemini (fallback parser)
ALLOWED_ORIGINS	❌ No	CORS origins (default: *)
DEMO	❌ No	Set to 1 for offline mode
PORT	❌ No	Server port (default: 8000)
🚀 Deployment
Backend: Google Cloud Run
bash
cd backend
gcloud builds submit --tag gcr.io/your-project/production-agent
gcloud run deploy production-agent \
  --image gcr.io/your-project/production-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars PARALLEL_API_KEY=your_key_here,ALLOWED_ORIGINS=https://your-site.netlify.app
Frontend: Netlify
bash
cd frontend
npm run build
# Drag-and-drop `dist` folder to Netlify
Or connect GitHub repo to Netlify for automatic deploys.

Set environment variable in Netlify:

text
VITE_API_URL = https://your-cloud-run-url
🧠 Agentic Features
Feature	Description	Where It Shows
Chain of Thought	Step-by-step reasoning	AgentTrace component (green terminal)
Plan Reasoning	Why each plan was chosen	Inside expanded plan card
Confidence Score	0-100% certainty	Bar on every plan card
Alternatives Count	How many considered	Shown next to confidence
Strategy Tag	Approach used	Badge on plan
User Preferences	Adapts to user goals	Backend memory (cost savings vs. violations)
Multi-Tool Agent	Search + Validate + Cost + Generate	Backend agent loop
Parallel Citations	Grounding sources	SourceList component
❓ FAQ
Q: Do I need a Parallel API key?
A: Yes, sign up at platform.parallel.ai for free credits.

Q: Can I run this offline?
A: Yes, set DEMO=1 to use mock data.

Q: What if I don't have GCP credits?
A: Cloud Run has an always-free tier. No credits required.

Q: How does Parallel Search work?
A: It runs concurrently with schedule generation, searching for union rules, cost patterns, and permit data. Results are attached to plans as citations.

Q: Are costs realistic?
A: Yes - costs come from a deterministic model with industry-standard rates for crew, locations, and union rules.

Q: What's the agent trace?
A: A step-by-step log showing the agent's reasoning process, from parsing input to recommending a plan.

📝 License
MIT License - See LICENSE for details.

🤝 Credits
Parallel AI - Free search credits for hackathon participants

Google Cloud - Free tier hosting

FastAPI - High-performance backend framework

React + Vite - Modern frontend stack

Tailwind CSS - Utility-first styling

📞 Support
For hackathon participants:

GitHub Issues: Report bugs here

Devpost: Check project page for updates

Parallel Discord: Quick support from the Parallel team

Built for the Parallel AI Hackathon
September 2026