import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
      },
    })
  }

  if (!STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required env vars')
    return new Response('Server configuration error', { status: 500 })
  }

  try {
    const body = await req.text()
    const sigHeader = req.headers.get('stripe-signature')

    if (!sigHeader) {
      return new Response('Missing stripe-signature header', { status: 400 })
    }

    const isValid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return new Response('Invalid signature', { status: 400 })
    }

    const event = JSON.parse(body)

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object
      const userId = paymentIntent.metadata?.user_id
      const credits = parseInt(paymentIntent.metadata?.credits || '0')

      if (!userId || !credits) {
        console.error('Missing metadata in PaymentIntent:', paymentIntent.id)
        return new Response('Missing metadata', { status: 400 })
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Get current credits
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single()

      if (fetchError || !profile) {
        console.error('Failed to fetch user profile:', fetchError)
        return new Response('User not found', { status: 400 })
      }

      // Add credits
      const newBalance = (profile.credits || 0) + credits
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits: newBalance })
        .eq('id', userId)

      if (updateError) {
        console.error('Failed to update credits:', updateError)
        return new Response('Failed to update credits', { status: 500 })
      }

      console.log(`Added ${credits} credits to user ${userId}. New balance: ${newBalance}`)
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
