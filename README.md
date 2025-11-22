# Brighttrail Prototype

A scheduling and appointment management application built with Next.js 16. This prototype includes a staff portal for managing therapist schedules, checking availability, and booking appointments.

## Tech Stack

- **Framework:** [Next.js 16 (App Router)](https://nextjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components:** [Shadcn UI](https://ui.shadcn.com/) ('New York' style, 'Slate' theme)
- **Database:** [SQLite](https://github.com/WiseLibs/better-sqlite3) via `better-sqlite3`
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **State/Date Management:** React 19, `date-fns` v3, `react-day-picker` v8

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd brighttrail-prototype
   ```

2. Install dependencies:
   > **Note:** Due to React 19 peer dependency conflicts with `react-day-picker` v8, you must use the `--legacy-peer-deps` flag.
   ```bash
   npm install --legacy-peer-deps
   ```

### Database Setup

The project uses a local SQLite database (`sqlite.db`).

1. **Push the schema** to create the database tables:
   ```bash
   npm run db:push
   ```

2. **Seed the database** with initial data (therapists, locations, etc.):
   ```bash
   npm run seed
   ```

### Running the Application

To start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The main staff portal is available at `/staff`.

To build and run for production:

```bash
npm run build
npm run start
```

## Project Structure

- **`src/app`**: Next.js App Router pages and layouts.
  - **`src/app/api`**: Backend API endpoints (`/appointments`, `/slots`, etc.).
  - **`src/app/staff`**: Frontend for the Staff Portal.
- **`src/components/ui`**: Reusable UI components (Shadcn).
- **`src/db`**: Database configuration.
  - `schema.ts`: Drizzle ORM schema definitions.
  - `seed.ts`: Data seeding script.
- **`src/lib`**: Utility functions.
- **`src/app/globals.css`**: Global styles, including Tailwind v4 configuration and Shadcn CSS variables.

## Development Notes

- **Tailwind CSS v4**: This project uses the latest Tailwind v4. Configuration is handled directly in CSS files (e.g., `@theme` blocks in `globals.css`) rather than a `tailwind.config.ts`.
- **Timezones**: All internal date logic and API payloads generally handle Datetimes as Unix timestamps (integers) or local date strings (YYYY-MM-DD) to avoid UTC shifting issues.
- **Availability**: Slots are generated in 30-minute intervals.
- **Appointments**: The system performs server-side collision detection and returns `409 Conflict` if an overlap occurs.
- **Database Config**: `better-sqlite3` is configured as an external package in `next.config.ts` to work correctly with the Next.js server build.

## Scripts

- `npm run dev`: Start development server.
- `npm run build`: Build the application.
- `npm run start`: Start production server.
- `npm run lint`: Run ESLint.
- `npm run db:generate`: Generate Drizzle migrations.
- `npm run db:push`: Push schema changes to the database.
- `npm run seed`: Run the database seed script.
