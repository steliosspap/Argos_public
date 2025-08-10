#!/bin/bash
cd /Users/bombafrontistiria/Desktop/argos/osint_app
source .env.local
export NODE_ENV=production
node scripts/continuous-sync.js