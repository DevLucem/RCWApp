export type ParsedCurl = {
  url: string;
  method: string;
  headers: { key: string; value: string }[];
  body: string;
  bodyType: 'none' | 'json' | 'form-data' | 'text';
};

/**
 * Tokenises a curl command string, respecting quoted strings and escape sequences.
 */
function tokenise(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  // Normalise line-continuation characters produced by curl --help output
  const src = input.replace(/\\\r?\n\s*/g, ' ').trim();

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (ch === '\\' && inDouble) {
      // Consume escape sequence inside double-quotes
      i++;
      if (i < src.length) current += src[i];
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}

/**
 * Detects whether a string looks like a curl command.
 */
export function isCurlCommand(input: string): boolean {
  return /^\s*curl\s+/i.test(input.trim());
}

/**
 * Parses a curl command into a structured object.
 * Returns null if the input does not look like a curl command.
 */
export function parseCurl(input: string): ParsedCurl | null {
  if (!isCurlCommand(input)) return null;

  const tokens = tokenise(input);

  let url = '';
  let method = '';
  const headers: { key: string; value: string }[] = [];
  let body = '';

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    // -X / --request METHOD
    if (token === '-X' || token === '--request') {
      method = tokens[++i]?.toUpperCase() ?? '';
      continue;
    }

    // -H / --header "Key: Value"
    if (token === '-H' || token === '--header') {
      const raw = tokens[++i] ?? '';
      const colonIndex = raw.indexOf(':');
      if (colonIndex !== -1) {
        headers.push({
          key: raw.slice(0, colonIndex).trim(),
          value: raw.slice(colonIndex + 1).trim(),
        });
      }
      continue;
    }

    // -d / --data / --data-raw / --data-binary
    if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-urlencode'
    ) {
      body = tokens[++i] ?? '';
      continue;
    }

    // --json (shorthand for -d + correct content-type, curl ≥ 7.82)
    if (token === '--json') {
      body = tokens[++i] ?? '';
      if (!headers.some(h => h.key.toLowerCase() === 'content-type')) {
        headers.push({ key: 'Content-Type', value: 'application/json' });
      }
      if (!headers.some(h => h.key.toLowerCase() === 'accept')) {
        headers.push({ key: 'Accept', value: 'application/json' });
      }
      continue;
    }

    // -u / --user user:pass  → Authorization: Basic ...
    if (token === '-u' || token === '--user') {
      const creds = tokens[++i] ?? '';
      const encoded = btoa(creds);
      headers.push({ key: 'Authorization', value: `Basic ${encoded}` });
      continue;
    }

    // --oauth2-bearer TOKEN  → Authorization: Bearer ...
    if (token === '--oauth2-bearer') {
      const bearer = tokens[++i] ?? '';
      headers.push({ key: 'Authorization', value: `Bearer ${bearer}` });
      continue;
    }

    // Skip flags we don't care about that take a value
    if (
      [
        '-o', '--output', '--limit-rate', '--connect-timeout', '--max-time',
        '-m', '--proxy', '-x', '--cert', '--key', '--cacert', '-A', '--user-agent',
        '--resolve', '-e', '--referer', '-b', '--cookie',
      ].includes(token)
    ) {
      i++; // skip the value
      continue;
    }

    // Skip boolean flags we don't care about
    if (
      [
        '-v', '--verbose', '-s', '--silent', '-L', '--location', '--compressed',
        '-k', '--insecure', '-I', '--head', '-i', '--include', '-f', '--fail',
        '--http1.0', '--http1.1', '--http2', '--no-keepalive',
      ].includes(token)
    ) {
      // -I / --head implies HEAD method
      if (token === '-I' || token === '--head') {
        if (!method) method = 'HEAD';
      }
      continue;
    }

    // Bare argument is the URL (skip flags starting with -)
    if (!token.startsWith('-') && !url) {
      url = token;
    }
  }

  if (!url) return null;

  // Infer method when not explicitly set
  if (!method) {
    method = body ? 'POST' : 'GET';
  }

  // Determine body type
  let bodyType: ParsedCurl['bodyType'] = 'none';
  if (body) {
    const contentTypeHeader = headers.find(h => h.key.toLowerCase() === 'content-type');
    const ct = contentTypeHeader?.value ?? '';

    if (ct.includes('application/json') || isJsonString(body)) {
      bodyType = 'json';
    } else if (ct.includes('x-www-form-urlencoded') || isFormEncoded(body)) {
      bodyType = 'form-data';
    } else {
      bodyType = 'text';
    }

    // Pretty-print JSON body for readability
    if (bodyType === 'json') {
      try {
        body = JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        // leave as-is
      }
    }
  }

  return { url, method, headers, body, bodyType };
}

function isJsonString(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function isFormEncoded(s: string): boolean {
  // Quick heuristic: key=value pairs separated by &, no whitespace
  return /^[^=&\s]+=[^&]*(&[^=&\s]+=.*)*$/.test(s.trim());
}
