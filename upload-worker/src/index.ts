export interface Env {
	CARE_ASSETS: R2Bucket;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// 1. PUBLIC ASSET SERVING (GET)
		if (request.method === 'GET') {
			const url = new URL(request.url);
			const key = url.pathname.slice(1); // root path is the file name
			if (!key) return new Response('Not Found', { status: 404, headers: corsHeaders });

			const object = await env.CARE_ASSETS.get(key);
			if (object === null) {
				return new Response('Object Not Found', { status: 404, headers: corsHeaders });
			}

			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set('etag', object.httpEtag);
			headers.set('Access-Control-Allow-Origin', '*');

			return new Response(object.body, { headers });
		}

		// 2. UPLOADING ASSETS (POST)
		if (request.method === 'POST') {
			const url = new URL(request.url);
			if (url.pathname !== '/upload') return new Response('Bad route', { status: 404, headers: corsHeaders });

			try {
				const formData = await request.formData();
				const file = formData.get('file') as File;
				const prefix = formData.get('prefix') as string || '';
				if (!file) return new Response('No file provided', { status: 400, headers: corsHeaders });

				const ext = file.name.split('.').pop() || 'png';
				const safePrefix = prefix ? `${prefix.replace(/^\/+|\/+$/g, '')}/` : '';
				const fileName = `${safePrefix}img_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

				await env.CARE_ASSETS.put(fileName, file.stream(), {
					httpMetadata: { contentType: file.type || 'image/png' }
				});

				const publicUrl = `https://${url.hostname}/${fileName}`;
				return new Response(JSON.stringify({ success: true, url: publicUrl }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			} catch (err: any) {
				return new Response(JSON.stringify({ success: false, error: err.message }), {
					status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
		}

		return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
	}
};
