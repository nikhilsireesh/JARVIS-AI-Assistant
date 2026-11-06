import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    console.error('OAuth Callback: Code query parameter is missing');
    return NextResponse.redirect(new URL('/?error=missing_code', request.url));
  }

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

    console.log(`OAuth Callback: Forwarding code coordinates to backend callback: ${API_URL}/auth/google/callback`);
    
    const res = await fetch(`${API_URL}/auth/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Backend callback failed: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    
    // Redirect to home page with token as query param to store in localStorage (cross-origin cookie bypass)
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('token', data.token);
    
    console.log('OAuth Callback: Redirecting with token query parameter.');
    return NextResponse.redirect(redirectUrl);

  } catch (err) {
    console.error('OAuth Callback: Error exchanging coordinates:', err);
    return NextResponse.redirect(
      new URL(`/?error=auth_failed&details=${encodeURIComponent((err as Error).message)}`, request.url)
    );
  }
}
