import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleUpload, GET as handleDownload } from '../upload/route';
import { GET as listSessionsRoute, POST as createSessionRoute } from '../sessions/route';
import {
  GET as getSessionRoute,
  POST as saveMessageRoute,
  DELETE as deleteSessionRoute,
} from '../sessions/[id]/route';

describe('Copilot Storage & Sessions API Routes', () => {
  it('handles presigned upload request in /api/copilot/upload', async () => {
    const req = new NextRequest('http://localhost:3000/api/copilot/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'presign',
        filename: 'solar-grid-schematic.png',
        contentType: 'image/png',
      }),
    });

    const res = await handleUpload(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('uploadUrl');
    expect(data).toHaveProperty('fileKey');
    expect(data).toHaveProperty('publicUrl');
  });

  it('handles data URL upload in /api/copilot/upload', async () => {
    const req = new NextRequest('http://localhost:3000/api/copilot/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload_data_url',
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        filename: 'canvas-sketch.png',
      }),
    });

    const res = await handleUpload(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('publicUrl');
    expect(data).toHaveProperty('fileKey');
  });

  it('rejects non-media uploads (HTML, SVG) in /api/copilot/upload', async () => {
    const post = (body: unknown) =>
      handleUpload(
        new NextRequest('http://localhost:3000/api/copilot/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );

    const presign = await post({ action: 'presign', filename: 'x.html', contentType: 'text/html' });
    expect(presign.status).toBe(400);

    const svg = await post({
      action: 'upload_data_url',
      dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    });
    expect(svg.status).toBe(415);
  });

  it('only signs download URLs for keys this route generates', async () => {
    const get = (key: string) =>
      handleDownload(
        new NextRequest(`http://localhost:3000/api/copilot/upload?key=${encodeURIComponent(key)}`)
      );

    expect((await get('copilot/1730000000000-sketch.png')).status).toBe(200);
    expect((await get('secrets/backup.sql')).status).toBe(400);
    expect((await get('copilot/../other/1-x.png')).status).toBe(400);
  });

  it('creates and lists sessions via /api/copilot/sessions', async () => {
    // 1. Create session
    const createReq = new NextRequest('http://localhost:3000/api/copilot/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'API Test Session',
        locale: 'fr',
      }),
    });

    const createRes = await createSessionRoute(createReq);
    expect(createRes.status).toBe(201);
    const { session } = await createRes.json();
    expect(session).toHaveProperty('id');
    expect(session.title).toBe('API Test Session');

    // 2. List sessions
    const listRes = await listSessionsRoute();
    expect(listRes.status).toBe(200);
    const { sessions } = await listRes.json();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.some((s: { id: string }) => s.id === session.id)).toBe(true);

    // 3. Save message to session
    const saveReq = new NextRequest(`http://localhost:3000/api/copilot/sessions/${session.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'msg-test-1',
        role: 'user',
        content: 'Test query',
      }),
    });

    const saveRes = await saveMessageRoute(saveReq, {
      params: Promise.resolve({ id: session.id }),
    });
    expect(saveRes.status).toBe(200);

    // 4. Retrieve session with messages
    const getReq = new NextRequest(`http://localhost:3000/api/copilot/sessions/${session.id}`);
    const getRes = await getSessionRoute(getReq, {
      params: Promise.resolve({ id: session.id }),
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.session.messages.length).toBeGreaterThanOrEqual(1);

    // 5. Delete session
    const delReq = new NextRequest(`http://localhost:3000/api/copilot/sessions/${session.id}`, {
      method: 'DELETE',
    });
    const delRes = await deleteSessionRoute(delReq, {
      params: Promise.resolve({ id: session.id }),
    });
    expect(delRes.status).toBe(200);
  });
});
