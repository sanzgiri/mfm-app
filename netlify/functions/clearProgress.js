exports.handler = async (event, context) => {
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

    // Use Netlify Blobs - simpler approach
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('meditation-progress');
    
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
