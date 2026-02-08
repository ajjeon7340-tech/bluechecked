import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing Supabase secrets (URL or Service Role Key)")
            throw new Error("Server configuration error: Missing Supabase secrets")
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
        from: 'Bluechecked <onboarding@resend.dev>', // Change this to your verified domain in production
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
