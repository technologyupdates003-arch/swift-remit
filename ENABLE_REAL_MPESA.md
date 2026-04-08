# Enable Real M-Pesa Integration

## Current Status
✅ Database function working  
✅ Frontend integration working  
❌ **Currently using simulation** (no real STK push)

## To Enable Real M-Pesa:

### Step 1: Deploy Edge Function
```bash
# Deploy the IntaSend Edge Function
supabase functions deploy intasend-stk-push
```

### Step 2: Set Environment Variables
In your Supabase dashboard, go to Settings > Edge Functions and add:
- `INTASEND_PUBLIC_KEY`: Your IntaSend public key
- `INTASEND_SECRET_KEY`: Your IntaSend secret key

### Step 3: Update Frontend
Replace the simulation code in `MpesaPaymentForm.tsx` with real Edge Function call:

```javascript
// Replace simulation with real IntaSend call
const { data: stkResult, error: stkError } = await supabase.functions.invoke('intasend-stk-push', {
  body: {
    phone_number: phoneNumber,
    amount: parseFloat(amount),
    narrative: 'Swift Remit wallet funding',
    api_ref: transactionId
  }
});

if (stkError) throw stkError;
if (!stkResult.success) throw new Error(stkResult.error);
```

### Step 4: Test
After deployment, you'll get real M-Pesa STK push notifications on your phone!

## Current Simulation Behavior
- Creates transaction record ✅
- Shows success message ✅  
- No actual M-Pesa prompt ❌
- No money charged ❌