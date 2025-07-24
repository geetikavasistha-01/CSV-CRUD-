# CSV CRUD Web Application

A modern, full-featured CSV data management app built with Next.js and Supabase.

---

## 🚀 Product Overview

This application enables users to:
- Sign up and log in (email/password, Google OAuth)
- Upload, view, and edit CSV files in a spreadsheet-like UI
- Perform CRUD operations on rows and columns
- Edit individual cells with inline editing
- Save/load CSV tables to/from Supabase
- Manage user profile (username, employee type, avatar)
- Enjoy a responsive, modern UI with dark mode support

---

## ✨ Features

- **Authentication:** Email/password and Google OAuth (via Supabase Auth)
- **CSV Upload:** Drag-and-drop or file picker, with validation (size, rows, columns)
- **Table Editor:** 
  - Add, rename, delete columns
  - Add, edit, delete rows
  - Inline cell editing
  - Column resizing and reordering
  - Undo column delete
  - Export as CSV or PDF
- **Profile Management:** 
  - Edit username, employee type, avatar
  - Profile modal with validation and error feedback
- **UI/UX:** 
  - Modern, accessible UI (React, Tailwind CSS)
  - Sidebar navigation
  - Modals for profile, stats, confirmation dialogs
  - Dynamic greeting and table size controls
  - Dark mode toggle

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (React, TypeScript, App Router)
- **Backend:** Supabase (Postgres, Auth, Storage)
- **State/UI:** React state, context providers, Headless UI, Tailwind CSS
- **Table:** @tanstack/react-table
- **CSV Parsing:** papaparse
- **PDF Export:** jspdf, jspdf-autotable
- **Icons:** lucide-react
- **Unique IDs:** nanoid

---

## 🗂️ Project Structure
/frontend ├── src │ ├── app │ │ ├── dashboard │ │ │ └── page.tsx # Main dashboard page │ │ ├── login │ │ │ └── page.tsx # Login page │ │ ├── signup │ │ │ └── page.tsx # Signup page │ ├── components │ │ └── ui/sidebar.tsx # Sidebar UI components │ └── utils │ └── supabaseClient.ts # Supabase client config └── tsconfig.json └── package.json └── README.md

---

## ⚡ Getting Started

### 1. Clone the repository
```sh
git clone [https://github.com/geetikavasistha-01/CSV-CRUD-.git](https://github.com/geetikavasistha-01/CSV-CRUD-.git)
cd CSV-CRUD-/frontend

### 2. Install dependencies

npm install

### 3. Configure environment variables
Create a .env.local file in 
/frontend
 with your Supabase credentials:
 NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

### 4. Set up Supabase
Create a Supabase project.
Run the following SQL in the Supabase SQL editor:

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade unique not null,
  username text not null,
  employee_type text not null,
  avatar_url text
);

alter table public.users enable row level security;

create policy "Allow select for own user"
  on public.users
  for select
  using (auth.uid() = auth_user_id);

create policy "Allow insert for own user"
  on public.users
  for insert
  with check (auth.uid() = auth_user_id);

create policy "Allow update for own user"
  on public.users
  for update
  using (auth.uid() = auth_user_id);

create policy "Allow delete for own user"
  on public.users
  for delete
  using (auth.uid() = auth_user_id);

grant select, insert, update, delete on public.users to authenticated;

### 5. Run the application
```sh
npm run dev
```

### 6. Access the application
Open your browser and navigate to http://localhost:3000 to access the application.