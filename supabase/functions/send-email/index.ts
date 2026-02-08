import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const TEST_EMAIL_RECIPIENT = Deno.env.get('TEST_EMAIL_RECIPIENT') || 'ajjeon7340@gmail.com'
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'Bluechecked <onboarding@resend.dev>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { creatorId, to, subject, html } = await req.json()
    let recipientEmail = to

    // If email is missing (due to RLS on client), fetch it using Service Role
    if (!recipientEmail) {
        if (!creatorId) {
             throw new Error("Missing 'to' email and 'creatorId'")
        }

        if (!SUPABASE_URL) {
            console.error("Missing SUPABASE_URL")
            throw new Error("Server configuration error: Missing SUPABASE_URL")
        }
        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY")
            throw new Error("Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY")
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(creatorId)
        
        if (userError) {
            console.error("Error fetching user by ID:", userError)
            throw new Error(`Failed to resolve creator email: ${userError.message}`)
        }

        if (user && user.user) {
            recipientEmail = user.user.email
        }

        if (!recipientEmail) {
             throw new Error(`Could not resolve email for creatorId: ${creatorId}`)
        }
    }

    // Override recipient for testing (Resend Free Tier restriction)
    if (TEST_EMAIL_RECIPIENT) {
        console.log(`[Dev] Overriding recipient ${recipientEmail} with test email: ${TEST_EMAIL_RECIPIENT}`)
        recipientEmail = TEST_EMAIL_RECIPIENT
    }

    if (RESEND_FROM_EMAIL.includes('your-new-domain.com')) {
        throw new Error("Configuration Error: RESEND_FROM_EMAIL is set to a placeholder. Please run: supabase secrets set RESEND_FROM_EMAIL=\"Bluechecked <onboarding@resend.dev>\"")
    }

    if (!recipientEmail) {
        throw new Error("No recipient email found")
    }

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set")
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [recipientEmail],
        subject: subject,
        html: html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
        console.error("Resend API Error:", data)
        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error("Edge Function Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
