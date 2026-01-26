import { NextRequest, NextResponse } from 'next/server';

// Handle OAuth callback from Composio
// Composio handles the actual token exchange - we just redirect back
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const error = searchParams.get('error');

    // Build redirect URL with status
    const redirectUrl = new URL('/settings/connections', req.url);

    if (error) {
      redirectUrl.searchParams.set('error', error);
    } else if (status === 'success') {
      redirectUrl.searchParams.set('success', 'true');
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[CONNECTIONS] Callback error:', error);
    const redirectUrl = new URL('/settings/connections', req.url);
    redirectUrl.searchParams.set('error', 'callback_failed');
    return NextResponse.redirect(redirectUrl);
  }
}
