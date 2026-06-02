const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://msnlvolymkkmguercqco.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbmx2b2x5bWtrbWd1ZXJjcWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNTQzOTksImV4cCI6MjA5NTkzMDM5OX0._NJ4Pq0NiOz9XZYKDkT9M6MaCZYM8ZNsx84f5zCPq2k';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
