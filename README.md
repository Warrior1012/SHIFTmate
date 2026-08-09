````markdown
# SHIFTmate

## Voice-First Operational Continuity for Shift Teams

SHIFTmate is a voice-first AI operational assistant designed for shift-based industrial environments.

The purpose of SHIFTmate is to preserve operational knowledge between shifts so that the incoming operator does not have to start from zero.

An operator can ask about a machine, report an issue, retrieve information from a previous shift, resolve an existing issue, or generate a shift handover. SHIFTmate combines voice interaction, semantic operational memory, AI reasoning, text-to-speech, machine context, issue tracking, persistent operational data and handover management into a single workflow.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. The Problem](#2-the-problem)
- [3. The Solution](#3-the-solution)
- [4. Core Workflow](#4-core-workflow)
- [5. Key Features](#5-key-features)
  - [5.1 Voice Assistant](#51-voice-assistant)
  - [5.2 Multilingual Interaction](#52-multilingual-interaction)
  - [5.3 Operational Memory](#53-operational-memory)
  - [5.4 AI Responses with Gemini](#54-ai-responses-with-gemini)
  - [5.5 Rime Text-to-Speech](#55-rime-text-to-speech)
  - [5.6 Issue Tracking](#56-issue-tracking)
  - [5.7 Machine Context](#57-machine-context)
  - [5.8 Shift Handover](#58-shift-handover)
  - [5.9 Dashboard](#59-dashboard)
  - [5.10 Authentication](#510-authentication)
  - [5.11 Notifications](#511-notifications)
  - [5.12 Tasks and Reports](#512-tasks-and-reports)
  - [5.13 Profile and Settings](#513-profile-and-settings)
- [6. How the AI Pipeline Works](#6-how-the-ai-pipeline-works)
- [7. Operational Memory with Qdrant](#7-operational-memory-with-qdrant)
- [8. Persistent Operational Data](#8-persistent-operational-data)
- [9. Issue Lifecycle](#9-issue-lifecycle)
- [10. Machine-Level Context](#10-machine-level-context)
- [11. Handover Workflow](#11-handover-workflow)
- [12. Frontend](#12-frontend)
- [13. Backend](#13-backend)
- [14. API Overview](#14-api-overview)
- [15. Technology Stack](#15-technology-stack)
- [16. Project Structure](#16-project-structure)
- [17. Requirements](#17-requirements)
- [18. Local Setup](#18-local-setup)
  - [18.1 Clone the Repository](#181-clone-the-repository)
  - [18.2 Backend Setup](#182-backend-setup)
  - [18.3 Backend Environment Variables](#183-backend-environment-variables)
  - [18.4 Start the Backend](#184-start-the-backend)
  - [18.5 Frontend Setup](#185-frontend-setup)
  - [18.6 Frontend Environment Variables](#186-frontend-environment-variables)
  - [18.7 Start the Frontend](#187-start-the-frontend)
- [19. Running the Complete Application](#19-running-the-complete-application)
- [20. Google Authentication Setup](#20-google-authentication-setup)
- [21. Voice Setup](#21-voice-setup)
- [22. Example Usage](#22-example-usage)
- [23. End-to-End Example](#23-end-to-end-example)
- [24. Error Handling and Troubleshooting](#24-error-handling-and-troubleshooting)
- [25. Security](#25-security)
- [26. Testing Checklist](#26-testing-checklist)
- [27. Known Limitations](#27-known-limitations)
- [28. Future Improvements](#28-future-improvements)
- [29. Project Presentation](#29-project-presentation)
- [30. Why SHIFTmate](#30-why-shiftmate)
- [31. Team](#31-team)
- [32. License](#32-license)

---

# 1. Overview

SHIFTmate is a voice-first AI operational assistant developed for the **Starforge Hackathon**, organized by **ForgeFox**, at **JSS University, Noida**.

SHIFTmate is built around a simple operational problem:

> Important information is often known by the outgoing shift but is not easily available to the incoming shift.

Instead of treating shift handover as a separate manual activity, SHIFTmate makes operational information part of a continuous system.

The operator can communicate naturally through voice or text. The system can retrieve previous operational information, answer questions using that context, record new issues, update machine-related information and use the resulting information when preparing the next shift's handover.

The main idea is:

```text
Current Shift
     |
     v
Operational Information
     |
     v
SHIFTmate
     |
     +---- Voice Interaction
     |
     +---- AI Reasoning
     |
     +---- Operational Memory
     |
     +---- Issue Tracking
     |
     +---- Machine Context
     |
     +---- Persistent Data
     |
     v
Shift Handover
     |
     v
Next Shift
````

---

# 2. The Problem

Shift-based industrial operations depend heavily on continuity.

During a shift, operators may discover:

* Machine abnormalities
* Temperature problems
* Vibration problems
* Maintenance requirements
* Affected production orders
* Unresolved incidents
* Pending inspections
* Important information from earlier shifts
* Issues that were reported but not yet resolved

The problem is that this information can easily become fragmented.

An incoming operator may have to repeatedly ask:

```text
What happened with Machine 3?

Which machines have unresolved issues?

Was maintenance informed?

Which order is affected?

What happened during the previous shift?

Which issue is still pending?
```

If this information is not easily accessible, the incoming operator has to reconstruct the situation manually.

This creates unnecessary delay and increases the chance of missing important operational context.

Traditional handover processes can also depend heavily on:

* Manual notes
* Verbal communication
* Separate records
* Operator memory
* Static documents
* Different sources of operational information

The result is that important information may exist, but it may not be available in the exact form in which the next operator needs it.

SHIFTmate is designed to solve this continuity problem.

---

# 3. The Solution

SHIFTmate combines several components into a single operational workflow:

```text
Voice
  +
Operational Memory
  +
AI Reasoning
  +
Persistent Operational Data
  +
Issue Tracking
  +
Machine Context
  +
Shift Handover
```

The resulting workflow is:

```text
Operator asks
     ↓
System understands
     ↓
Relevant context is retrieved
     ↓
AI generates a grounded answer
     ↓
Operator receives the answer
     ↓
Important operational information is persisted
     ↓
Future operators can retrieve it
```

The important part is continuity.

A piece of information reported during one shift should remain useful to another operator later.

---

# 4. Core Workflow

The complete SHIFTmate workflow can be represented as:

```text
                    OPERATOR
                       |
              Voice / Text Input
                       |
                       v
              React + Vite Frontend
                       |
                       v
                  FastAPI API
                       |
              +--------+--------+
              |                 |
              v                 v
        Qdrant Memory       Issue System
              |                 |
              v                 v
       Relevant Context     Machine State
              |                 |
              +--------+--------+
                       |
                       v
                    Gemini
                       |
                       v
              Grounded Response
                       |
              +--------+--------+
              |                 |
              v                 v
          Frontend            Rime
              |                 |
              |                 v
              |            Spoken Audio
              |                 |
              +--------+--------+
                       |
                       v
                  Next Action
                       |
              +--------+--------+
              |                 |
              v                 v
         Issue Update       Handover
```

---

# 5. Key Features

## 5.1 Voice Assistant

Voice is the primary interaction method of SHIFTmate.

The operator can press the microphone and speak naturally instead of typing every question.

The basic voice pipeline is:

```text
Microphone
    ↓
Browser Speech Recognition
    ↓
Transcript
    ↓
Backend
    ↓
AI Response
    ↓
Rime TTS
    ↓
Audio Response
```

Chrome and Microsoft Edge are recommended for the voice workflow.

---

## 5.2 Multilingual Interaction

SHIFTmate supports:

* English
* Hindi
* Hinglish

The language selector allows the operator to choose the preferred interaction language.

### English

```text
"What happened with Machine 3?"
```

```text
"Machine 3 had abnormal vibration during the previous shift.
Maintenance has not inspected it yet."
```

### Hindi

```text
"पिछली शिफ्ट में मशीन 3 के साथ क्या हुआ था?"
```

```text
"पिछली शिफ्ट में मशीन 3 में असामान्य कंपन की समस्या आई थी।
मेंटेनेंस ने अभी तक इसका निरीक्षण नहीं किया है।"
```

### Hinglish

```text
"Machine 3 mein kya problem aayi thi?"
```

```text
"Machine 3 mein previous shift ke during abnormal vibration
report hui thi. Maintenance ne abhi tak inspect nahi kiya hai."
```

Hinglish support allows operators to communicate naturally using a mixture of Hindi and English.

---

## 5.3 Operational Memory

SHIFTmate uses **Qdrant** as its semantic operational memory layer.

Important operational information can be stored and later retrieved using semantic similarity.

For example:

```text
Machine 3 had abnormal vibration during the previous shift.
Maintenance has not inspected it yet.
The issue is affecting Order 178.
```

The next operator does not need to remember the exact sentence.

They can simply ask:

```text
"What happened with Machine 3?"
```

SHIFTmate searches its operational memory and retrieves relevant information.

The system is therefore not limited to the current conversation.

---

## 5.4 AI Responses with Gemini

Google Gemini is used for AI response generation.

The basic flow is:

```text
User Question
      +
Retrieved Operational Context
      ↓
    Gemini
      ↓
Generated Response
```

The AI is designed to:

* Use relevant operational memory
* Answer based on available context
* Keep responses understandable for operators
* Avoid inventing operational facts
* Avoid inventing maintenance actions
* Avoid inventing machine conditions
* Avoid inventing order information
* State when information is unavailable

If the requested information is not available in the operational context, the assistant should indicate that rather than creating a fictional incident.

---

## 5.5 Rime Text-to-Speech

Rime is used for text-to-speech.

Once the AI generates a response, the response can be converted into spoken audio.

The complete voice response pipeline is:

```text
Operator Voice
      ↓
Speech Recognition
      ↓
Text Query
      ↓
Qdrant Memory
      ↓
Gemini
      ↓
Text Response
      ↓
Rime
      ↓
Audio Response
```

---

## 5.6 Issue Tracking

SHIFTmate can turn operational information into structured issues.

For example:

```text
"Machine 5 mein temperature issue aa raha hai."
```

can result in:

```text
Machine: Machine 5
Issue: Temperature issue
Status: Reported
Priority: Medium
```

An issue can contain relevant operational details such as:

* Machine
* Issue description
* Status
* Priority
* Affected order
* Maintenance information
* Resolution information

The information becomes part of the operational state of the application instead of remaining only inside the conversation.

---

## 5.7 Machine Context

Issues are associated with machines whenever the relevant machine can be identified.

Example:

```text
Machine 5
├── Temperature issue
├── Status: Reported
├── Priority: Medium
└── Maintenance: Pending
```

Another machine may have:

```text
Machine 3
├── Abnormal vibration
├── Previous shift
├── Maintenance pending
└── Affected Order 178
```

This keeps operational issues connected to the machines they affect.

---

## 5.8 Shift Handover

Shift handover is one of the central parts of SHIFTmate.

At the end of a shift, the system can use the operational information collected during that shift to provide continuity for the next operator.

The workflow is:

```text
Current Shift
      ↓
Recorded Issues
      ↓
Machine Context
      ↓
Operational Memory
      ↓
Handover
      ↓
Next Shift
```

A handover can contain:

* Issues reported
* Unresolved issues
* High-priority issues
* Affected machines
* Relevant operational context
* Pending work
* Important previous-shift information

---

## 5.9 Dashboard

The Dashboard provides the current operational overview.

It includes information such as:

* Total issues
* Pending issues
* Resolved issues
* High-priority issues
* Active issues
* Voice Assistant
* Relevant Memory
* Conversation
* Current shift information

The Dashboard provides a quick overview of the current operational state.

---

## 5.10 Authentication

SHIFTmate supports Google Sign-In when Google OAuth is configured.

A local/development operator sign-in flow is also available for testing.

The authentication flow connects the operator with their application session and shift context.

```text
Operator
   ↓
Google Sign-In / Local Sign-In
   ↓
Authentication
   ↓
Operator Session
   ↓
SHIFTmate
```

The Google client secret must remain on the backend and should never be exposed through the frontend or committed to GitHub.

---

## 5.11 Notifications

Notifications provide another way to surface important operational information.

They can be used for:

* New issues
* Important operational updates
* Pending issues
* Resolved issues
* Shift-related information

---

## 5.12 Tasks and Reports

SHIFTmate includes dedicated areas for tasks and reports.

Tasks provide a place for operational actions and follow-up information.

Reports provide a broader view of operational information and activity collected by the application.

---

## 5.13 Profile and Settings

SHIFTmate includes operator-level profile and settings areas.

Settings provide access to application preferences such as:

* English/Hindi language selection
* Hinglish interaction
* Dark theme
* Light theme
* Operator session controls
* Sign out

---

# 6. How the AI Pipeline Works

The main AI request pipeline is:

```text
1. Operator asks a question
          ↓
2. Frontend sends the request
          ↓
3. Backend receives the query
          ↓
4. Query is searched against operational memory
          ↓
5. Relevant memories are retrieved
          ↓
6. Gemini receives the query + relevant context
          ↓
7. Gemini generates the response
          ↓
8. Response is returned to the frontend
          ↓
9. For voice requests, Rime converts it to audio
          ↓
10. Operator receives the response
```

The important part of this architecture is that AI responses are connected to operational context instead of being generated from the user's question alone.

---

# 7. Operational Memory with Qdrant

Qdrant is used as the semantic memory layer.

The memory system works approximately like this:

```text
Operational Text
       ↓
Text Embedding
       ↓
Embedding Vector
       ↓
Qdrant
       ↓
Semantic Search
       ↓
Relevant Memories
```

The purpose of the memory layer is to make operational information searchable by meaning.

When an operator asks:

```text
"What happened with Machine 3?"
```

the system does not require the operator to know the exact wording used when the incident was originally recorded.

Qdrant searches stored operational information and returns relevant memories.

Those memories are then used as context for the AI response.

---

## Why Semantic Memory Is Useful

Consider:

```text
"Machine 3 had abnormal vibration."
```

and:

```text
"Unusual vibration was detected on Machine 3."
```

They use different wording but describe essentially the same operational situation.

Semantic search can identify the relationship between the two descriptions.

This is useful because operators naturally use different wording when reporting and asking about incidents.

---

# 8. Persistent Operational Data

SHIFTmate uses a persistent local **SQLite database** for structured application and operational data.

The backend contains:

```text
db.py
shiftmate.db
```

The `shiftmate.db` file is the local SQLite database used by the backend.

The project therefore uses two different data-handling layers:

```text
SQLite
   ↓
Structured application / operational data

Qdrant
   ↓
Semantic operational memory
```

SQLite is used for structured records and application state.

Qdrant is used for semantic retrieval of operational information.

This allows the application to maintain both structured persistent data and searchable semantic context.

---

# 9. Issue Lifecycle

Issues can move through operational states.

A simplified lifecycle is:

```text
Reported
   ↓
Pending / Unresolved
   ↓
Resolved
```

For example:

```text
Machine 5
Temperature Issue
       |
       v
REPORTED
       |
       v
Maintenance Investigation
       |
       v
RESOLVED
```

The Dashboard uses issue states to provide counts such as:

```text
Total Issues
Pending
Resolved
High Priority
```

When an issue is resolved, the state is updated and the relevant frontend views can refresh their operational data.

---

# 10. Machine-Level Context

Machines are treated as operational entities.

A machine can have associated information such as:

* Current issue
* Issue status
* Priority
* Maintenance information
* Previous incidents
* Operational context

For example:

```text
Machine 3
├── Abnormal vibration
├── Previous shift
├── Maintenance pending
└── Affected Order 178
```

Another machine may have:

```text
Machine 5
├── Temperature issue
├── Reported
└── Pending resolution
```

This machine-level association keeps operational problems connected to the affected machine.

---

# 11. Handover Workflow

The handover workflow is designed around continuity.

A typical sequence is:

```text
Shift A
   |
   | Reports Machine 5 issue
   v
Issue stored
   |
   | Machine context updated
   v
Dashboard
   |
   | Shift ends
   v
Handover
   |
   v
Shift B
   |
   | "What happened with Machine 5?"
   v
Operational memory retrieves previous context
   |
   v
SHIFTmate answers
```

The information collected during one shift can therefore remain useful during the next shift.

---

# 12. Frontend

The frontend is built using:

* React
* Vite
* Tailwind CSS
* JavaScript
* Lucide Icons

The frontend provides the operator-facing application.

It is responsible for:

* Authentication UI
* Navigation
* Dashboard
* Voice interaction
* Language selection
* Conversation history
* Issue display
* Machine display
* Handover display
* Memory display
* Notifications
* Tasks
* Reports
* Profile
* Settings
* Theme switching

The frontend communicates with the FastAPI backend through HTTP requests.

```text
React UI
    ↓
API Requests
    ↓
FastAPI Backend
```

The frontend does not contain private API keys for Gemini, Qdrant or Rime.

---

# 13. Backend

The backend is built using Python and FastAPI.

The backend coordinates:

* Authentication
* AI requests
* Voice requests
* Operational memory
* Persistent application data
* Issues
* Machines
* Handover
* Notifications
* Shift information
* Rime audio generation

The main backend source files are:

```text
backend/
├── agent.py
├── db.py
├── gemini_service.py
├── main.py
├── qdrant_service.py
├── rime_service.py
└── requirements.txt
```

### `main.py`

Acts as the main FastAPI application and API layer.

### `agent.py`

Contains the AI/agent-side operational logic that connects user queries, retrieved context and response generation.

### `db.py`

Handles structured persistent database operations.

### `gemini_service.py`

Handles communication with Google Gemini.

### `qdrant_service.py`

Handles the semantic operational memory layer.

### `rime_service.py`

Handles Rime text-to-speech functionality.

### `shiftmate.db`

Local SQLite database used for persistent structured application data.

---

# 14. API Overview

The frontend communicates with the backend through API routes covering:

```text
Authentication
Issues
Machines
Voice / AI
Operational Memory
Handover
Notifications
Shift information
Health checking
```

The overall architecture is:

```text
Frontend
   |
   +---- Authentication
   |
   +---- AI / Voice
   |
   +---- Issues
   |
   +---- Machines
   |
   +---- Handover
   |
   +---- Notifications
   |
   +---- Shift Data
   |
   v
FastAPI
```

The backend communicates with:

```text
FastAPI
   |
   +---- SQLite
   |
   +---- Qdrant
   |
   +---- Gemini
   |
   +---- Rime
```

---

# 15. Technology Stack

| Technology          | Purpose                                     |
| ------------------- | ------------------------------------------- |
| React               | Frontend application                        |
| Vite                | Frontend development and build tool         |
| JavaScript          | Frontend logic                              |
| Tailwind CSS        | UI styling                                  |
| Lucide Icons        | Interface icons                             |
| Python              | Backend implementation                      |
| FastAPI             | Backend API                                 |
| Uvicorn             | ASGI server                                 |
| SQLite              | Persistent structured application data      |
| Google Gemini       | AI response generation                      |
| Qdrant              | Semantic operational memory                 |
| Sentence Embeddings | Semantic representation of operational text |
| Rime                | Text-to-speech                              |
| Web Speech API      | Browser speech recognition                  |
| Google OAuth        | Authentication                              |

---

# 16. Project Structure

```text
SHIFTmate/
│
├── backend/
│   ├── agent.py
│   ├── db.py
│   ├── gemini_service.py
│   ├── main.py
│   ├── qdrant_service.py
│   ├── rime_service.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── README.md
│   └── shiftmate.db
│
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── .env.example
│   └── README.md
│
├── .gitignore
└── README.md
```

The following directories should not be committed:

```text
venv/
node_modules/
__pycache__/
```

Real environment files should also remain private:

```text
backend/.env
frontend/.env
```

Only example environment files should be included:

```text
backend/.env.example
frontend/.env.example
```

---

# 17. Requirements

Before running SHIFTmate locally, install:

* Python 3.10 or newer
* Node.js
* npm
* Git

The backend requires valid credentials for the external services configured in the application:

* Google Gemini
* Qdrant
* Rime
* Google OAuth when enabled

---

# 18. Local Setup

## 18.1 Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/SHIFTmate.git
cd SHIFTmate
```

Replace `YOUR_USERNAME` with the GitHub account that owns the repository.

---

## 18.2 Backend Setup

```powershell
cd backend
```

Create a Python virtual environment:

```powershell
python -m venv venv
```

Activate it:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

---

## 18.3 Backend Environment Variables

Create:

```text
backend/.env
```

using:

```text
backend/.env.example
```

Example configuration:

```env
GEMINI_API_KEY=your_gemini_api_key

QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key

RIME_API_KEY=your_rime_api_key

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=your_google_callback_url
```

Use the exact variable names provided by the project's `.env.example`.

Never commit the actual `.env` file.

---

## 18.4 Start the Backend

From the `backend` directory:

```powershell
uvicorn main:app --reload
```

The backend normally runs on:

```text
http://127.0.0.1:8000
```

---

## 18.5 Frontend Setup

Open a second terminal.

From the project root:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

---

## 18.6 Frontend Environment Variables

Create:

```text
frontend/.env
```

using:

```text
frontend/.env.example
```

Example:

```env
VITE_API_BASE=http://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Use the exact variable names present in the project's `.env.example`.

---

## 18.7 Start the Frontend

```powershell
npm run dev
```

Vite will display the local frontend URL.

Normally:

```text
http://localhost:5173
```

If the port is already being used, Vite may automatically select another port such as:

```text
http://localhost:5174
```

Use the URL printed by Vite.

---

# 19. Running the Complete Application

## Terminal 1 — Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

## Terminal 2 — Frontend

```powershell
cd frontend
npm install
npm run dev
```

Then open the frontend URL provided by Vite.

Architecture:

```text
Browser
   |
   v
React + Vite
   |
   v
FastAPI
   |
   +---- Gemini
   |
   +---- Qdrant
   |
   +---- Rime
   |
   +---- SQLite
```

---

# 20. Google Authentication Setup

Google authentication requires a Google OAuth client configured for the application.

The frontend uses the Google client ID through its environment configuration:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

The backend uses backend-side Google credentials through its environment variables where required.

For local development, configure the appropriate localhost origin and callback/redirect configuration in Google Cloud.

For production, configure the production domain instead of localhost.

```text
Google Client ID
        ↓
Frontend

Google Client Secret
        ↓
Backend only
```

Never commit the Google client secret to GitHub.

---

# 21. Voice Setup

Voice functionality depends on browser microphone and speech-recognition support.

Recommended browsers:

* Google Chrome
* Microsoft Edge

When the application requests microphone access, allow it.

Voice flow:

```text
Click microphone
       ↓
Browser requests microphone access
       ↓
Speech Recognition starts
       ↓
Operator speaks
       ↓
Transcript is produced
       ↓
Query is sent to backend
       ↓
Gemini generates response
       ↓
Rime generates audio
       ↓
Audio response is played
```

---

# 22. Example Usage

## Previous Shift Context

```text
"What happened with Machine 3?"
```

Example response:

```text
Machine 3 had abnormal vibration during the previous shift.
Maintenance has not inspected it yet.
The issue is affecting Order 178.
```

---

## Machine Issue

```text
"Machine 5 mein temperature issue aa raha hai."
```

The application processes the statement and creates or updates the corresponding operational issue.

---

## Issue Resolution

An operator can resolve an existing issue through the issue controls.

```text
Reported / Pending
        ↓
Resolved
```

---

## Previous Shift Question

```text
"Was there any issue with Machine 7 during the previous shift?"
```

SHIFTmate searches the available operational context before generating the response.

---

## Hindi

```text
"पिछली शिफ्ट में कौन सी मशीन में समस्या आई थी?"
```

---

## Hinglish

```text
"Previous shift mein kaunsi machine mein issue tha?"
```

---

# 23. End-to-End Example

## Step 1 — Previous Shift Reports an Issue

```text
Machine 3 has abnormal vibration.
Maintenance has not inspected it.
Order 178 is affected.
```

The information becomes part of the operational context.

## Step 2 — New Operator Starts the Shift

```text
"What happened with Machine 3?"
```

## Step 3 — Qdrant Searches Memory

The query is converted into a semantic representation.

Qdrant searches stored operational information and retrieves relevant memories.

## Step 4 — Gemini Generates the Response

Gemini receives the current question together with the relevant retrieved context.

## Step 5 — Rime Generates Audio

The generated response is passed to Rime and converted into audio.

## Step 6 — New Issue is Reported

```text
"Machine 5 mein temperature issue bhi aa raha hai."
```

The application processes the new operational information and can create or update the relevant issue.

## Step 7 — Dashboard Reflects the Issue

The operational Dashboard can show the Machine 5 issue along with its status and priority.

The Machines section can also associate the issue with Machine 5.

## Step 8 — Shift Handover

At the end of the shift, collected operational information can be used as part of the handover.

The next operator can retrieve information about Machine 3 and Machine 5 without depending entirely on a verbal explanation.

---

# 24. Error Handling and Troubleshooting

## Backend Not Running

```powershell
uvicorn main:app --reload
```

Verify that the backend is running and that the frontend API URL is correct.

## Frontend Cannot Connect to Backend

Check:

```env
VITE_API_BASE=http://127.0.0.1:8000
```

Restart the frontend after changing environment variables.

## Microphone Permission

1. Check browser microphone permission.
2. Allow microphone access.
3. Refresh the page.
4. Use Chrome or Edge.

## Google Authentication Failure

Check:

* Google Client ID
* Google OAuth configuration
* Authorized JavaScript origins
* Authorized redirect/callback configuration
* Frontend environment variables
* Backend environment variables
* Localhost port configuration

## Qdrant Memory Not Appearing

Check:

* Qdrant URL
* Qdrant API key
* Collection configuration
* Backend logs
* Stored operational information

## Gemini Response Failure

Check:

* Gemini API key
* Backend logs
* Internet connection
* Gemini service availability

## Rime Audio Failure

Check:

* Rime API key
* Backend logs
* Rime service availability
* Audio response generation

## Vite Uses Another Port

If port `5173` is already occupied, Vite automatically chooses another available port.

Use the URL printed in the terminal.

---

# 25. Security

The following should never be committed:

```text
.env
venv/
node_modules/
__pycache__/
```

Private credentials include:

```text
Gemini API Key
Qdrant API Key
Rime API Key
Google OAuth Client Secret
```

Only example configuration files should be committed:

```text
backend/.env.example
frontend/.env.example
```

Example files should contain placeholders instead of real credentials.

---

# 26. Testing Checklist

## Backend

* [ ] Backend starts successfully
* [ ] Health endpoint responds
* [ ] Gemini configuration works
* [ ] Qdrant connection works
* [ ] Rime configuration works
* [ ] Authentication works
* [ ] Issue creation works
* [ ] Issue resolution works
* [ ] Machine information loads
* [ ] Notifications load
* [ ] Handover information loads
* [ ] SQLite persistence works

## Frontend

* [ ] Application loads
* [ ] Sign-in works
* [ ] Google authentication works when configured
* [ ] Dashboard loads
* [ ] Issues appear correctly
* [ ] Machine information appears correctly
* [ ] Handover information appears correctly
* [ ] Notifications load
* [ ] Memory results appear
* [ ] Conversation history updates
* [ ] English mode works
* [ ] Hindi mode works
* [ ] Hinglish mode works
* [ ] Light theme works
* [ ] Dark theme works
* [ ] Profile opens correctly
* [ ] Sign-out works

## Voice

* [ ] Microphone permission works
* [ ] Speech recognition starts
* [ ] English input works
* [ ] Hindi input works
* [ ] Hinglish input works
* [ ] Transcript appears
* [ ] Query reaches backend
* [ ] Gemini response is generated
* [ ] Rime audio is generated
* [ ] Audio plays
* [ ] Recognition can restart after ending

## Operational Flow

* [ ] New issue can be reported
* [ ] Issue is persisted
* [ ] Machine state reflects the issue
* [ ] Dashboard reflects the issue
* [ ] Issue can be resolved
* [ ] Resolved state appears correctly
* [ ] Handover contains relevant information
* [ ] Previous-shift context can be retrieved

---

# 27. Known Limitations

SHIFTmate is currently a functional hackathon prototype.

## Browser Voice Recognition

Voice input depends on browser speech-recognition support.

Recognition quality can vary depending on:

* Microphone quality
* Background noise
* Pronunciation
* Browser
* Network conditions
* Mixed-language speech

Chrome and Edge are recommended.

## AI Responses

SHIFTmate uses AI-generated responses based on available operational context.

AI-generated responses should still be treated as assistance rather than an independent authority for safety-critical decisions.

## Industrial Safety

SHIFTmate does not directly control industrial machinery.

It should not be connected to safety-critical machinery or used as an autonomous control system without appropriate engineering validation, security review and safety procedures.

## External Services

Some functionality depends on:

* Gemini
* Qdrant
* Rime
* Google OAuth
* Browser Speech Recognition

If an external service is unavailable, the corresponding functionality may not work.

## Deployment

SHIFTmate currently does not have a public live deployment.

The project is intended to be run locally using the provided frontend and backend setup.

---

# 28. Future Improvements

## Voice

* Streaming speech recognition
* Lower-latency voice responses
* Improved Hindi and Hinglish recognition
* Better handling of industrial background noise
* Wake-word support
* More natural real-time conversation

## Memory

* More advanced operational knowledge graphs
* Time-aware memory
* Machine-specific memory views
* Better historical incident retrieval
* Improved memory ranking
* Better context filtering

## Operations

* Maintenance scheduling
* Operator assignment
* Escalation workflows
* Audit logs
* Role-based permissions
* Real-time multi-operator collaboration

## Industrial Integration

* Sensor integration
* IoT data
* PLC/SCADA integration
* Production management systems
* Maintenance management systems
* Automatic anomaly detection

## Deployment

* Production authentication
* Monitoring
* Logging
* Rate limiting
* Better secret management
* Scalable backend infrastructure
* Production database architecture
* Cloud deployment

---

# 29. Project Presentation

The complete project presentation for SHIFTmate was prepared for the Starforge Hackathon.

[View SHIFTmate Project Presentation](https://drive.google.com/file/d/1Ue2h-FjYcdOL0o2uEiLHfVf7GXdpGEF4/view?usp=drivesdk)

---

# 30. Why SHIFTmate

SHIFTmate is not intended to be another general-purpose AI chatbot.

The main difference is the operational continuity layer.

A normal voice chatbot can look like:

```text
Voice
  ↓
AI
  ↓
Answer
```

SHIFTmate is designed as:

```text
Voice
  ↓
Operational Context
  ↓
Semantic Memory
  ↓
AI Reasoning
  ↓
Voice Response
  ↓
Persistent Issue
  ↓
Machine Context
  ↓
Dashboard
  ↓
Handover
  ↓
Next Shift
```

The goal is to make information useful beyond the moment in which it was originally spoken.

A machine issue reported by one operator can become context for another operator later.

A previous shift's information can be retrieved using natural language.

The system connects:

```text
Operator
   ↓
Conversation
   ↓
Operational Memory
   ↓
Issue
   ↓
Machine
   ↓
Shift
   ↓
Handover
   ↓
Next Operator
```

> **Preserve operational knowledge so the next shift does not start from zero.**

---

# 31. Team

SHIFTmate was developed by the following team for the **Starforge Hackathon**, organized by and at **JSS University, Noida**.

| Team Member | GitHub | Contribution |
|---|---|---|
| **Tanishq Agarwal** | [@Warrior1012](https://github.com/Warrior1012) | Backend + AI/ML |
| **Yashica Agarwal** | [@YashicaGitHubID](https://github.com/Yashica1234) | Frontend Development |
| **Shraddha Gupta** | [@ShraddhaGitHubID](https://github.com/shraddhagupta262007-droid) | UI/UX + Presentation |
| **Kshitij Pandey** |  [@Kshitij Pandey](https://github.com/kshitijog) |Project Support and Contribution |
---

# 32. License

SHIFTmate is licensed under the MIT License.

```text
MIT License

Copyright (c) 2026 Tanishq Agarwal, Yashica Agarwal, Shraddha Gupta, Kshitij Pandey

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Project Status

**Status:** Functional Hackathon Prototype

**Hackathon:** Starforge Hackathon

**Institution:** JSS University, Noida

**Primary Focus:** Voice-first AI operational continuity, machine context, issue tracking, semantic operational memory and shift handover

```
```
