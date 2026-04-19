import { createClient } from '@supabase/supabase-js';

// Ganti string di bawah dengan URL dan Key dari project Supabase kamu
const supabaseUrl = 'https://abobncsoyqdbqemkssrf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFib2JuY3NveXFkYnFlbWtzc3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDgyMjgsImV4cCI6MjA5MTEyNDIyOH0.Si1FJ_Teo7Xs5b4Cd7Z_WvjZ-026alncnb8fsD_1k1c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);