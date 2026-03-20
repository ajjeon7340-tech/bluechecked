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

    // Verify the requesting user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse('Unauthorized', 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    const creatorId = user.id

    // Look up the Diem account by email
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    if (listError) {
      console.error('[welcome] Failed to list users:', listError)
      return errorResponse('Failed to find Diem account', 500)
    }

    const diemUser = users.find((u: any) => u.email === DIEM_ACCOUNT_EMAIL)
    if (!diemUser) {
      console.error('[welcome] Diem account not found:', DIEM_ACCOUNT_EMAIL)
      return errorResponse('Diem account not found', 404)
    }

    const diemUserId = diemUser.id

    // Check if welcome message already sent (idempotent)
    const { count } = await adminClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', diemUserId)
      .eq('creator_id', creatorId)

    if (count && count > 0) {
      return jsonResponse({ alreadySent: true })
    }

    // Insert welcome message — 30 day expiry, no credits deducted from Diem
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
      console.error('[welcome] Failed to insert message:', insertError)
      return errorResponse('Failed to send welcome message: ' + insertError.message, 500)
    }

    console.log('[welcome] Sent welcome message from', diemUserId, 'to creator', creatorId)
    return jsonResponse({ success: true })

  } catch (err: any) {
    console.error('[welcome] Error:', err)
    return errorResponse(err.message || 'Internal error', 500)
  }
})
