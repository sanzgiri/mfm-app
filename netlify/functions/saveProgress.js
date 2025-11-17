const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
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
    console.log('Progress data:', JSON.stringify(progressData));

    // Use Netlify Blobs for persistent storage
    const store = getStore({
      name: 'meditation-progress',
      consistency: 'strong'  // Ensure strong consistency
    });
    
    await store.set(userId, JSON.stringify(progressData), {
      metadata: {
        lastModified: new Date().toISOString()
      }
    });

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
        error: error.toString(),
        message: 'Failed to save progress'
      })
    };
  }
};
