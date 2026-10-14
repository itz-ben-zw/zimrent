/* ============================================================
   SMS service for phone OTP login.
   Providers: 'twilio', 'africastalking' (real delivery), or
   anything else = console/dev fallback (code logged, never sent).
   ============================================================ */

function currentProvider() {
  return (process.env.SMS_PROVIDER || '').toLowerCase();
}

function isRealProvider() {
  const p = currentProvider();
  return p === 'twilio' || p === 'africastalking';
}

// Returns true when the OTP was accepted by the provider (or dev console).
async function sendSMS(to, otp) {
  const provider = currentProvider();

  if (provider === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !from) {
      throw new Error('Missing Twilio env vars');
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', from);
    params.append('Body', `Your Homify verification code is ${otp}`);
    const base64 = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${base64}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Twilio error ${resp.status}: ${body}`);
    }
    return true;
  }

  if (provider === 'africastalking') {
    const username = process.env.AFRICASTALKING_USERNAME;
    const apiKey = process.env.AFRICASTALKING_API_KEY;
    const senderId = process.env.AFRICASTALKING_SENDER_ID || 'Homify';
    if (!username || !apiKey) {
      throw new Error('Missing Africa\'s Talking env vars');
    }
    const url = 'https://api.africastalking.com/restless/send';
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('to', to);
    params.append('message', `Your Homify verification code is ${otp}`);
    params.append('senderId', senderId);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'apiKey': apiKey },
      body: params
    });
    const data = await resp.json();
    if (data.SMSMessageData && data.SMSMessageData.Recipients && data.SMSMessageData.Recipients.length > 0) {
      const rec = data.SMSMessageData.Recipients[0];
      if (rec.status !== 'Success' && rec.statusCode !== 100) {
        throw new Error(`AfricaTalking status ${rec.status}`);
      }
      return true;
    }
    if (data.SMSMessageData && data.SMSMessageData.Message) {
      return true;
    }
    throw new Error(`AfricaTalking unexpected response: ${JSON.stringify(data)}`);
  }

  // Console/dev fallback: log only, nothing leaves the server.
  console.log(`📱 OTP for ${to}: ${otp}`);
  return true;
}

module.exports = { sendSMS, isRealProvider };