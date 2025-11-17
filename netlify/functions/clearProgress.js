import { getStore } from '@netlify/blobs';

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'userId required' })
      };
    }

    // Use Netlify's built-in context variables
    const store = getStore({
      name: 'meditation-progress',
      siteID: context.site?.id || process.env.NETLIFY_SITE_ID,
      token: context.token || process.env.NETLIFY_BLOBS_TOKEN
    });
    await store.delete(userId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Progress cleared' })
    };
  } catch (error) {
    console.error('Clear error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message,
        message: 'Failed to clear progress'
      })
    };
  }
};
