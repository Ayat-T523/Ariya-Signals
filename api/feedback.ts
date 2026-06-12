export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { rating, comment, userEmail, organisation, route, timestamp } = req.body ?? {}

  const webhookUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL

  const ratingLabel: Record<string, string> = {
    '😕': '😕 Not great',
    '😐': "😐 It's okay",
    '🤩': '🤩 Love it',
  }

  const lines = [
    `*New feedback — Ariya Signals*`,
    '',
    `*Rating:*  ${ratingLabel[rating] ?? rating}`,
    `*Page:*  \`${route}\``,
    `*User:*  ${userEmail} (${organisation})`,
    comment ? `*Comment:*  ${comment}` : null,
    `*Time:*  ${timestamp}`,
  ]
    .filter((l): l is string => l !== null)
    .join('\n')

  if (!webhookUrl) {
    console.log('[feedback] SLACK_FEEDBACK_WEBHOOK_URL not set. Payload:', {
      rating, comment, userEmail, organisation, route, timestamp,
    })
    return res.status(200).json({ ok: true })
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines }),
    })
  } catch (err) {
    console.error('[feedback] Slack webhook error:', err)
  }

  return res.status(200).json({ ok: true })
}
