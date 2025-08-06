import { createClient } from '@supabase/supabase-js';

// Replace with your Supabase project URL and public anon key
const SUPABASE_URL = 'https://sncruycikvfnkrmmbjxr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuY3J1eWNpa3ZmbmtybW1ianhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTQ1NDIsImV4cCI6MjA2NjU5MDU0Mn0.NOJVi5idcC3hIZVl5W6Spjs-DBH0_mDINc0Jr0H5v7s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
