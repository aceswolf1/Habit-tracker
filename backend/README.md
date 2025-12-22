# Habit Tracker Backend

This is a Node.js backend for the Habit Tracker app, built with TypeScript, TypeORM, and PostgreSQL.

## Features

- Create a month (auto-generates 4 weeks, each with 7 days)
- CRUD for months and tasks
- No authentication system

## Entities

- Month: uuid, name, subtitle, progress, weeks
- Week: uuid, name, subtitle, progress, conquered, backgroundImages, days
- Day: uuid, name, subtitle, tasks
- Task: uuid, description, optional, completed, order, recurrenceId

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure PostgreSQL connection in `ormconfig.ts`.
3. Start the server:
   ```bash
   npm run dev
   ```

## API Endpoints

- `POST /months` - Create a new month
- `GET /months` - Get all months with nested weeks/days/tasks
- `POST /tasks/:dayUuid` - Add a task to a day
- `PUT /tasks/:taskUuid` - Update a task
