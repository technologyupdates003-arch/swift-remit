# CORS Issue Fix for IntaSend M-Pesa Integration

## Problem
The frontend is trying to call IntaSend API directly, which is blocked by CORS policy. IntaSend doesn't allow direct frontend calls for security reasons.

## Solution
Use Supabase Edge Functions to handle IntaSend API calls on the backend.

## Quick Fix Options:

### Option 1: Use Database-Only Approach (Recommended for now)
Remove the IntaSend API call from frontend and just create the transaction record. You can process payments manually or set up webhooks later.

### Option 2: Create Supabase Edge Function (Production Ready)
Create an Edge Function to handle IntaSend API calls securely.

## Immediate Fix
Update the frontend to skip the IntaSend API call for now and just create the database transaction.