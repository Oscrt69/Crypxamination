import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabaseUrl = 'https://fahfubgsnsgrmyqspidt.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhaGZ1YmdzbnNncm15cXNwaWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzU5NzIsImV4cCI6MjEwNjk1MTk3Mn0.cfkvs1hcuC_XnEsOKjfLOSZGHJDNlXTlr317m-IvxcU';
export const supabase = createClient(supabaseUrl, supabaseKey);
