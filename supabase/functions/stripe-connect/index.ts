import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno"

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const APP_URL = Deno.env.get('APP_URL') || 'https://bluechecked.me'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }) : null

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

// Get authenticated user from the request's Authorization header
async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

// Get or create the service-role Supabase client
function getAdminClient() {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!stripe) {
    return errorResponse('Stripe is not configured', 500)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse('Supabase is not configured', 500)
  }

  try {
    const user = await getUser(req)
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const { action, amount } = await req.json()
    const adminClient = getAdminClient()

    // ---- CREATE ACCOUNT ----
    if (action === 'create-account') {
      // Check if user already has a Stripe account
      const { data: existing } = await adminClient
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', user.id)
        .maybeSingle()

      let stripeAccountId = existing?.stripe_account_id

      if (!stripeAccountId) {
        // Create a new Stripe Connect Express account
        const account = await stripe.accounts.create({
          type: 'express',
          email: user.email,
          metadata: { supabase_user_id: user.id },
        })
        stripeAccountId = account.id

        // Save to DB
        const { error: insertError } = await adminClient
          .from('stripe_accounts')
          .insert({
            user_id: user.id,
            stripe_account_id: stripeAccountId,
          })

        if (insertError) {
          console.error('Failed to save Stripe account:', insertError)
          return errorResponse('Failed to save Stripe account')
        }
      }

      // Create an account onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${APP_URL}/dashboard?stripe=refresh`,
        return_url: `${APP_URL}/dashboard?stripe=return`,
        type: 'account_onboarding',
      })

      return jsonResponse({ url: accountLink.url })
    }

    // ---- CHECK STATUS ----
    if (action === 'check-status') {
      const { data: existing } = await adminClient
        .from('stripe_accounts')
        .select('stripe_account_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existing?.stripe_account_id) {
        return jsonResponse({ connected: false })
      }

      // Check if the account is fully onboarded
      const account = await stripe.accounts.retrieve(existing.stripe_account_id)
      const connected = account.charges_enabled && account.payouts_enabled

      // Update onboarded status in DB
      if (connected) {
        await adminClient
          .from('stripe_accounts')
          .update({ onboarded: true })
          .eq('user_id', user.id)
      }

      return jsonResponse({ connected })
    }

    // ---- CREATE PAYOUT ----
    if (action === 'create-payout') {
      if (!amount || amount <= 0) {
        return errorResponse('Invalid amount')
      }

      // Get the user's Stripe account
      const { data: existing } = await adminClient
        .from('stripe_accounts')
        .select('stripe_account_id, onboarded')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existing?.stripe_account_id || !existing.onboarded) {
        return errorResponse('Stripe account not connected or not fully onboarded')
      }

      // Convert credits to cents (1 credit = $1 USD for simplicity)
      const amountInCents = Math.round(amount * 100)

      // Create a Transfer to the connected account
      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: 'usd',
        destination: existing.stripe_account_id,
        metadata: {
          supabase_user_id: user.id,
          credits: amount.toString(),
        },
      })

      // Record withdrawal in DB
      const { data: withdrawal, error: withdrawalError } = await adminClient
        .from('withdrawals')
        .insert({
          creator_id: user.id,
          amount,
          amount_usd: amount,
          status: 'COMPLETED',
          stripe_transfer_id: transfer.id,
        })
        .select()
        .single()

      if (withdrawalError) {
        console.error('Failed to record withdrawal:', withdrawalError)
        // Transfer already happened, so log but don't fail
      }

      return jsonResponse({
        withdrawal: withdrawal || {
          id: transfer.id,
          amount,
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
