app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  res.status(200).end(); // ack immediately

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const messages = change?.value?.messages;

    if (!messages) return;

    for (const msg of messages) {
      if (msg.type === 'image') {
        const { buffer, mimeType } = await downloadMedia(msg.image.id);
        await forwardToApp({
          type: 'image',
          from: msg.from,
          buffer,
          mimeType,
          caption: msg.image.caption
        });
      }
    }
  } catch (err) {
    console.error('Error processing webhook:', err);
  }
});

async function downloadMedia(mediaId) {
  const metaRes = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
  );
  const mediaInfo = await metaRes.json();
  const fileRes = await fetch(mediaInfo.url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
  });
  const arrayBuffer = await fileRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: mediaInfo.mime_type };
}

async function forwardToApp(payload) {
  await fetch(process.env.BASE44_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': process.env.RENDER_SHARED_SECRET
    },
    body: JSON.stringify({
      type: payload.type,
      from: payload.from,
      imageBase64: payload.buffer.toString('base64'),
      mimeType: payload.mimeType,
      caption: payload.caption
    })
  });
}
