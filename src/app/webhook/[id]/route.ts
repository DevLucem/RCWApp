import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendApiRequest } from '@/app/actions';

function resolvePath(obj: any, path: string) {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function extractMappedValue(payload: any, mappingToken: string) {
  if (typeof mappingToken !== 'string') return mappingToken;

  if (mappingToken.includes('${') && mappingToken.includes('}')) {
    return mappingToken.replace(/\$\{([^}]+)\}/g, (_, path) => {
      const val = resolvePath(payload, path.trim());
      if (val === undefined || val === null) return '';
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    });
  }

  return resolvePath(payload, mappingToken);
}

async function handleRequest(req: NextRequest, context: { params: Promise<{ id: string }> }) {

  const { id } = await context.params;
  const cleanId = decodeURIComponent(id).trim();

  if (!cleanId) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }

  try {
    const docRef = doc(db, 'rcwapp', 'data', 'webhooks', cleanId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json({ error: 'Webhook configuration not found' }, { status: 404 });
    }

    const config = docSnap.data();

    if (config.automation?.disabled) {
      return NextResponse.json({ error: 'Automation is disabled' }, { status: 400 });
    }

    let payload: any = {};
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        payload = await req.json();
      } catch {
        // payload remains {}
      }
    } else {
      payload = Object.fromEntries(req.nextUrl.searchParams.entries());
    }

    const { automation, url, method, headers, requestBody, bodyType, formData } = config;

    // Apply header mappings
    const finalHeaders: Record<string, string> = {};
    if (headers && Array.isArray(headers)) {
      headers.forEach((h: any) => {
        if (h.enabled && h.key) {
          finalHeaders[h.key] = h.value;
        }
      });
    }

    if (automation?.headerMappings) {
      Object.entries(automation.headerMappings).forEach(([headerKey, pathKey]) => {
        const extractedValue = extractMappedValue(payload, pathKey as string);
        if (extractedValue !== undefined) {
          finalHeaders[headerKey] = String(extractedValue);
        }
      });
    }

    // Determine final body based on bodyType
    let finalBody: string | undefined = undefined;

    if (bodyType === 'json' && requestBody) {
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(requestBody);

        // Apply body mappings
        if (automation?.bodyMappings && typeof parsedBody === 'object') {
          Object.entries(automation.bodyMappings).forEach(([bodyKey, pathKey]) => {
            const extractedValue = extractMappedValue(payload, pathKey as string);
            if (extractedValue !== undefined) {
              parsedBody[bodyKey] = extractedValue;
            }
          });
        }
        finalBody = JSON.stringify(parsedBody);
      } catch {
        finalBody = requestBody;
      }

      if (!Object.keys(finalHeaders).some((k) => k.toLowerCase() === 'content-type')) {
        finalHeaders['Content-Type'] = 'application/json';
      }
    } else if (bodyType === 'text') {
      finalBody = requestBody;
      if (!Object.keys(finalHeaders).some((k) => k.toLowerCase() === 'content-type')) {
        finalHeaders['Content-Type'] = 'text/plain';
      }
    } else if (bodyType === 'form-data' && formData) {
      const urlSearchParams = new URLSearchParams();
      if (Array.isArray(formData)) {
        formData.forEach((item: any) => {
          if (item.enabled && item.key) {
            urlSearchParams.append(item.key, item.value);
          }
        });
      }
      finalBody = urlSearchParams.toString();
      if (!Object.keys(finalHeaders).some((k) => k.toLowerCase() === 'content-type')) {
        finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }

    // Send the API request as configured
    const response = await sendApiRequest(url, {
      method,
      headers: finalHeaders,
      body: finalBody,
    });

    if (response.ok) {
      const resHeaders = new Headers();
      if (response.headers) {
        Object.entries(response.headers).forEach(([k, v]) => {
          const lowerK = k.toLowerCase();
          if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(lowerK)) {
            resHeaders.append(k, String(v));
          }
        });
      }

      let bodyData = response.data;
      if (typeof bodyData === 'object') {
        bodyData = JSON.stringify(bodyData);
        resHeaders.set('Content-Type', 'application/json');
      }

      return new NextResponse(bodyData, {
        status: response.status || 200,
        statusText: response.statusText || 'OK',
        headers: resHeaders,
      });
    } else {
      return NextResponse.json(
        {
          error: response.error,
          cause: response.cause,
        },
        { status: 502 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRequest(req, context);
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRequest(req, context);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
