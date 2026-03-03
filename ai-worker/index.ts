export interface Env {
    GEMINI_API_KEY: string;
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
        }

        try {
            const data = await request.json() as any;
            const { vitals, patientContext } = data;

            if (!vitals || !Array.isArray(vitals)) {
                return new Response("Invalid request. 'vitals' array is required.", { status: 400, headers: corsHeaders });
            }

            // Construct Patient Profile Context
            let contextText = "No specific patient demography provided.";
            if (patientContext) {
                contextText = `
- Age: ${patientContext.age || 'Unknown'}
- Gender: ${patientContext.gender || 'Unknown'}
- Blood Type: ${patientContext.bloodType || 'Unknown'}
- Height: ${patientContext.height ? patientContext.height + ' cm' : 'Unknown'}
- Weight: ${patientContext.weight ? patientContext.weight + ' kg' : 'Unknown'}
- Clinical Notes/Allergies: ${patientContext.notes || 'None recorded'}
                `.trim();
            }

            // Construct Vitals Tracker
            let vitalsText = "Patient Vitals Data (Last 6 Months):\n";
            vitals.forEach((v: any) => {
                vitalsText += `- ${v.timeLabel}: ${v.name} = ${v.value}\n`;
            });

            const prompt = `You are an expert, compassionate AI medical analyst assisting a Caregiver.
The caregiver has requested an analysis of all recorded patient vitals and demographic data.

Here is the known patient profile:
${contextText}

Here is the tracked vitals data over time:
${vitalsText}

Tasks:
1. Provide a short, structured report summarizing the overall health trends chronologically.
2. Cross-reference the tracked vitals against their established demographics (e.g. is the blood pressure healthy for a patient of their age/weight/gender?)
3. Highlight any specific patterns of stability or concern.
4. If their Clinical Notes or Allergies interact with the data shown, mention it.
5. Do not write a long essay. Keep the report to 3-4 concise, easily readable paragraphs using professional yet supportive language.`;

            // Call Gemini API
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

            const geminiReq = await fetch(geminiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            if (!geminiReq.ok) {
                const errText = await geminiReq.text();
                console.error("Gemini API Error:", errText);
                return new Response("Failed to generate AI report.", { status: 500, headers: corsHeaders });
            }

            const geminiRes = await geminiReq.json() as any;
            const answer = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";

            return new Response(JSON.stringify({ report: answer }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });

        } catch (e: any) {
            console.error("Worker Error:", e);
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
        }
    }
};
