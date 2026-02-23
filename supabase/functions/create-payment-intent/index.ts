import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const APP_URL = Deno.env.get('APP_URL') || 'https://bluechecked.me'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Server-side credit tiers — client amount is validated against these
const CREDIT_TIERS: Record<number, number> = {
  500: 500,    // 500 credits = $5.00 = 500 cents
  1000: 1000,  // 1000 credits = $10.00
  2500: 2500,  // 2500 credits = $25.00
  5000: 5000,  // 5000 credits = $50.00
}

// Calculate service fee to cover Stripe's processing fee (2.9% + $0.30)
function calculateServiceFee(baseCents: number): number {
  // fee = (base * 0.029 + 30) / (1 - 0.029) - base
  const totalNeeded = (baseCents + 30) / (1 - 0.029)
  const fee = Math.ceil(totalNeeded - baseCents)
  return fee
}

async function stripeRequest(endpoint: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
  const data = await res.json()
  if (data.error) {
    throw new Error(data.error.message || 'Stripe API error')
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { credits } = await req.json()

    // Server-side tier validation
    const baseCents = CREDIT_TIERS[credits]
    if (!baseCents) {
      return new Response(JSON.stringify({ error: 'Invalid credit tier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const feeCents = calculateServiceFee(baseCents)

    // Create Stripe Checkout Session with 2 line items + automatic tax
    const params: Record<string, string> = {
      mode: 'payment',
      billing_address_collection: 'required',
      'automatic_tax[enabled]': 'true',
      // Line Item 1: Credits
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `${credits} Credits`,
      'line_items[0][price_data][product_data][description]': `Top up ${credits} credits to your account`,
      'line_items[0][price_data][unit_amount]': baseCents.toString(),
      'line_items[0][price_data][tax_behavior]': 'exclusive',
      'line_items[0][quantity]': '1',
      // Line Item 2: Service Fee
      'line_items[1][price_data][currency]': 'usd',
      'line_items[1][price_data][product_data][name]': 'Processing Fee',
      'line_items[1][price_data][product_data][description]': 'Payment processing fee',
      'line_items[1][price_data][unit_amount]': feeCents.toString(),
      'line_items[1][price_data][tax_behavior]': 'exclusive',
      'line_items[1][quantity]': '1',
      // Metadata for webhook
      'metadata[user_id]': user.id,
      'metadata[credits]': credits.toString(),
      // Redirect URLs
      success_url: `${APP_URL}/dashboard?checkout=success`,
      cancel_url: `${APP_URL}/dashboard?checkout=cancel`,
    }

    const session = await stripeRequest('/checkout/sessions', params)

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Create Checkout Session error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
