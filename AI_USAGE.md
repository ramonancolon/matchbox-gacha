# AI Usage

## How AI Was Used
AI was utilized as a lead engineer and product designer throughout this project. It powerd three main areas:

### 1. Feature Implementation (Matchbox Suggestion)
The "AI Suggestion" feature uses the **Gemini 3.5 Flash** model via the `@google/genai` SDK. I used AI to:
- Design the prompting strategy for "perfect information" game analysis.
- Implement the server-side logic (bridged via a client-side wrapper in this SPA) to analyze the current game state and suggest moves.

### 2. UI/UX Polishing
I used the AI's internal design skills to:
- Select a professional color palette and typography.
- Draft complex Tailwind layouts, specifically for the tablet-landscape responsive logic.
- Iterate on header density and icon placement based on natural language feedback.

### 3. Verification & Compliance
AI was tasked with:
- Generating and verifying **Firestore Security Rules** to ensure the database is secure against unauthorized writes.
- Performing iterative linting and build checks to maintain a "green" production pipeline.

## What I Verified Manually
- **Mobile Touch Targets**: I manually reviewed the button sizing (44px+) and spacing to ensure accessibility.
- **Firebase Auth Flow**: Verified the Google Sign-in popup behavior and Firestore data consistency.
- **Responsive Breakpoints**: I stress-tested the application across common viewport sizes to ensure the sidebar transitions were smooth and logical.

## Where AI Helped Most
The most significant advantage was **parallel execution**. While brainstorming the layout, the AI was concurrently writing the secure database schema and deployment scripts, allowing the project to reach a "Day 1" ship-ready state in record time.
