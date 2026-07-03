# Echo v1 Real App Starter

Demo passcode: 1234

## What this is
A proper Echo starter app using:
- React / Vite frontend
- Supabase Auth
- Supabase Postgres entries table
- Supabase Edge Function for secure OpenAI journal generation
- Pastel butterfly wonderland UI

## Run locally
```bash
npm install
cp .env.example .env
npm run dev
```

## Supabase setup
1. Create a Supabase project.
2. Put your Supabase URL and anon key in `.env`.
3. Run `supabase/schema.sql` in Supabase SQL Editor.
4. Deploy the edge function:
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
supabase functions deploy generate-entry
```

## Important
Do not put your OpenAI API key in the browser. The key belongs in Supabase secrets only.
