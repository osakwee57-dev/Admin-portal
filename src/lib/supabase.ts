import { createClient } from '@supabase/supabase-js';

// Using hardcoded values provided by the user to ensure immediate functionality
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ncuokjnydtjsnffcxivz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jdW9ram55ZHRqc25mZmN4aXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTQ0NTUsImV4cCI6MjA4NzE3MDQ1NX0.ELOxvrk8d1bs8nGgyaOJa0KdpTdkz0awCK39mFDztfk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
