# Stremini — implement

# AI Systems Ecosystem

Welcome to the **AI Systems Ecosystem** repository. This monorepo houses two major AI‑driven projects: **Kheti AI** (an agricultural intelligence ecosystem) and **Stremini AI** (an advanced, device‑integrated AI assistant and agentic workspace). 

This repository contains the full stack for both platforms, including mobile applications, web portals, specialized AI backends, and agent architectures.

---

## Table of Contents

- [Projects Overview](#projects-overview)
  - [1. Kheti AI](#1-kheti-ai)
  - [2. Stremini AI](#2-stremini-ai)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Detailed Features](#detailed-features)
  - [Kheti AI Features](#kheti-ai-features)
  - [Stremini AI Features](#stremini-ai-features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Running Kheti AI](#running-kheti-ai)
  - [Running Stremini AI](#running-stremini-ai)
- [Contributing](#contributing)
- [License](#license)

---

## Projects Overview

### 1. Kheti AI
**Kheti AI** is a comprehensive agricultural tech solution designed to empower farmers with AI‑driven insights. It provides disease detection for crops, an agricultural chatbot for instant assistance, weather forecasting, budget management, and a marketplace. The platform bridges the gap between traditional farming and modern AI capabilities.

### 2. Stremini AI
**Stremini AI** is a powerful AI assistant and agentic ecosystem. Unlike standard chatbots, the Stremini mobile app integrates deeply with the device using Accessibility services, screen reading, and a custom keyboard (StreminiIME) to provide contextual, system‑wide AI assistance. It also features a “Workspace and Academy” powered by specialized autonomous agents (Legal, Finance, Growth, Research, etc.).

---

## Project Structure

```text
.
├── KHETI AI/
│   ├── KHETI AI MOBILE BACKEND/      # Node.js backend for Ag‑chatbot and Disease Detection
│   ├── KhetiAI MOBILE APP FRONTEND/  # Flutter‑based mobile application
│   └── KhetiAI-WebApp/               # React + Vite web dashboard
│
└── Stremini AI/
    ├── Stremini- Mobile app backend/             # Core backend for mobile integrations (chat, security, automation)
    ├── Stremini-Agent and academy -Backend/      # Backend housing specialized AI agent personas
    ├── Stremini-workspace and Academy Frontend/  # Web portal for the Agent Workspace
    └── Streminiai-Mobile APP Frontend/           # Flutter mobile app with deep Android native integrations
```

## Technology Stack

**Frontend**  
- Mobile Apps: Flutter & Dart  
- Web Apps: React, Vite, TypeScript, Tailwind CSS, HTML/JS  

**Native Android (Stremini)**  
- Kotlin (Accessibility Services, Custom IME Keyboard, Screen Reader)

**Backend**  
- Runtime: Node.js / JavaScript  
- Database & Auth: Supabase (integrated into Kheti AI)  
- AI Integrations: Gemini API (referenced in `geminiService.ts`)

## Detailed Features

### Kheti AI Features
- **Plant Disease Detection:** Upload images of crops to instantly diagnose diseases and get treatment recommendations.  
- **Agri‑Chatbot:** Context‑aware assistant trained on agricultural data to answer farming queries.  
- **Marketplace & Budgeting:** Tools for farmers to track budgets, find market prices, and assess loan eligibility.  
- **Weather Integration:** Real‑time localized weather updates tailored for agricultural planning.  
- **Cross‑Platform:** Available as a rich Flutter mobile app and a responsive React web application.

### Stremini AI Features
#### System‑Wide Mobile Integration (Android)
- **Floating Chatbot & Overlays:** Access AI anywhere on your phone via `ChatOverlayService`.  
- **AI Keyboard (StreminiIME):** Custom input method to generate, translate, or correct text in any app.  
- **Screen Context Awareness:** Analyzes current screen content via Accessibility Services to provide highly contextual answers.

#### Multi‑Agent Academy Workspace
- **Architect Agent:** System design and architecture planning.  
- **Fin Agent:** Financial analysis and planning.  
- **Legal Agent:** Startup legal compliance and document structuring.  
- **Growth & Research Agents:** Market analysis, competitive intelligence, and growth hacking.  
- **Automation:** Built‑in hooks for device command routing and auto‑tasking.

## Getting Started

### Prerequisites
Make sure you have the following installed on your local development machine:

- Flutter SDK (v3.10+)  
- Node.js (v18+)  
- npm or yarn  
- Android Studio / Xcode (for mobile development)

### Running Kheti AI

#### 1. Kheti AI Web App
```bash
cd "KHETI AI/KhetiAI-WebApp"
npm install
# Copy .env.example to .env and add your Supabase/Gemini keys
npm run dev
```

#### 2. Kheti AI Mobile App
```bash
cd "KHETI AI/KhetiAI MOBILE APP FRONTEND"
flutter pub get
flutter run
```

#### 3. Kheti AI Backend
```bash
cd "KHETI AI/KHETI AI MOBILE BACKEND"
node "Agriculture chatbot.js"
# In a separate terminal
node "Plant Disease Detection.js"
```

### Running Stremini AI

#### 1. Stremini Mobile App
> Note: Due to deep native integrations, running on a physical Android device is highly recommended over an emulator.

```bash
cd "Stremini AI/Streminiai-Mobile APP Frontend"
flutter pub get
flutter run
```
Once installed, you will need to grant **Accessibility** and **Display Over Other Apps** permissions in your Android settings to fully utilize the Screen Reader and Floating Assistant.

#### 2. Stremini Agent Backend
```bash
cd "Stremini AI/Stremini-Agent and academy -Backend"
npm install   # (If package.json is initialized)
node index.js
```

#### 3. Stremini Workspace Frontend
Serve the static files in the `Stremini-workspace and Academy Frontend` directory using any local server (e.g., Live Server in VS Code, or `npx serve`).

## Contributing
1. **Fork** the project.  
2. **Create** your feature branch (`git checkout -b feature/AmazingFeature`).  
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`).  
4. **Push** to the branch (`git push origin feature/AmazingFeature`).  
5. **Open** a Pull Request.

## License
Distributed under the MIT License. See `LICENSE` for more information.
