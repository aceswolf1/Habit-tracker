# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PixelPaladin** is a gamified habit tracker with 8-bit pixel graphics and RPG elements. The project consists of a Nuxt 3 frontend and an Express backend with MongoDB.

### Directory Structure

```
Habit-tracker/
├── frontend/
│   ├── frontend/        # Nuxt 3 application (actual code)
│   └── backend/         # Empty folder (not used)
└── backend/             # Express + MongoDB backend (at project root)
```

**Note**: From the current working directory (`frontend/`), the backend is located at `../backend/`.

## Development Commands

### Frontend (Nuxt 3)
Working directory: `frontend/frontend/` (or `./frontend/` from current location)

```bash
# Install dependencies
npm install

# Development server (runs on http://localhost:3001)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Prepare Nuxt
npm run postinstall
```

### Backend (Express + MongoDB)
Working directory: `../backend/` (relative to current location at `frontend/`)

```bash
# Install dependencies
npm install

# Development server with auto-reload (runs on http://localhost:4000)
npm run dev

# Production server
npm start
```

**Important**: Both frontend and backend must be running for the application to work. The frontend expects the backend API to be available at `http://localhost:4000`.

## Architecture

### Data Model Hierarchy

The application uses a nested hierarchical structure:

```
Month (1)
  ├── Weeks (4)
  │   ├── Days (7 per week)
  │   │   ├── Tasks (n per day)
```

#### Key Entities

- **Month**: Top-level container with overall progress tracking
  - Fields: uuid, name, subtitle, progress, weeks[], finished, createdAt, finishedAt

- **Week**: Represents a weekly "boss battle" challenge
  - Fields: uuid, name, subtitle, progress, conquered, backgroundImages[], days[]

- **Day**: Individual day within a week
  - Fields: uuid, name, subtitle, tasks[]

- **Task**: Individual habit/quest to complete
  - Fields: uuid, description, optional, completed, recurrenceId, order, icon (emoji)

### State Management (Pinia)

**Primary Store**: `stores/monthStore.ts`

The month store is the central source of truth for all application data. It:
- Manages the current month and all months
- Handles task CRUD operations (create, update, delete, move)
- Calculates progress values for days, weeks, and months
- Persists changes to the backend API
- Implements recurrence patterns for repeating tasks

**Key Store Actions**:
- `fetchMonthData()`: Load current month from backend
- `toggleTaskCompletion(taskUuid)`: Toggle task completion and persist
- `bulkAddTasks(options)`: Add tasks to multiple days/weeks with recurrence support
- `updateTask(taskUuid, payload)`: Update task properties
- `deleteTask(taskUuid, scope)`: Delete single task or entire recurrence
- `moveTask(taskUuid, targetDayUuid, targetIndex)`: Drag-and-drop task reordering
- `finishCurrentMonth()`: Lock month as immutable
- `updateProgressValues()`: Recalculate all progress percentages

**Progress Calculation**:
- **Day Progress**: Completed required tasks / Total required tasks
- **Week Progress**: Average of all day progress values (0-100%)
  - Week is "conquered" when all required tasks are complete
- **Month Progress**: Average of all week progress values
  - Base progress capped at 100%
  - Bonus progress (+10% max) from optional tasks once base is 100%
  - Final progress can reach 110%

### Backend API

**Base URL**: `http://localhost:4000/api/cycles`

The backend uses Express + MongoDB with the following endpoints:

- `GET /api/cycles/current` - Get current active month/cycle
- `GET /api/cycles` - Get all months/cycles
- `PATCH /api/cycles/:monthUuid` - Update month data
  - Supported operations via `type` field:
    - `addTasks`: Bulk add tasks to days
    - `deleteTasks`: Remove tasks by UUID or recurrenceId
    - `updateTasks`: Update task properties (completion, description, etc.)
- `POST /api/tasks` - Legacy endpoint for various operations:
  - `createMonth`: Create new empty month (4 weeks × 7 days)
  - `setCurrentMonth`: Switch active month
  - `finishMonth`: Mark month as immutable/finished

**Important**: The backend recalculates and persists progress values using the same logic as the frontend store.

### Frontend Structure

**Main App**: `app.vue`
- Single-page application with all UI in one file
- Displays month/week/day hierarchy with progress tracking
- Gamification elements: tier system (Bronze → Silver → Gold → Champion → Final)
- Particle effects and 8-bit CRT aesthetic

**Key Components**:
- `TaskModal.vue`: Create/edit task dialog with emoji picker and recurrence options
- `Day.vue`: Displays daily tasks with drag-and-drop support
- `WeeklyBossPortrait.vue`: Visual representation of weekly progress
- `MonthSelector.vue`: Switch between months
- `ToastNotification.vue`: User feedback messages
- `BackgroundParticles.vue` & `ProgressParticles.vue`: Visual effects

**Styling**:
- TailwindCSS with custom pixel art color palette
- Custom font: "Press Start 2P" (8-bit style)
- SCSS for advanced animations and effects
- CSS variables defined for pixel theme colors

### Type Definitions

Located in `types/index.ts` - defines TypeScript interfaces for Month, Week, Day, Task entities. These are duplicated in the Pinia store file for convenience but should match the shared type definitions.

## Important Development Notes

### Working with Tasks

1. **Recurrence Pattern**: Tasks can be linked via `recurrenceId` to create recurring habits across multiple days/weeks
2. **Optional Tasks**: Tasks marked as `optional: true` contribute bonus progress only after all required tasks are complete
3. **Task Icons**: Tasks support emoji icons for visual identification
4. **Immutability**: Once a month is marked `finished: true`, no modifications are allowed

### Progress System

The progress calculation is critical to the gamification:
- Required tasks contribute to base progress (0-100%)
- Optional tasks add bonus progress (+2% each, max 10%) only when base is 100%
- Progress is recalculated on every task state change
- Week "conquered" status is binary (all required tasks must be complete)

### State Synchronization

- Frontend optimistically updates UI immediately
- Changes are persisted to backend via PATCH requests
- Backend response updates the store to ensure consistency
- Always call `updateProgressValues()` after state mutations

### Styling Conventions

- Use `font-press` or `font-family: 'Press Start 2P'` for retro text
- Pixel-perfect borders with `border-2 border-black`
- Shadow effects: `shadow-pixel` or `box-shadow: 4px 4px 0 rgba(0,0,0,0.8)`
- Color scheme: dark blues, amber/gold accents, pixel-dark backgrounds

### Common Pitfalls

1. **Don't modify tasks directly**: Always use store actions to ensure progress recalculation and persistence
2. **Check `finished` state**: Prevent modifications to locked months
3. **UUID generation**: Use format like `t-${Math.random().toString(36).slice(2)}` for consistency
4. **Reactivity**: Use `storeToRefs()` when accessing Pinia state in components to maintain reactivity

## Testing the Application

1. Start MongoDB (ensure it's running on default port 27017)
2. Start backend: `cd ../backend && npm run dev`
3. Start frontend: `cd frontend && npm run dev` (from `frontend/` directory)
4. Open browser to `http://localhost:3001`
5. Create a new month if none exists
6. Add tasks to days and toggle completion to see progress updates
