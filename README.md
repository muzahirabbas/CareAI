# TransplantCare Pro (Caregiver & Patient PWA)

TransplantCare Pro is a sophisticated Progressive Web Application (PWA) designed to bridge the gap between caregivers and patients, specifically tailored for transplant recovery and chronic care management. It leverages cutting-edge AI for medical document parsing, real-time notifications, and data-driven health insights.

## 🚀 Features

### 👥 Dual-Role Dashboards
- **Caregiver Portal:** Monitor multiple patients, track medication adherence, view AI-generated health trends, and receive real-time alerts.
- **Patient Portal:** Log vitals, upload medical reports, confirm medication intake, and access personal health history.

### 🧠 Intelligent OCR & Medical Parsing
- **Document Processing:** Automatically extract text from medical reports (Images and PDFs) using **Tesseract.js** and **PDF.js**.
- **AI-Driven Data Extraction:** Uses **Google Gemini 2.5 Flash** (via Cloudflare Workers) to intelligently map raw OCR text into structured medical vitals and document dates.

### 📊 AI Health Analytics
- **Medical Trend Reports:** Provides compassionate, structured health summaries by cross-referencing patient vitals with their specific demographics (age, weight, gender).
- **Pattern Recognition:** Highlights stability or potential concerns in patient data chronologically.

### 🔔 Real-Time Communication
- **Web Push Notifications:** Instant alerts for medication reminders, vital updates, and caregiver check-ins using **VAPID** and **Cloudflare Workers**.
- **Activity Log:** A comprehensive history of patient-caregiver interactions and health events.

### 📱 Modern PWA Experience
- **Fully Responsive:** Beautifully designed with **Tailwind CSS** and **Framer Motion**.
- **Installable:** Add to home screen for a native app experience on iOS, Android, and Desktop.
- **Offline Support:** Service worker integration for reliable performance.

---

## 🛠 Tech Stack

- **Frontend:** React (TypeScript), Vite, Tailwind CSS, Framer Motion, Recharts, Lucide React.
- **Backend/Database:** Firebase Firestore (NoSQL), Firebase Authentication.
- **Serverless/Infrastructure:** Cloudflare Workers (AI, Push, Storage), Cloudflare R2 (Asset Storage).
- **AI/ML:** Google Gemini 2.5 Flash API.
- **OCR:** Tesseract.js, PDF.js.

---

## 📂 Project Structure

```text
├── src/                    # React Frontend
│   ├── components/         # Caregiver & Patient Dashboards
│   ├── utils/              # OCR and Utility functions
│   └── firebase.ts         # Firebase configuration
├── ai-worker/              # Cloudflare Worker for Gemini Health Analysis
├── upload-worker/          # Cloudflare Worker for R2 Asset Management
├── worker/                 # Cloudflare Worker for Web Push Notifications
├── workers/
│   ├── vitals-ocr-parser/  # AI parsing of raw OCR text
│   └── r2-cleanup-cron/    # Maintenance tasks
├── public/                 # PWA icons and Service Worker
└── scripts/                # VAPID key generation scripts
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Node.js (v18+)
- Firebase Account
- Cloudflare Account (with Workers & R2 enabled)
- Google Gemini API Key

### 2. Frontend Setup
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Create a Firebase project and add your config to `src/firebase.ts`.
4. Generate VAPID keys:
   ```bash
   cd scripts
   npm install
   node generate-vapid.js
   ```
5. Add the **VAPID Public Key** to your `.env` or `App.tsx`.

### 3. Backend (Cloudflare Workers)
Each worker in the subdirectories (`ai-worker`, `worker`, `upload-worker`, `workers/vitals-ocr-parser`) needs to be deployed using Wrangler:
1. `cd [worker-directory]`
2. `npm install`
3. Configure `wrangler.toml` or `wrangler.jsonc` with your specific IDs.
4. Add secrets:
   ```bash
   wrangler secret put GEMINI_API_KEY
   wrangler secret put VAPID_PRIVATE_KEY
   ```
5. Deploy: `wrangler deploy`

---

## 🚀 Deployment

### Frontend (Cloudflare Pages or Firebase Hosting)

**Option A: Cloudflare Pages (Recommended)**
1. Ensure `wrangler` is installed globally: `npm install -g wrangler`.
2. Run the deployment script: `deploy.bat` (Windows) or:
   ```bash
   npm run build
   wrangler pages deploy dist --project-name=transplantcare
   ```

**Option B: Firebase Hosting**
1. Build the app: `npm run build`.
2. Initialize Firebase: `firebase init hosting`.
3. Deploy: `firebase deploy --only hosting`.

### Workers
Deploy all workers as described in the setup section. Ensure the frontend `fetch` URLs in `PatientDashboard.tsx` and `CaregiverDashboard.tsx` match your deployed Worker URLs.

---

## 🛡 Security
- **Firebase Rules:** Ensure `firestore.rules` are configured to restrict data access to authorized caregivers and their assigned patients.
- **Encrypted Storage:** Assets are stored in private R2 buckets and served via secure Workers.
- **VAPID Authentication:** Push notifications are cryptographically signed to prevent unauthorized messaging.

## 📄 License
MIT License - see [LICENSE](LICENSE) for details.
