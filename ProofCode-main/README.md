# ProofCode 🛡️

> **Closed-Loop AST Code Security Scanner & AI Automated Repair Engine**

ProofCode is a modern web application designed to automatically scan JavaScript and TypeScript codebases for vulnerabilities using Abstract Syntax Tree (AST) static analysis, propose surgical code fixes using AI, and verify those fixes by executing unit test suites in an isolated sandbox.

---

## ✨ Features

- **AST-Based Static Analysis**: Deeply inspects code structure to detect security vulnerabilities and anti-patterns.
- **AI-Powered Surgical Repair**: Generates targeted fixes that preserve formatting and code context.
- **Test Suite Verification**: Automatically runs tests to ensure proposed fixes don't introduce regressions.
- **Firebase Authentication**: Integrated Email/Password & Google Sign-In with seamless guest mode ("Continue without signing in").
- **Interactive Dashboard**: Track scan history, risk scores, issue severity, and verification logs.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Authentication**: [Firebase Auth](https://firebase.google.com/)
- **Icons**: [Lucide React](https://lucide.react.dev/)

---

## 🚀 Quick Start

### 1. Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+) installed.

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/YOUR_USERNAME/proofcode.git
cd proofcode
npm install
```

### 3. Environment Setup (Optional)

Firebase is pre-configured in `src/lib/firebase.ts`. If you want to use custom environment variables, create a `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Building for Production

To create an optimized production build:

```bash
npm run build
npm start
```

---

## 📂 Project Structure

```text
proofcode/
├── src/
│   ├── app/            # Next.js App Router pages & API routes
│   │   ├── login/      # Sign-in page (Firebase + Google Auth)
│   │   ├── signup/     # Sign-up page
│   │   ├── projects/   # Dashboard & project details
│   │   └── page.tsx    # Home page
│   ├── components/     # Shared UI components (Navbar, Footer, etc.)
│   └── lib/            # Firebase config & utilities
├── public/             # Static assets
├── .gitignore          # Excludes node_modules, .next, etc.
├── next.config.js      # Next.js configuration
├── package.json        # Dependencies & scripts
└── README.md           # Project documentation
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.
