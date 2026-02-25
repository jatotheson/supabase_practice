# supabase_practice

Simple Supabase practice app with:
- `frontend/` Vite client
- `backend/` API server for posts + public-bucket image endpoints

## Backend Setup
1. `cd backend`
2. `cp .env.example .env`
3. Fill `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_POSTS_TABLE` (default: `posts`)
   - `SUPABASE_PUBLIC_BUCKET` (default: `post-images`)
4. `npm install`
5. `npm run dev`

API runs on `http://localhost:3001` by default.

## Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Frontend uses a Vite proxy for `/api` -> `http://localhost:3001` by default.

## API Routes
- `GET /api/health`
- `GET /api/posts`
- `POST /api/posts` `{ title, body }`
- `DELETE /api/posts/:id`
- `POST /api/images/upload` (`multipart/form-data`, field: `image`, optional `folder`)
- `GET /api/images?prefix=...`
