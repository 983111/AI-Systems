# 🌾 KhetiAI (Farms)

KhetiAI is a comprehensive Flutter-based mobile application designed to empower farmers and agricultural stakeholders. By integrating modern technologies like Supabase for backend services, real-time weather tracking, and AI-driven support, the app serves as a versatile tool for farm management and technical assistance.

---

## 🚀 Core Features

### 🔐 Secure Authentication
- Sign-Up & Login system  
- OTP Verification  
- Powered by Supabase Authentication  

### 🤖 AI Farming Assistant
- Real-time chatbot support  
- Crop management advice  
- Weather-based recommendations  
- Pest control guidance  
- Equipment suggestions  

### 🌿 Plant Disease Detection
- Upload or capture leaf images  
- AI-based disease identification  
- Treatment recommendations  

### 🛒 Agricultural Marketplace
- Post products for sale or rent  
- Browse marketplace listings  
- Search and filter options  
- Multiple pricing models:
  - Hourly
  - Daily
  - Fixed  
- Image upload & location support  

### 💰 Budget & Finance Management
- Track income & expenses  
- Daily, monthly, yearly views  
- Detailed transaction logs  
- Secure Row Level Security (RLS)  

### 🌦 Real-Time Weather
- Localized weather data  
- 7-day forecast  
- Humidity tracking  
- Wind speed updates  

---

## 🏗 Technical Architecture

### 🧰 Tech Stack
- **Frontend:** Flutter (SDK ^3.8.1)  
- **Backend:** Supabase (Database, Authentication, Storage)  

### 📦 Key Libraries
- geolocator  
- image_picker  
- intl  
- url_launcher  
- carousel_slider  

---

## 🗄 Database Schema

### 👤 users Table
- User profile information  
- Contact details  
- Account metadata  

### 📊 transactions Table
- Financial records  
- Linked to user accounts  
- Secured with Row Level Security (RLS)  

### 🛍 Marketplace Data
- Product listings  
- Pricing model  
- Location data  
- Image storage  

---

## ⚙️ Getting Started

### ✅ Prerequisites
- Flutter SDK installed  
- Supabase project created  

### 📥 Installation

1. Clone the repository:

```bash
git clone <https://github.com/983111/KhetiAI>


lib/
 ├── screens/      # UI views (Marketplace, Budget, Weather, etc.)
 ├── services/     # Authentication, Marketplace, AI logic
 ├── widgets/      # Reusable UI components
assets/            # Images & onboarding illustrations
