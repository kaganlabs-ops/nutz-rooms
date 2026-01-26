import { NextRequest, NextResponse } from 'next/server';
import {
  getConnectedApps,
  initiateConnection,
  disconnectApp,
  COMPOSIO_APPS
} from '@/lib/integrations/composio';

// GET: List user's connected apps
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const connectedApps = await getConnectedApps(userId);

    return NextResponse.json({
      connected: connectedApps,
      available: COMPOSIO_APPS,
    });
  } catch (error) {
    console.error('[CONNECTIONS] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get connections' },
      { status: 500 }
    );
  }
}

// POST: Initiate OAuth flow
export async function POST(req: NextRequest) {
  try {
    const { userId, appName } = await req.json();

    if (!userId || !appName) {
      return NextResponse.json(
        { error: 'userId and appName required' },
        { status: 400 }
      );
    }

    const { redirectUrl } = await initiateConnection(userId, appName);

    return NextResponse.json({ redirectUrl });
  } catch (error) {
    console.error('[CONNECTIONS] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}

// DELETE: Disconnect app
export async function DELETE(req: NextRequest) {
  try {
    const { userId, connectionId } = await req.json();

    if (!userId || !connectionId) {
      return NextResponse.json(
        { error: 'userId and connectionId required' },
        { status: 400 }
      );
    }

    await disconnectApp(userId, connectionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CONNECTIONS] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
