/**
 * vitals-ocr-parser Worker
 * Receives raw text extracted from a medical document via frontend OCR
 * and uses Gemini to map it to a specific array of expected trackedVitals.
 */

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
                status: 405,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        try {
            const { extractedText, expectedVitals } = await request.json();

            if (!extractedText || !expectedVitals || !Array.isArray(expectedVitals)) {
                return new Response(JSON.stringify({ error: "Missing extractedText or expectedVitals array." }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            // We rely on the env.GEMINI_API_KEY being set in Cloudflare secrets or wrangler.toml
            const apiKey = env.GEMINI_API_KEY;
            if (!apiKey) {
                return new Response(JSON.stringify({ error: "Gemini API key not configured on worker." }), {
                    status: 500,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            const prompt = `You are a medical data extraction assistant. 
I have a list of Expected Vitals that I am tracking for a patient: ${expectedVitals.join(", ")}.
I also have raw text extracted from a medical document via OCR. 

Your task is to scan the OCR text and extract the numeric values for *only* the Expected Vitals.
Format your output strictly as a JSON object where the key is the exact name from the Expected Vitals list, and the value is the extracted numeric value (as a number or a string if it includes units, preferably just the number if clear). 
If a vital cannot be found in the text, omit it or set it to null. Do not include any markdown, backticks, or other text outside of the JSON object.

Raw OCR Text:
"""
${extractedText}
"""
`;

            const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1 // Low temperature for factual extraction
                    }
                })
            });

            if (!aiResponse.ok) {
                const errText = await aiResponse.text();
                throw new Error(`Gemini API Error: ${errText}`);
            }

            const aiData = await aiResponse.json();
            const rawOutput = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

            // Clean potential markdown blocks from Gemini response
            let cleanJsonString = rawOutput.trim();
            if (cleanJsonString.startsWith('```json')) {
                cleanJsonString = cleanJsonString.slice(7);
            }
            if (cleanJsonString.startsWith('```')) {
                cleanJsonString = cleanJsonString.slice(3);
            }
            if (cleanJsonString.endsWith('```')) {
                cleanJsonString = cleanJsonString.slice(0, -3);
            }
            cleanJsonString = cleanJsonString.trim();

            let parsedVitals = {};
            try {
                parsedVitals = JSON.parse(cleanJsonString);
            } catch (e) {
                console.error("Failed to parse Gemini output as JSON", cleanJsonString);
                parsedVitals = { rawError: "Could not parse JSON", output: cleanJsonString };
            }

            return new Response(JSON.stringify({ success: true, vitals: parsedVitals }), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders
                }
            });

        } catch (error) {
            console.error(error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    },
};
