import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const { rawText } = await req.json()
    if (!rawText || rawText.trim().length < 3) return json({ error: "Write or speak a little more first." }, 400)
    const apiKey = Deno.env.get("OPENAI_API_KEY")
    if (!apiKey) return json({ error: "OPENAI_API_KEY is not set in Supabase secrets." }, 500)
    const prompt = `You are Echo, a warm private AI journal assistant. Transform the user's raw spoken thoughts into a beautiful journal entry. Do not invent major facts. Return ONLY JSON with title, journal_text, mood, topic. Raw thoughts: ${rawText}`
    const r = await fetch("https://api.openai.com/v1/responses", { method:"POST", headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"}, body: JSON.stringify({ model:"gpt-5.5", input: prompt }) })
    const data = await r.json()
    if (!r.ok) return json({ error: "OpenAI request failed", detail: data }, 500)
    const text = data.output_text || data.output?.[0]?.content?.[0]?.text || ""
    try { return json(JSON.parse(text)) } catch { return json({ title:"A thought from today", journal_text:text || rawText, mood:"Reflective", topic:"Everyday life" }) }
  } catch (e) { return json({ error: String(e?.message || e) }, 500) }
})
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers:{...corsHeaders,"Content-Type":"application/json"} }) }
