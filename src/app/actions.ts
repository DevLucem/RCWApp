'use server';

type SendApiRequestOptions = {
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
};

type SuccessResponse = {
  ok: true;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
};

type ErrorResponse = {
  ok: false;
  error: string;
  cause?: any;
};

export async function sendApiRequest(
  url: string,
  options: SendApiRequestOptions
): Promise<SuccessResponse | ErrorResponse> {

  try {
    let finalBody = ['GET', 'HEAD'].includes(options.method) ? undefined : options.body;

    // Format body as x-www-form-urlencoded if requested
    const contentTypeKey = Object.keys(options.headers).find(
      (k) => k.toLowerCase() === 'content-type'
    );
    const requestContentType = contentTypeKey ? options.headers[contentTypeKey] : '';

    if (requestContentType.includes('application/x-www-form-urlencoded') && finalBody) {
      try {
        const parsedBody = JSON.parse(finalBody);
        if (typeof parsedBody === 'object' && parsedBody !== null) {
          const params = new URLSearchParams();
          Object.entries(parsedBody).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
          });
          finalBody = params.toString();
        }
      } catch (e) {
        // If it's not JSON, assume it's already properly encoded
      }
    }

    const res = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: finalBody,
      cache: 'no-store', // Important to avoid caching server-side fetches
      redirect: 'manual', // Manually handle redirects to see 3xx statuses
    });

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let data: any;
    const contentType = res.headers.get('content-type');

    if (res.body) {
      if (contentType && contentType.includes('application/json')) {
        try {
          // Clone the response to read it as text if JSON parsing fails
          const clonedRes = res.clone();
          data = await res.json();
        } catch (e) {
          // If JSON parsing fails, read the original stream as text
          data = await res.text();
        }
      } else {
        data = await res.text();
      }
    } else {
      data = "No content";
    }

    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      data: data,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error.message || 'An unknown network error occurred.',
      cause: error.cause,
    };
  }
}
