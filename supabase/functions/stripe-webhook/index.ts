import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_WEBHOOK_SECRET_TEST = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST')
const STRIPE_WEBHOOK_SECRET_LIVE = Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Stripe webhook signature verification using Web Crypto API
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc: Record<string, string>, part) => {
    const [key, value] = part.split('=')
    acc[key] = value
    return acc
  }, {})

  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) return false

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

  return expectedSig === signature
}

async function addCreditsToUser(userId: string, credits: number) {
  if (!Number.isFinite(credits) || credits <= 0) {
    throw new Error('Invalid credit amount')
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single()

  if (fetchError || !profile) {
    console.error('Failed to fetch user profile:', fetchError)
    throw new Error('User not found')
  }

  const newBalance = (profile.credits || 0) + credits
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits: newBalance })
    .eq('id', userId)

  if (updateError) {
    console.error('Failed to update credits:', updateError)
    throw new Error('Failed to update credits')
  }

  console.log(`Added ${credits} credits to user ${userId}. New balance: ${newBalance}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
      },
    })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required env vars')
    return new Response('Server configuration error', { status: 500 })
  }

  try {
    const body = await req.text()
    const sigHeader = req.headers.get('stripe-signature')

    if (!sigHeader) {
      return new Response('Missing stripe-signature header', { status: 400 })
    }

    // Peek at the event to determine test vs live mode, then verify with the right secret
    const rawEvent = JSON.parse(body)
    const STRIPE_WEBHOOK_SECRET = rawEvent.livemode ? STRIPE_WEBHOOK_SECRET_LIVE : STRIPE_WEBHOOK_SECRET_TEST
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('Missing webhook secret for mode:', rawEvent.livemode ? 'live' : 'test')
      return new Response('Server configuration error', { status: 500 })
    }

    const isValid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return new Response('Invalid signature', { status: 400 })
    }

    const event = rawEvent

    // Handle Checkout Session completed (new flow)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.metadata?.user_id
      const credits = parseInt(session.metadata?.credits || '0')

      if (!userId || !credits) {
        console.error('Missing metadata in Checkout Session:', session.id)
        return new Response('Missing metadata', { status: 400 })
      }

      // Idempotency check — prevent double-crediting on webhook retry
      const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
      const { count } = await supabaseClient
        .from('processed_webhooks')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)

      if (count && count > 0) {
        console.log(`Webhook ${event.id} already processed, skipping`)
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Only credit if payment was successful
      if (session.payment_status === 'paid') {
        await addCreditsToUser(userId, credits)

        // Record processed webhook for idempotency
        await supabaseClient
          .from('processed_webhooks')
          .insert({ event_id: event.id, user_id: userId, credits, processed_at: new Date().toISOString() })
          .catch((err: unknown) => console.warn('Failed to record webhook idempotency:', err))
      } else {
        console.log(`Checkout session ${session.id} payment_status: ${session.payment_status}, skipping credit`)
      }
    }


    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Webhook error', { status: 500 })
  }
})
