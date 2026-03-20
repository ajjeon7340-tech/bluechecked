import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const DIEM_ACCOUNT_EMAIL = 'abe7340@gmail.com'

const WELCOME_MESSAGE = `Hey! 👋 Welcome to Diem — I'm so glad you're here.

Here's how it works: fans pay to send you a message, and you reply when you're ready. Once you reply and tap Collect, the credits hit your balance.

You can keep the conversation going as long as you like — reply as many times as you want. But remember, fans get one message per session, so your reply really matters to them.

Go ahead and reply to this message to collect your first credits. Then head to Settings to set up your profile. Good luck! 🚀`

const WELCOME_AMOUNT = 10 // 10 free credits gifted by Diem

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse('Supabase not configured', 500)
  }

  try {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Parse body for creatorId (sent explicitly from client)
    const body = await req.json().catch(() => ({}))
    const creatorId: string = body.creatorId

    if (!creatorId) return errorResponse('Missing creatorId', 400)
    console.log('[welcome] creatorId:', creatorId)

    // Look up Diem account via profiles table (simpler than listing all auth users)
    const { data: diemProfile, error: diemError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', DIEM_ACCOUNT_EMAIL)
      .maybeSingle()

    if (diemError) {
      console.error('[welcome] profiles lookup error:', diemError)
      return errorResponse('Failed to find Diem account: ' + diemError.message, 500)
    }

    if (!diemProfile) {
      console.error('[welcome] Diem profile not found for email:', DIEM_ACCOUNT_EMAIL)
      // Fallback: look up in auth.users
      const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      if (listError || !users) {
        console.error('[welcome] auth.admin.listUsers also failed:', listError)
        return errorResponse('Diem account not found', 404)
      }
      const diemAuthUser = users.find((u: any) => u.email === DIEM_ACCOUNT_EMAIL)
      if (!diemAuthUser) {
        console.error('[welcome] Diem account not found in auth.users either')
        return errorResponse('Diem account not found', 404)
      }
      console.log('[welcome] Found Diem user via auth fallback:', diemAuthUser.id)
      return await insertWelcomeMessage(adminClient, diemAuthUser.id, creatorId)
    }

    console.log('[welcome] Found Diem profile id:', diemProfile.id)
    return await insertWelcomeMessage(adminClient, diemProfile.id, creatorId)

  } catch (err: any) {
    console.error('[welcome] Unexpected error:', err)
    return errorResponse(err.message || 'Internal error', 500)
  }
})

async function insertWelcomeMessage(
  adminClient: ReturnType<typeof createClient>,
  diemUserId: string,
  creatorId: string
) {
  // Idempotent: skip if already sent
  const { count } = await adminClient
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', diemUserId)
    .eq('creator_id', creatorId)

  if (count && count > 0) {
    console.log('[welcome] Already sent, skipping')
    return jsonResponse({ alreadySent: true })
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error: insertError } = await adminClient
    .from('messages')
    .insert({
      sender_id: diemUserId,
      creator_id: creatorId,
      content: WELCOME_MESSAGE,
      amount: WELCOME_AMOUNT,
      status: 'PENDING',
      expires_at: expiresAt,
      is_read: false,
    })

  if (insertError) {
    console.error('[welcome] Insert error:', insertError)
    return errorResponse('Failed to insert welcome message: ' + insertError.message, 500)
  }

  console.log('[welcome] Successfully sent from', diemUserId, 'to', creatorId)
  return jsonResponse({ success: true })
}
