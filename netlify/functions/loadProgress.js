import { getStore } from '@netlify/blobs';

export const handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'userId required' })
      };
    }

    console.log('Loading progress for userId:', userId);

    // Pass context to getStore for authentication
    const store = getStore({
      name: 'meditation-progress',
      siteID: context.site?.id,
      token: context.token
    });
    const data = await store.get(userId, { type: 'text' });

    if (!data) {
      console.log('No data found for userId:', userId);
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ progressData: {} })
      };
    }

    console.log('Data loaded successfully');

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ progressData: JSON.parse(data) })
    };
  } catch (error) {
    console.error('Load error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        message: 'Failed to load progress'
      })
    };
  }
};
