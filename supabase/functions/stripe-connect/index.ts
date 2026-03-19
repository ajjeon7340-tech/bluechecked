import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY_TEST = Deno.env.get('STRIPE_SECRET_KEY_TEST')
const STRIPE_SECRET_KEY_LIVE = Deno.env.get('STRIPE_SECRET_KEY_LIVE')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const APP_URL = Deno.env.get('APP_URL') || 'https://www.diem.ee'

// Withdrawal constants
const PLATFORM_FEE_RATE = 0.10   // 10% platform fee
const MIN_WITHDRAWAL_CREDITS = 2000  // Minimum $20 worth of credits
const CREDIT_TO_USD = 0.01  // 1 credit = $0.01

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function stripeRequest(endpoint: string, secretKey: string, params?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  })
  const data = await res.json()
  if (data.error) {
    throw new Error(data.error.message || 'Stripe API error')
  }
  return data
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

function getAdminClient() {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse('Supabase is not configured', 500)
  }

  try {
    const user = await getUser(req)
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const { action, amount, testMode } = await req.json()
    console.log('[stripe-connect] action:', action, 'testMode:', testMode)
    console.log('[stripe-connect] TEST key present:', !!STRIPE_SECRET_KEY_TEST, 'LIVE key present:', !!STRIPE_SECRET_KEY_LIVE)
    const STRIPE_SECRET_KEY = testMode ? STRIPE_SECRET_KEY_TEST : STRIPE_SECRET_KEY_LIVE
    if (!STRIPE_SECRET_KEY) {
      console.error('[stripe-connect] Missing key for testMode:', testMode)
      return errorResponse('Stripe is not configured', 500)
    }
    const adminClient = getAdminClient()

    // ---- CREATE ACCOUNT ----
    if (action === 'create-account') {
      console.log('[stripe-connect] create-account for user:', user.id, 'email:', user.email)

      const { data: existing, error: fetchError } = await adminClient
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', user.id)
        .eq('test_mode', testMode)
        .maybeSingle()

      if (fetchError) {
        console.error('[stripe-connect] DB fetch error:', fetchError)
        return errorResponse('Database error: ' + fetchError.message, 500)
      }

      let stripeAccountId = existing?.stripe_account_id
      console.log('[stripe-connect] existing stripe account:', stripeAccountId)

      if (!stripeAccountId) {
        console.log('[stripe-connect] creating new Stripe Express account...')
        let account
        try {
          account = await stripeRequest('/accounts', STRIPE_SECRET_KEY, {
            type: 'express',
            ...(user.email ? { email: user.email } : {}),
            'metadata[supabase_user_id]': user.id,
          })
        } catch (stripeErr: any) {
          console.error('[stripe-connect] Stripe account creation failed:', stripeErr.message)
          return errorResponse('Stripe account creation failed: ' + stripeErr.message, 500)
        }
        stripeAccountId = account.id
        console.log('[stripe-connect] created account:', stripeAccountId)

        const { error: insertError } = await adminClient
          .from('stripe_accounts')
          .insert({
            user_id: user.id,
            stripe_account_id: stripeAccountId,
            test_mode: testMode,
          })

        if (insertError) {
          console.error('[stripe-connect] Failed to save Stripe account:', insertError)
          return errorResponse('Failed to save Stripe account: ' + insertError.message, 500)
        }
      }

      console.log('[stripe-connect] creating account link for:', stripeAccountId)
      let accountLink
      try {
        accountLink = await stripeRequest('/account_links', STRIPE_SECRET_KEY, {
          account: stripeAccountId,
          refresh_url: `${APP_URL}/dashboard?stripe=refresh`,
          return_url: `${APP_URL}/dashboard?stripe=return`,
          type: 'account_onboarding',
        })
      } catch (linkErr: any) {
        console.error('[stripe-connect] Account link creation failed:', linkErr.message)
        return errorResponse('Account link creation failed: ' + linkErr.message, 500)
      }

      console.log('[stripe-connect] Generated Account Link:', accountLink.url)
      return jsonResponse({ url: accountLink.url })
    }

    // ---- CHECK STATUS ----
    if (action === 'check-status') {
      const { data: existing } = await adminClient
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', user.id)
        .eq('test_mode', testMode)
        .maybeSingle()

      if (!existing?.stripe_account_id) {
        return jsonResponse({ connected: false })
      }

      const account = await stripeRequest(`/accounts/${existing.stripe_account_id}`, STRIPE_SECRET_KEY)
      const connected = account.charges_enabled && account.payouts_enabled

      if (connected) {
        await adminClient
          .from('stripe_accounts')
          .update({ onboarded: true })
          .eq('user_id', user.id)
      }

      return jsonResponse({ connected })
    }

    // ---- CREATE PAYOUT (with fees + rollback) ----
    if (action === 'create-payout') {
      if (!amount || amount <= 0) {
        return errorResponse('Invalid amount')
      }

      // Get the user's Stripe account
      const { data: stripeAccount } = await adminClient
        .from('stripe_accounts')
        .select('stripe_account_id, onboarded')
        .eq('user_id', user.id)
        .eq('test_mode', testMode)
        .maybeSingle()

      if (!stripeAccount?.stripe_account_id || !stripeAccount.onboarded) {
        console.error('Stripe check failed:', { hasAccount: !!stripeAccount?.stripe_account_id, onboarded: stripeAccount?.onboarded })
        return errorResponse('Stripe account not connected or not fully onboarded')
      }

      // Verify the Stripe account is actually ready for payouts
      try {
        const account = await stripeRequest(`/accounts/${stripeAccount.stripe_account_id}`, STRIPE_SECRET_KEY)
        if (!account.payouts_enabled) {
          console.error('Stripe account payouts not enabled:', account.id)
          return errorResponse('Stripe account onboarding incomplete. Please complete verification in Stripe.')
        }
      } catch (verifyErr) {
        console.error('Failed to verify Stripe account:', verifyErr)
        return errorResponse(`Failed to verify Stripe account: ${verifyErr.message}`)
      }

      // Check user's credit balance
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        return errorResponse('Failed to fetch user profile')
      }

      if ((profile.credits || 0) < amount) {
        return errorResponse(`Insufficient credit balance (have: ${profile.credits || 0}, need: ${amount})`)
      }

      // Calculate fees
      const grossUsd = amount * CREDIT_TO_USD
      const platformFee = grossUsd * PLATFORM_FEE_RATE
      const netUsd = grossUsd - platformFee
      const netCents = Math.round(netUsd * 100)

      if (netCents <= 0) {
        return errorResponse('Amount too small after fees')
      }

      // Step 1: Deduct credits from DB first (optimistic)
      const { error: deductError } = await adminClient
        .from('profiles')
        .update({ credits: (profile.credits || 0) - amount })
        .eq('id', user.id)
        .gte('credits', amount)  // Safety: only deduct if still enough

      if (deductError) {
        return errorResponse('Failed to deduct credits')
      }

      // Step 2: Create Stripe Transfer
      let transfer
      try {
        transfer = await stripeRequest('/transfers', STRIPE_SECRET_KEY, {
          amount: netCents.toString(),
          currency: 'usd',
          destination: stripeAccount.stripe_account_id,
          'metadata[supabase_user_id]': user.id,
          'metadata[credits]': amount.toString(),
          'metadata[platform_fee_usd]': platformFee.toFixed(2),
          'metadata[net_usd]': netUsd.toFixed(2),
        })
      } catch (stripeErr) {
        // Step 2b: ROLLBACK — restore credits if Stripe transfer failed
        console.error('Stripe transfer failed, rolling back credits:', stripeErr)
        await adminClient
          .from('profiles')
          .update({ credits: (profile.credits || 0) })  // Restore original balance
          .eq('id', user.id)

        let errorMessage = stripeErr.message || 'Stripe error'
        if (errorMessage.includes('insufficient available funds')) {
          errorMessage = "Stripe Sandbox Error: Your Platform Balance is empty. Go to Stripe Dashboard > Balances > 'Add to balance' to add test funds."
        }

        return errorResponse(`Transfer failed: ${errorMessage}`)
      }

      // Step 3: Record withdrawal in DB
      const { data: withdrawal, error: withdrawalError } = await adminClient
        .from('withdrawals')
        .insert({
          creator_id: user.id,
          amount,
          amount_usd: netUsd,
          platform_fee: platformFee,
          status: 'COMPLETED',
          stripe_transfer_id: transfer.id,
        })
        .select()
        .single()

      if (withdrawalError) {
        console.error('Failed to record withdrawal:', withdrawalError)
      }

      return jsonResponse({
        withdrawal: withdrawal || {
          id: transfer.id,
          amount,
          amount_usd: netUsd,
          platform_fee: platformFee,
          status: 'COMPLETED',
          created_at: new Date().toISOString(),
        },
      })
    }

    return errorResponse('Unknown action')
  } catch (err) {
    console.error('Stripe Connect error:', err)
    return errorResponse(err.message || 'Internal server error', 500)
  }
})
