import { getStore } from '@netlify/blobs';

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { userId, progressData } = JSON.parse(event.body);

    if (!userId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'userId required' })
      };
    }

    console.log('Saving progress for userId:', userId);

    // Pass context to getStore for authentication
    const store = getStore({
      name: 'meditation-progress',
      siteID: context.site?.id,
      token: context.token
    });
    await store.set(userId, JSON.stringify(progressData));

    console.log('Progress saved successfully');

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ success: true, message: 'Progress saved' })
    };
  } catch (error) {
    console.error('Save error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        message: 'Failed to save progress'
      })
    };
  }
};
