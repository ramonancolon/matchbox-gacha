# Matchbox Gacha

Matchbox Gacha is a polished, browser-based memory matching game built with React, Tailwind CSS, and Firebase. It features high-fidelity animations, a global leaderboard, and an AI-powered "Suggestion" system.

## 🚀 Clone And Run

### Prerequisites
- Node.js (v18+)
- npm

### Local Setup
1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd matchbox-gacha
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Fill required values in `.env`:
   - `VITE_GEMINI_API_KEY`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

5. **Optional checks before shipping changes**:
   ```bash
   npm run lint
   npm run build
   ```

## 🛠 Features
- **Global Leaderboard**: Securely stored high scores via Firestore.
- **AI Suggestions**: Powered by Gemini 3.5 Flash to help players find matching pairs.
- **Responsive Design**: Optimized for Mobile, Tablet (Landscape), and Desktop.
- **Interactive UI**: Fluid animations using `motion` and crisp icons from `lucide-react`.

## 🤝 Contributing

We welcome contributions. Use this workflow for every feature or fix:

1. **Create a branch** from `main`.
2. **Implement the change** with focused commits.
3. **Add or update tests** for the behavior you changed.
4. **Run required checks locally**:
   ```bash
   npm run test
   npm run lint
   npm run build
   ```
5. **Open a pull request** with:
   - What changed
   - Why it changed
   - How it was tested

## ✅ Testing Guide

### Run all test cases
```bash
npm run test
```

### Watch mode while developing
```bash
npm run test:watch
```

### Coverage report
```bash
npm run test:coverage
```

### When adding a new feature (required)
- Add tests for new logic/components before merging.
- Update existing tests if behavior intentionally changed.
- Do not merge a feature unless `npm run test` passes.

---
Built as part of the Vibe Coder Exercise.
