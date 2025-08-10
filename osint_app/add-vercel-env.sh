#!/bin/bash

echo "Adding environment variables to Vercel production..."

# Add required environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "https://dduximhdfknhxjnpnigu.supabase.co"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdXhpbWhkZmtuaHhqbnBuaWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDk2ODUsImV4cCI6MjA2Njc4NTY4NX0.Os7RQgLs9kKMgFVteyyjXOE234GQDIDoSq5QzuefNr4"
vercel env add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN production <<< "pk.eyJ1Ijoic3RlbGlvc3NwYXAiLCJhIjoiY21jaHB2ZnpiMTB4MTJqcXQzZHgxbDVzYyJ9.iZzdxomuFZhMNvqCC-Hbrg"
vercel env add SUPABASE_SERVICE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdXhpbWhkZmtuaHhqbnBuaWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwOTY4NSwiZXhwIjoyMDY2Nzg1Njg1fQ.n4uC19EpEJvclohhe_D2k1cTT592wS1tVKMQG5PvlBE"
vercel env add JWT_SECRET production <<< "/2irIWWTjNze5ls+VxBLEb9U3in3ciEbcaw8ptCHumc="

echo "Environment variables added! Now deploying..."