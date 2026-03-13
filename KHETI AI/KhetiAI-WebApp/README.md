# Stremini — implement

# 🧠 The K2 Think Model Integration

KhetiAI is powered by **K2-Think-v2 (MBZUAI-IFM)**, a high-reasoning large language model optimized for complex decision‑making and chain‑of‑thought processing.

## Core Reasoning Architecture

The implementation utilizes a specialized backend (`agriintel-worker.js`) that manages the **"thinking"** process unique to this model:

### Think Block Management
The system handles the model's `<think>...answer` tags, stripping them for cleaner user interfaces while preserving the depth of the reasoning for complex queries.

### Chain‑of‑Thought Streaming
The `/api/chat` route transforms Server‑Sent Events (SSE) from the K2 API to deliver real‑time, expert advice to farmers while filtering out raw internal reasoning deltas.

### Structured Econometric Output
The market forecasting tool uses K2‑Think’s `json_mode` to ensure structured data is returned for price charts, even when performing complex multi‑month trend analysis.

## ✨ Key Features

### 1. AgriIntel AI Assistant (K2‑Powered)
A conversational interface delivering expert advice on farming, weather, and fertilizers.

- **Localized Intelligence:** Specifically tuned for Indian farmers, responding with simple language and regional empathy.
- **Contextual Memory:** Maintains a conversation history to provide relevant, field‑specific follow‑up advice.

### 2. Autonomous Crop Disease Detection
Leverages the multimodal capabilities of K2‑Think to analyze crop images.

- **Visual Diagnosis:** Processes base64 image data to identify diseases, pests, or nutrient deficiencies.
- **Pathology Report:** Returns structured Markdown including diagnosis, confidence levels, and organic/chemical treatment options.

### 3. Market Price Forecasting
An AI‑driven econometric tool for Indian commodity markets (APMC mandis).

- **Trend Analysis:** Predicts `"up"`, `"down"`, or `"stable"` trends based on market factors.
- **Forecast Schema:** Provides a 3‑month price forecast per quintal in INR.

### 4. Intelligence Hub (Agent Synergy)
A network of specialized agents that simulate cross‑farm intelligence:

- **Pest Migration Predictor:** Correlates regional reports with wind patterns to predict infestations.
- **Soil Memory Agent:** Tracks long‑term soil health inputs to build a farm‑specific playbook.
- **Farmer Knowledge Preservation:** Captures hyperlocal generational knowledge via AI interviews.

## 🛠 Technical Architecture

The application consists of a **React** frontend communicating with a high‑performance **Cloudflare Worker** backend.

### Backend (Cloudflare Worker)

- **Endpoint:** `https://api.k2think.ai/v1/chat/completions`
- **Model:** `MBZUAI-IFM/K2-Think-v2`
- **Routes:**
  - `POST /api/chat` – Streaming assistant.
  - `POST /api/analyze` – Vision‑based disease detection.
  - `POST /api/market` – Structured JSON price forecasting.

### Frontend (React)

- **State Management:** React 19 hooks for handling image uploads, chat streams, and market data.
- **UI Components:** Tailwind CSS with Lucide‑React icons for a modern, accessible experience.

## 🚀 Deployment

### Backend Deployment (Wrangler)

1. Navigate to the project root.
2. Set your API key: `wrangler secret put K2_API_KEY`.
3. Deploy the worker: `wrangler deploy`.

### Frontend Deployment

1. Install dependencies: `npm install`.
2. Update your environment variables to point to your Worker URL.
3. Build and run: `npm run dev`.
