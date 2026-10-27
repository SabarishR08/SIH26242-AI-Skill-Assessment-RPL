# Contributing Guide

Thank you for considering contributing to this project! This document outlines local development setup, testing workflows, and submission guidelines.

## Prerequisites

- **Node.js**: v18+ (refer to `.nvmrc` / `.node-version`)
- **npm**: Package manager
- **Python**: 3.9+ (optional, for ML pipeline scripts in `ml/`)

## Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Copy `.env.example` to `.env` if provided and update environment variables:
   ```bash
   cp .env.example .env
   ```

4. **Database Setup (Prisma)**:
   Generate the Prisma client and sync schema:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

## Code Quality & Linting

Before submitting changes, check for linting or TypeScript errors:

```bash
npm run lint
npx tsc --noEmit
```

## Running Tests

### Unit & Integration Tests (Vitest)
Run unit tests with Vitest:
```bash
npm test
```

### End-to-End Tests (Playwright)
Run Playwright E2E tests:
```bash
npx playwright test
```

### Machine‑Learning Scripts (Optional)
If you are working on the ML pipeline located in `ml/`:
1. Install Python dependencies:
   ```bash
   cd ml
   pip install -r requirements.txt
   ```
2. Run the data collection or model scripts as described in `ml/README.md`.
3. To execute the full pipeline locally:
   ```bash
   ./ml/run.sh
   ```
4. Ensure any added Python code passes linting (`flake8`) and unit tests (if applicable).

## Pull Request Workflow

1. Create a topic branch off `main` (e.g., `feature/description` or `fix/description`).
2. Keep changes minimal, targeted, and well-tested.
3. Ensure linting and tests pass.
4. Submit a Pull Request with a clear description of the changes made.