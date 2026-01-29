# AGENTS.md - SimpleLIMS-Offline

## Commands
- **Dev server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck`
- **No test framework configured**

## Architecture
- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS
- **State**: Zustand (global), TanStack Query (server state)
- **Backend**: Supabase (auth, database, storage)
- **Routing**: react-router-dom v7 with lazy-loaded pages
- **Key dirs**: `src/pages/` (routes), `src/components/`, `src/services/` (API layer), `src/lib/` (Supabase, OpenAI clients), `src/contexts/` (Auth, Theme), `src/hooks/`, `src/types/`

## Code Style
- TypeScript strict mode enabled (`noUnusedLocals`, `noUnusedParameters`)
- Functional components with hooks; no class components
- Use existing UI components from `src/components/ui/`
- Services follow `*.service.ts` naming convention
- Lazy load non-critical pages for Core Web Vitals
- Use `lucide-react` for icons, `sonner` for toasts
- Imports: React/libs first, then local modules (components, hooks, utils)
- Error handling: Use TanStack Query error states; Sentry for logging
