import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../drafts/route';

describe('/api/scenarios/drafts route (PA-T8f)', () => {
  it('saves, lists, and deletes scenario drafts', async () => {
    // 1. Save draft
    const postReq = new NextRequest('http://localhost/api/scenarios/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: '3-Day Test Scenario',
        draft: {
          days: [
            { day: 1, weather: 'sunny' },
            { day: 2, weather: 'cloudy' },
            { day: 3, weather: 'storm' },
          ],
        },
      }),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.id).toBeDefined();

    // 2. List drafts
    const getRes = await GET();
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(Array.isArray(getData.drafts)).toBe(true);
    const found = getData.drafts.find((d: { id: string }) => d.id === postData.id);
    expect(found).toBeDefined();
    expect(found.title).toBe('3-Day Test Scenario');

    // 3. Delete draft
    const deleteReq = new NextRequest(`http://localhost/api/scenarios/drafts?id=${postData.id}`, {
      method: 'DELETE',
    });
    const deleteRes = await DELETE(deleteReq);
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.ok).toBe(true);
  });

  it('rejects invalid draft payload', async () => {
    const postReq = new NextRequest('http://localhost/api/scenarios/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Empty Draft',
        draft: {
          days: [], // min 1 day required
        },
      }),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(400);
  });
});
