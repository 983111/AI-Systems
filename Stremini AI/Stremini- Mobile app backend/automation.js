import { Hono } from 'hono';

export const automationRoutes = new Hono();

// ============================================================================
// CONFIGURATION
// ============================================================================
const K2_MODEL   = 'MBZUAI-IFM/K2-Think-v2';
const K2_API_URL = 'https://api.k2think.ai/v1/chat/completions';

const MAX_AGENT_STEPS   = 30;   // raised — complex tasks need more room
const CONTEXT_TRIM      = 8000; // chars kept from screen context
const HISTORY_KEEP      = 25;   // last N actions kept in agent memory

// ============================================================================
// APP REGISTRY  — single source of truth
// ============================================================================
const APPS = {
  whatsapp:      { name: 'WhatsApp',        pkg: 'com.whatsapp' },
  youtube:       { name: 'YouTube',         pkg: 'com.google.android.youtube' },
  'youtube music':{ name: 'YouTube Music',  pkg: 'com.google.android.apps.youtube.music' },
  chrome:        { name: 'Chrome',          pkg: 'com.android.chrome' },
  gmail:         { name: 'Gmail',           pkg: 'com.google.android.gm' },
  maps:          { name: 'Google Maps',     pkg: 'com.google.android.apps.maps' },
  instagram:     { name: 'Instagram',       pkg: 'com.instagram.android' },
  telegram:      { name: 'Telegram',        pkg: 'org.telegram.messenger' },
  settings:      { name: 'Settings',        pkg: 'com.android.settings' },
  camera:        { name: 'Camera',          pkg: 'com.android.camera2' },
  spotify:       { name: 'Spotify',         pkg: 'com.spotify.music' },
  netflix:       { name: 'Netflix',         pkg: 'com.netflix.mediaclient' },
  twitter:       { name: 'X (Twitter)',     pkg: 'com.twitter.android' },
  x:             { name: 'X',               pkg: 'com.twitter.android' },
  facebook:      { name: 'Facebook',        pkg: 'com.facebook.katana' },
  messenger:     { name: 'Messenger',       pkg: 'com.facebook.orca' },
  uber:          { name: 'Uber',            pkg: 'com.ubercab' },
  ola:           { name: 'Ola',             pkg: 'com.olacabs.customer' },
  phone:         { name: 'Phone',           pkg: 'com.android.dialer' },
  calculator:    { name: 'Calculator',      pkg: 'com.android.calculator2' },
  calendar:      { name: 'Calendar',        pkg: 'com.google.android.calendar' },
  clock:         { name: 'Clock',           pkg: 'com.android.deskclock' },
  photos:        { name: 'Google Photos',   pkg: 'com.google.android.apps.photos' },
  drive:         { name: 'Google Drive',    pkg: 'com.google.android.apps.docs' },
  'play store':  { name: 'Play Store',      pkg: 'com.android.vending' },
  contacts:      { name: 'Contacts',        pkg: 'com.android.contacts' },
  messages:      { name: 'Messages',        pkg: 'com.google.android.apps.messaging' },
  snapchat:      { name: 'Snapchat',        pkg: 'com.snapchat.android' },
  swiggy:        { name: 'Swiggy',          pkg: 'in.swiggy.android' },
  zomato:        { name: 'Zomato',          pkg: 'com.application.zomato' },
  gpay:          { name: 'Google Pay',      pkg: 'com.google.android.apps.nbu.paisa.user' },
  phonepe:       { name: 'PhonePe',         pkg: 'com.phonepe.app' },
  paytm:         { name: 'Paytm',           pkg: 'net.one97.paytm' },
  amazon:        { name: 'Amazon',          pkg: 'com.amazon.mShop.android.shopping' },
  flipkart:      { name: 'Flipkart',        pkg: 'com.flipkart.android' },
  discord:       { name: 'Discord',         pkg: 'com.discord' },
  reddit:        { name: 'Reddit',          pkg: 'com.reddit.frontpage' },
  linkedin:      { name: 'LinkedIn',        pkg: 'com.linkedin.android' },
  jiosaavn:      { name: 'JioSaavn',        pkg: 'com.jio.media.jiobeats' },
  gaana:         { name: 'Gaana',           pkg: 'com.gaana' },
  signal:        { name: 'Signal',          pkg: 'org.thoughtcrime.securesms' },
  viber:         { name: 'Viber',           pkg: 'com.viber.voip' },
  tiktok:        { name: 'TikTok',          pkg: 'com.zhiliaoapp.musically' },
  'amazon music':{ name: 'Amazon Music',    pkg: 'com.amazon.mp3' },
  files:         { name: 'Files',           pkg: 'com.google.android.apps.nbu.files' },
  keep:          { name: 'Google Keep',     pkg: 'com.google.android.keep' },
  docs:          { name: 'Google Docs',     pkg: 'com.google.android.apps.docs.editors.docs' },
  sheets:        { name: 'Google Sheets',   pkg: 'com.google.android.apps.docs.editors.sheets' },
  meet:          { name: 'Google Meet',     pkg: 'com.google.android.apps.tachyon' },
  zoom:          { name: 'Zoom',            pkg: 'us.zoom.videomeetings' },
  hotstar:       { name: 'JioCinema',       pkg: 'in.startv.hotstar' },
  prime:         { name: 'Prime Video',     pkg: 'com.amazon.avod.thirdpartyclient' },
};

function getApp(name) {
  const key = (name || '').toLowerCase().trim();
  return APPS[key] || { name, pkg: null };
}

// ============================================================================
// UTILITIES
// ============================================================================

function cleanOutput(text) {
  if (!text) return '';
  // Strip <think> blocks (model reasoning artifacts)
  if (text.includes('</think>')) text = text.split('</think>').pop();
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function safeJSON(text, fallback = null) {
  try {
    // find first JSON structure
    const arrMatch = text.match(/\[[\s\S]*\]/);
    const objMatch = text.match(/\{[\s\S]*\}/);
    const raw = arrMatch
      ? (objMatch && objMatch.index < arrMatch.index ? objMatch[0] : arrMatch[0])
      : objMatch?.[0];
    if (raw) return JSON.parse(raw);
  } catch { /* fall through */ }
  return fallback;
}

function trimContext(ctx) {
  return JSON.stringify(ctx ?? {}).substring(0, CONTEXT_TRIM);
}

// ============================================================================
// LLM CORE
// ============================================================================

async function callK2(messages, apiKey, maxTokens = 1500) {
  const res = await fetch(K2_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: K2_MODEL,
      messages,
      temperature: 0.05,
      top_p: 0.9,
      max_tokens: maxTokens,
      reasoning: false
    })
  });
  if (!res.ok) throw new Error(`K2 API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return cleanOutput(data.choices?.[0]?.message?.content || '');
}

// Runs multiple LLM calls in parallel — used for classify+plan in one shot
async function callK2Parallel(calls, apiKey) {
  return Promise.all(calls.map(({ messages, maxTokens }) => callK2(messages, apiKey, maxTokens)));
}

// ============================================================================
// VOICE COMMAND NORMALIZER
// ============================================================================

function normalizeCommand(command) {
  return command
    .trim()
    .replace(/\byou\s*tube\b/gi, 'youtube')
    .replace(/\bface\s*book\b/gi, 'facebook')
    .replace(/\bins\s*ta\s*gram\b/gi, 'instagram')
    .replace(/\btele\s*gram\b/gi, 'telegram')
    .replace(/\bspot\s*if\s*y\b/gi, 'spotify')
    .replace(/\bnet\s*flix\b/gi, 'netflix')
    .replace(/\bu\s*ber\b/gi, 'uber')
    .replace(/\bput on\b/gi, 'play')
    .replace(/\bturn up the volume\b/gi, 'volume up')
    .replace(/\bturn down the volume\b/gi, 'volume down')
    .replace(/\bsilent mode\b/gi, 'mute')
    .replace(/\b(can you|please|i want to|i would like to|hey stremini|stremini)\s*/gi, '')
    .trim();
}

function extractEntities(command) {
  const entities = {};
  const contactMatch = command.match(
    /(?:message|call|text|whatsapp|send to|video call)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
  ) || command.match(/to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:saying|that|with|about)/i);
  if (contactMatch) entities.contact = contactMatch[1];

  const msgMatch = command.match(/(?:saying|that|with message|message:)\s+["']?(.+?)["']?$/i)
    || command.match(/:\s*["']?(.+?)["']?$/i);
  if (msgMatch) entities.message = msgMatch[1].trim();

  const mediaMatch = command.match(/(?:play|listen to|watch|put on)\s+(.+?)(?:\s+on\s+\w[\w\s]+)?$/i);
  if (mediaMatch) entities.media = mediaMatch[1].trim();

  const urlMatch = command.match(/(?:open|go to|browse to|navigate to)\s+(https?:\/\/\S+|www\.\S+|\S+\.\w{2,})/i);
  if (urlMatch) entities.url = urlMatch[1];

  return entities;
}

// ============================================================================
// FAST PATH  — zero-LLM for common single-action commands
// ============================================================================

const FAST_EXACT = {
  'go home': [{ action: 'home' }, { action: 'done', summary: 'Went home' }],
  'home':    [{ action: 'home' }, { action: 'done', summary: 'Went home' }],
  'go back': [{ action: 'back' }, { action: 'done', summary: 'Went back' }],
  'back':    [{ action: 'back' }, { action: 'done', summary: 'Went back' }],
  'recent apps':   [{ action: 'recents' }, { action: 'done', summary: 'Recent apps' }],
  'recents':       [{ action: 'recents' }, { action: 'done', summary: 'Recent apps' }],
  'app switcher':  [{ action: 'recents' }, { action: 'done', summary: 'Recent apps' }],
  'screenshot':      [{ action: 'screenshot' }, { action: 'done', summary: 'Screenshot taken' }],
  'take screenshot': [{ action: 'screenshot' }, { action: 'done', summary: 'Screenshot taken' }],
  'notifications':      [{ action: 'notifications' }, { action: 'done', summary: 'Notifications opened' }],
  'open notifications': [{ action: 'notifications' }, { action: 'done', summary: 'Notifications opened' }],
  'quick settings': [{ action: 'quick_settings' }, { action: 'done', summary: 'Quick settings opened' }],
  'control center': [{ action: 'quick_settings' }, { action: 'done', summary: 'Quick settings opened' }],
  'volume up':    [{ action: 'volume', direction: 'up' },   { action: 'done', summary: 'Volume up' }],
  'louder':       [{ action: 'volume', direction: 'up' },   { action: 'done', summary: 'Volume up' }],
  'volume down':  [{ action: 'volume', direction: 'down' }, { action: 'done', summary: 'Volume down' }],
  'quieter':      [{ action: 'volume', direction: 'down' }, { action: 'done', summary: 'Volume down' }],
  'mute':         [{ action: 'volume', direction: 'mute' },   { action: 'done', summary: 'Muted' }],
  'silence':      [{ action: 'volume', direction: 'mute' },   { action: 'done', summary: 'Muted' }],
  'unmute':       [{ action: 'volume', direction: 'unmute' }, { action: 'done', summary: 'Unmuted' }],
  'pause':        [{ action: 'media_key', key: 'pause' }, { action: 'done', summary: 'Paused' }],
  'pause music':  [{ action: 'media_key', key: 'pause' }, { action: 'done', summary: 'Paused' }],
  'play':         [{ action: 'media_key', key: 'play' },  { action: 'done', summary: 'Playing' }],
  'resume':       [{ action: 'media_key', key: 'play' },  { action: 'done', summary: 'Resumed' }],
  'next':         [{ action: 'media_key', key: 'next' },     { action: 'done', summary: 'Next track' }],
  'next song':    [{ action: 'media_key', key: 'next' },     { action: 'done', summary: 'Next track' }],
  'skip':         [{ action: 'media_key', key: 'next' },     { action: 'done', summary: 'Skipped' }],
  'previous':     [{ action: 'media_key', key: 'previous' }, { action: 'done', summary: 'Previous track' }],
  'previous song':[{ action: 'media_key', key: 'previous' }, { action: 'done', summary: 'Previous track' }],
  'scroll down':      [{ action: 'scroll', direction: 'down', amount: 1 },  { action: 'done', summary: 'Scrolled down' }],
  'scroll up':        [{ action: 'scroll', direction: 'up',   amount: 1 },  { action: 'done', summary: 'Scrolled up' }],
  'scroll to top':    [{ action: 'scroll', direction: 'up',   amount: 10 }, { action: 'done', summary: 'Scrolled to top' }],
  'scroll to bottom': [{ action: 'scroll', direction: 'down', amount: 10 }, { action: 'done', summary: 'Scrolled to bottom' }],
  'swipe left':  [{ action: 'swipe', from: [900, 800], to: [100, 800], duration_ms: 300 }, { action: 'done', summary: 'Swiped left' }],
  'swipe right': [{ action: 'swipe', from: [100, 800], to: [900, 800], duration_ms: 300 }, { action: 'done', summary: 'Swiped right' }],
  'swipe up':    [{ action: 'swipe', from: [540, 1200], to: [540, 400],  duration_ms: 300 }, { action: 'done', summary: 'Swiped up' }],
  'swipe down':  [{ action: 'swipe', from: [540, 400],  to: [540, 1200], duration_ms: 300 }, { action: 'done', summary: 'Swiped down' }],
  'copy':       [{ action: 'clipboard', operation: 'copy' },       { action: 'done', summary: 'Copied' }],
  'paste':      [{ action: 'clipboard', operation: 'paste' },      { action: 'done', summary: 'Pasted' }],
  'cut':        [{ action: 'clipboard', operation: 'cut' },        { action: 'done', summary: 'Cut' }],
  'select all': [{ action: 'clipboard', operation: 'select_all' }, { action: 'done', summary: 'Selected all' }],
  'increase brightness': [{ action: 'brightness', direction: 'up' },   { action: 'done', summary: 'Brightness increased' }],
  'decrease brightness': [{ action: 'brightness', direction: 'down' }, { action: 'done', summary: 'Brightness decreased' }],
  'brightness up':   [{ action: 'brightness', direction: 'up' },   { action: 'done', summary: 'Brightness up' }],
  'brightness down': [{ action: 'brightness', direction: 'down' }, { action: 'done', summary: 'Brightness down' }],
};

function getFastPath(cmd) {
  const lower = cmd.toLowerCase().trim();
  if (FAST_EXACT[lower]) return FAST_EXACT[lower];

  // Open known app
  for (const prefix of ['open ', 'launch ', 'start ']) {
    if (lower.startsWith(prefix)) {
      const appKey = lower.slice(prefix.length).trim();
      const app = APPS[appKey];
      if (app) return [
        { action: 'open_app', app_name: app.name, package: app.pkg },
        { action: 'wait', duration_ms: 1500 },
        { action: 'done', summary: `Opened ${app.name}` }
      ];
    }
  }
  return null;
}

// ============================================================================
// TEMPLATE ACTIONS  — handcrafted reliable flows for common intents
// ============================================================================

const Templates = {
  messaging(intent) {
    const app  = getApp(intent.app_target || 'whatsapp');
    const contact = intent.contact || '';
    const message = intent.message_text || 'Hello';
    return [
      { action: 'open_app', app_name: app.name, package: app.pkg },
      { action: 'wait', duration_ms: 2000 },
      { action: 'tap', target_text: 'Search' },
      { action: 'wait', duration_ms: 500 },
      { action: 'type', text: contact, clear_first: true },
      { action: 'wait', duration_ms: 1200 },
      { action: 'request_screen' },
      { action: 'tap', target_text: contact },
      { action: 'wait', duration_ms: 1000 },
      { action: 'tap', target_text: 'Message' },
      { action: 'type', text: message, clear_first: true },
      { action: 'wait', duration_ms: 300 },
      { action: 'tap', target_text: 'Send' },
      { action: 'wait', duration_ms: 500 },
      { action: 'done', summary: `Sent "${message}" to ${contact} via ${app.name}` }
    ];
  },

  call(intent) {
    const sub = (intent.action || '').toLowerCase();
    if (sub.includes('answer') || sub.includes('pick'))
      return [{ action: 'tap', target_text: 'Answer' }, { action: 'done', summary: 'Answered call' }];
    if (sub.includes('decline') || sub.includes('reject'))
      return [{ action: 'tap', target_text: 'Decline' }, { action: 'done', summary: 'Declined call' }];
    if (sub.includes('hang') || sub.includes('end'))
      return [{ action: 'tap', target_text: 'End call' }, { action: 'done', summary: 'Ended call' }];
    const contact = intent.contact || '';
    return [
      { action: 'open_app', app_name: 'Phone', package: APPS.phone.pkg },
      { action: 'wait', duration_ms: 1500 },
      { action: 'tap', target_text: 'Search' },
      { action: 'type', text: contact, clear_first: true },
      { action: 'wait', duration_ms: 1000 },
      { action: 'request_screen' },
      { action: 'tap', target_text: contact },
      { action: 'wait', duration_ms: 500 },
      { action: 'tap', target_text: 'Call' },
      { action: 'done', summary: `Calling ${contact}` }
    ];
  },

  media(intent) {
    const query  = intent.media_query || intent.search_query || '';
    const appKey = (intent.app_target || 'youtube music').toLowerCase();
    const action = (intent.action || 'play').toLowerCase();
    if (action.includes('pause') || action.includes('stop'))
      return [{ action: 'media_key', key: 'pause' }, { action: 'done', summary: 'Paused media' }];
    if (action.includes('next'))
      return [{ action: 'media_key', key: 'next' }, { action: 'done', summary: 'Next track' }];
    if (action.includes('prev'))
      return [{ action: 'media_key', key: 'previous' }, { action: 'done', summary: 'Previous track' }];
    const app = getApp(appKey);
    return [
      { action: 'open_app', app_name: app.name, package: app.pkg },
      { action: 'wait', duration_ms: 2000 },
      { action: 'tap', target_text: 'Search' },
      { action: 'wait', duration_ms: 500 },
      { action: 'type', text: query, clear_first: true },
      { action: 'wait', duration_ms: 300 },
      { action: 'tap', target_text: 'Search' },
      { action: 'wait', duration_ms: 1500 },
      { action: 'request_screen' },
      { action: 'tap', target_text: query.split(' ')[0] },
      { action: 'done', summary: `Playing "${query}" on ${app.name}` }
    ];
  },

  social(intent) {
    const app    = getApp(intent.app_target || 'instagram');
    const text   = intent.message_text || '';
    const action = (intent.action || 'post').toLowerCase();
    if (action.includes('story')) return [
      { action: 'open_app', app_name: app.name, package: app.pkg },
      { action: 'wait', duration_ms: 2000 },
      { action: 'tap', target_text: 'Your story' },
      { action: 'done', summary: `Opened story on ${app.name}` }
    ];
    return [
      { action: 'open_app', app_name: app.name, package: app.pkg },
      { action: 'wait', duration_ms: 2000 },
      { action: 'tap', target_text: 'compose' },
      { action: 'wait', duration_ms: 800 },
      { action: 'type', text, clear_first: true },
      { action: 'tap', target_text: 'Post' },
      { action: 'done', summary: `Posted on ${app.name}` }
    ];
  },

  maps(intent) {
    const dest = intent.search_query || intent.action || '';
    return [
      { action: 'open_app', app_name: 'Google Maps', package: APPS.maps.pkg },
      { action: 'wait', duration_ms: 2000 },
      { action: 'tap', target_text: 'Search here' },
      { action: 'type', text: dest, clear_first: true },
      { action: 'wait', duration_ms: 1000 },
      { action: 'request_screen' },
      { action: 'tap', target_text: dest.split(' ').slice(0, 2).join(' ') },
      { action: 'wait', duration_ms: 1000 },
      { action: 'tap', target_text: 'Directions' },
      { action: 'done', summary: `Directions to ${dest}` }
    ];
  },

  email(intent) {
    const to      = intent.contact || '';
    const subject = intent.action || 'Message';
    const body    = intent.message_text || '';
    return [
      { action: 'open_app', app_name: 'Gmail', package: APPS.gmail.pkg },
      { action: 'wait', duration_ms: 2000 },
      { action: 'tap', target_text: 'Compose' },
      { action: 'wait', duration_ms: 1000 },
      { action: 'tap', target_text: 'To' },
      { action: 'type', text: to, clear_first: true },
      { action: 'tap', target_text: 'Subject' },
      { action: 'type', text: subject, clear_first: true },
      { action: 'tap', target_text: 'Compose email' },
      { action: 'type', text: body, clear_first: true },
      { action: 'tap', target_text: 'Send' },
      { action: 'done', summary: `Email sent to ${to}` }
    ];
  },

  reminder(intent) {
    return [
      { action: 'open_app', app_name: 'Clock', package: APPS.clock.pkg },
      { action: 'wait', duration_ms: 1500 },
      { action: 'tap', target_text: 'Alarm' },
      { action: 'wait', duration_ms: 500 },
      { action: 'tap', target_text: 'Add alarm' },
      { action: 'done', summary: 'Opened alarm settings' }
    ];
  },

  browser(intent) {
    const url = intent.url || intent.search_query || '';
    const full = url.startsWith('http')
      ? url
      : url.includes('.')
        ? `https://${url}`
        : `https://google.com/search?q=${encodeURIComponent(url)}`;
    return [
      { action: 'open_app', app_name: 'Chrome', package: APPS.chrome.pkg },
      { action: 'wait', duration_ms: 1500 },
      { action: 'tap', target_text: 'Search or type web address' },
      { action: 'type', text: full, clear_first: true },
      { action: 'tap', target_text: 'Go' },
      { action: 'done', summary: `Opened ${url}` }
    ];
  },

  camera(intent) {
    const isVideo = (intent.action || '').toLowerCase().includes('video');
    return [
      { action: 'open_app', app_name: 'Camera', package: APPS.camera.pkg },
      { action: 'wait', duration_ms: 1500 },
      ...(isVideo ? [{ action: 'tap', target_text: 'Video' }, { action: 'wait', duration_ms: 500 }] : []),
      { action: 'done', summary: `Camera opened${isVideo ? ' in video mode' : ''}` }
    ];
  },
};

// ============================================================================
// INTENT ROUTER  — maps parsed intent → template or AI fallback
// ============================================================================
function routeIntent(intent, screenContext, command, apiKey) {
  switch (intent.intent) {
    case 'messaging': return Templates.messaging(intent);
    case 'call':      return Templates.call(intent);
    case 'media':     return Templates.media(intent);
    case 'social':    return Templates.social(intent);
    case 'maps':      return Templates.maps(intent);
    case 'email':     return Templates.email(intent);
    case 'reminder':  return Templates.reminder(intent);
    case 'browser':   return Templates.browser(intent);
    case 'camera':    return Templates.camera(intent);
    default:          return null; // will fall through to agentic
  }
}

// ============================================================================
// MASTER AGENT SYSTEM PROMPT  — used in every agentic step
// ============================================================================
function buildAgentSystemPrompt() {
  const appList = Object.values(APPS)
    .map(a => `  ${a.name}: ${a.pkg}`)
    .join('\n');

  return `You are Stremini — a silent AI agent with FULL CONTROL of an Android device via AccessibilityService.
You see the screen, think step-by-step, and emit JSON action arrays to accomplish the user's goal.

════ CAPABILITIES ════
• Messaging: WhatsApp, SMS, Telegram, Instagram, Signal, Discord, Snapchat, Viber, Messenger
• Calls: make, answer, decline, end, video call
• Media: YouTube, Spotify, JioSaavn, Gaana, Amazon Music, YouTube Music, Netflix, Prime, JioCinema
• Social: Instagram, Twitter/X, Facebook, LinkedIn, Reddit, TikTok
• Navigation: Google Maps, Ola, Uber
• Email: Gmail
• Productivity: Calendar, Clock, Google Drive, Docs, Sheets, Keep
• Payments: GPay, PhonePe, Paytm
• Shopping: Amazon, Flipkart
• Food delivery: Swiggy, Zomato
• System: WiFi, Bluetooth, brightness, volume, airplane mode, DND, hotspot
• Browser: Chrome — search, navigate, fill forms
• Files, Camera, Photos
• ANY installed app

════ ACTION SCHEMA ════
{"action":"tap",           "target_text":"...", "coordinates":[x,y]}
{"action":"long_press",    "target_text":"..."}
{"action":"type",          "text":"...", "clear_first":true}
{"action":"scroll",        "direction":"up|down|left|right", "amount":3}
{"action":"swipe",         "from":[x1,y1], "to":[x2,y2], "duration_ms":300}
{"action":"open_app",      "app_name":"...", "package":"..."}
{"action":"home"}
{"action":"back"}
{"action":"recents"}
{"action":"notifications"}
{"action":"quick_settings"}
{"action":"screenshot"}
{"action":"volume",        "direction":"up|down|mute|unmute"}
{"action":"media_key",     "key":"play|pause|next|previous"}
{"action":"brightness",    "direction":"up|down", "value":0}
{"action":"clipboard",     "operation":"copy|paste|cut|select_all"}
{"action":"wait",          "duration_ms":1500}
{"action":"request_screen"}
{"action":"done",          "summary":"...", "result":"..."}
{"action":"error",         "reason":"...", "recoverable":true}

════ APP PACKAGES ════
${appList}

════ INTELLIGENCE RULES ════
1. NEVER emit a "speak" action.
2. After open_app, always wait ≥1500ms then request_screen.
3. After type, wait 300ms.
4. If an element isn't found, scroll and retry before giving up.
5. Use request_screen after every 2–3 taps to verify state.
6. For forms: tap field → type → tap next field (never assume focus).
7. For search: tap search field → type query → wait → tap result.
8. Prefer target_text over coordinates — coordinates break on different screen sizes.
9. Batch related actions together (no single-action arrays except for simple commands).
10. End EVERY task with done(). Include a useful summary and result in done.
11. If stuck after 2 retries, emit error() with recoverable:false.
12. Multi-step tasks: emit 3–6 actions per step, use request_screen to check progress.
13. For settings toggles, open quick_settings or Settings app as appropriate.
14. For payments, always navigate step-by-step and request_screen at each confirmation screen.`;
}

// ============================================================================
// AGENTIC EXECUTOR  — the core AI loop brain
// ============================================================================

class AgenticExecutor {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.systemPrompt = buildAgentSystemPrompt();
  }

  async nextStep(command, screenContext, stepNumber = 1, previousActions = [], previousError = null) {
    const contextString = trimContext(screenContext);
    const history = previousActions.slice(-HISTORY_KEEP);

    // Compress history: keep full detail for last 5, summaries for older ones
    const recentHistory = history.slice(-5);
    const olderHistory  = history.slice(0, -5).map(a => ({
      action: a.action,
      ...(a.summary ? { summary: a.summary } : {}),
      ...(a.target_text ? { target_text: a.target_text } : {}),
    }));

    const userMessage = `TASK: "${command}"
STEP: ${stepNumber} / ${MAX_AGENT_STEPS}
${previousError ? `⚠ LAST ERROR: ${previousError}\n  → Try a different approach.` : ''}
HISTORY (${history.length} actions):
${olderHistory.length ? `[older] ${JSON.stringify(olderHistory)}\n` : ''}[recent] ${JSON.stringify(recentHistory)}
CURRENT SCREEN:
${contextString}

Analyze the screen and history, then return the next JSON action array to make progress on the task.
Think: what is currently visible? what has been done? what is the logical next step?`;

    try {
      const raw = await callK2(
        [{ role: 'system', content: this.systemPrompt }, { role: 'user', content: userMessage }],
        this.apiKey, 2048
      );
      const parsed = safeJSON(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(a => a.action !== 'speak');
      }
      // If AI returned an object or garbage, wrap it
      return [{ action: 'done', summary: 'Unexpected AI response format — task may need retry.' }];
    } catch (err) {
      return [{ action: 'error', reason: err.message, recoverable: true }];
    }
  }

  // Full autonomous run — executes all steps, requesting screen between them
  // Returns complete action log. The caller is responsible for actual device execution.
  async runFull(command, initialScreen, onStep = null) {
    let screen = initialScreen || {};
    let history = [];
    let error   = null;
    let step    = 1;
    let done    = false;

    while (!done && step <= MAX_AGENT_STEPS) {
      const actions = await this.nextStep(command, screen, step, history, error);
      history = [...history, ...actions];

      if (onStep) await onStep({ step, actions, history });

      done = actions.some(a => a.action === 'done' || (a.action === 'error' && !a.recoverable));
      error = actions.find(a => a.action === 'error')?.reason || null;

      // If a request_screen is in the batch, the caller should update `screen`
      // before the next step. Since this is server-side, we just continue.
      step++;
    }

    return { history, steps: step - 1, completed: done };
  }
}

// ============================================================================
// PARALLEL INTENT + CLASSIFICATION  — single round-trip for both
// ============================================================================

async function classifyAndParse(command, screenContext, apiKey) {
  const [classifyRaw, intentRaw] = await callK2Parallel([
    {
      messages: [
        {
          role: 'system',
          content: `You are a task classifier for a silent Android automation system.
Return ONLY valid JSON:
{"task_type":"simple_nav"|"multi_step"|"research"|"search"|"compose"|"system_control"|"query"|"media"|"messaging"|"call"|"social"|"browser"|"maps","requires_screen":boolean,"agentive":boolean,"description":"one sentence","estimated_steps":number,"app_hints":["app names"],"priority":"low"|"medium"|"high"}`
        },
        { role: 'user', content: `Command: "${command}"` }
      ],
      maxTokens: 300
    },
    {
      messages: [
        {
          role: 'system',
          content: `You are an Android voice command intent parser.
Return ONLY valid JSON:
{"intent":"messaging"|"call"|"open_app"|"media"|"search"|"navigation"|"system"|"browser"|"social"|"email"|"reminder"|"camera"|"maps"|"contacts"|"clipboard"|"compose"|"multi_step"|"query","confidence":0.0,"app_target":"","contact":"","message_text":"","media_query":"","search_query":"","url":"","setting":"","setting_value":"","action":"","description":"","sub_tasks":[]}`
        },
        { role: 'user', content: `Command: "${command}"\nScreen: ${JSON.stringify(screenContext).substring(0, 1000)}` }
      ],
      maxTokens: 500
    }
  ], apiKey);

  const classification = safeJSON(classifyRaw, { task_type: 'multi_step', agentive: true, estimated_steps: 5, priority: 'medium' });
  const intent         = safeJSON(intentRaw,   { intent: 'multi_step', confidence: 0.5, action: command, description: command });
  return { classification, intent };
}

// ============================================================================
// ROUTES
// ============================================================================

// ── Main execution endpoint ──────────────────────────────────────────────────
automationRoutes.post('/execute-task', async (c) => {
  try {
    const {
      command, ui_context = {}, execute = false,
      agentMode = false, stepNumber = 1,
      previousActions = [], previousError = null,
      runFull = false
    } = await c.req.json();

    if (!command) return c.json({ error: 'command is required' }, 400);
    if (!c.env.K2_API_KEY) return c.json({ error: 'Missing K2_API_KEY' }, 500);

    const apiKey            = c.env.K2_API_KEY;
    const normalizedCommand = normalizeCommand(command);
    const base              = { timestamp: Date.now(), original_command: command, normalized_command: normalizedCommand };

    // 1. Fast path — zero latency for simple commands
    const fast = getFastPath(normalizedCommand);
    if (fast) return c.json({ ...base, actions: fast, is_done: true, fast_path: true, type: 'fast' });

    // 2. Agentic step (caller manages the loop)
    if (agentMode) {
      if (stepNumber > MAX_AGENT_STEPS)
        return c.json({ ...base, actions: [{ action: 'done', summary: 'Max steps reached.' }], is_done: true, type: 'agentic' });
      const agent   = new AgenticExecutor(apiKey);
      const actions = await agent.nextStep(normalizedCommand, ui_context, stepNumber, previousActions, previousError);
      const isDone  = actions.some(a => a.action === 'done' || (a.action === 'error' && !a.recoverable));
      return c.json({ ...base, actions, step: stepNumber, is_done: isDone, status: isDone ? 'completed' : 'in_progress', type: 'agentic' });
    }

    // 3. Full autonomous run (server-side loop, no screen feedback)
    if (runFull) {
      const agent  = new AgenticExecutor(apiKey);
      const result = await agent.runFull(normalizedCommand, ui_context);
      return c.json({ ...base, ...result, type: 'full_run' });
    }

    // 4. Smart routing: classify + parse intent in parallel, then pick best path
    const { classification, intent } = await classifyAndParse(normalizedCommand, ui_context, apiKey);

    // Try template first
    const templateActions = routeIntent(intent, ui_context, normalizedCommand, apiKey);
    if (templateActions) {
      return c.json({ ...base, actions: templateActions, classification, intent, is_done: true, type: 'template' });
    }

    // Fallback to agentic for anything complex
    const agent   = new AgenticExecutor(apiKey);
    const actions = await agent.nextStep(normalizedCommand, ui_context, 1, [], null);
    const isDone  = actions.some(a => a.action === 'done');
    return c.json({ ...base, actions, classification, intent, step: 1, is_done: isDone, status: isDone ? 'completed' : 'in_progress', type: 'agentic' });

  } catch (err) {
    return c.json({ error: 'Processing failed', message: err.message }, 500);
  }
});

// ── Voice command endpoint ────────────────────────────────────────────────────
automationRoutes.post('/voice-command', async (c) => {
  try {
    const { command, ui_context = {}, step = 1, history = [], error = null } = await c.req.json();
    if (!command) return c.json({ error: 'command is required' }, 400);
    if (!c.env.K2_API_KEY) return c.json({ error: 'Missing K2_API_KEY' }, 500);

    const normalizedCommand = normalizeCommand(command);
    const entities          = extractEntities(normalizedCommand);

    // Fast path first — no LLM needed
    const fast = getFastPath(normalizedCommand);
    if (fast) return c.json({ original_command: command, normalized_command: normalizedCommand, entities, actions: fast, is_done: true, fast_path: true, type: 'voice' });

    if (step > MAX_AGENT_STEPS)
      return c.json({ actions: [{ action: 'done', summary: 'Max steps reached.' }], is_done: true });

    const agent   = new AgenticExecutor(c.env.K2_API_KEY);
    const actions = await agent.nextStep(normalizedCommand, ui_context, step, history, error);
    const isDone  = actions.some(a => a.action === 'done');

    return c.json({ original_command: command, normalized_command: normalizedCommand, entities, actions, step, is_done: isDone, fast_path: false, type: 'voice' });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Intent parsing ────────────────────────────────────────────────────────────
automationRoutes.post('/parse-intent', async (c) => {
  try {
    const { command, ui_context = {} } = await c.req.json();
    const normalizedCommand = normalizeCommand(command);
    const entities          = extractEntities(normalizedCommand);
    const raw = await callK2([
      {
        role: 'system',
        content: `Parse the Android command into intent JSON. Return ONLY valid JSON.
{"intent":"messaging|call|open_app|media|search|navigation|system|browser|social|email|reminder|camera|maps|contacts|clipboard|compose|multi_step|query","confidence":0.0,"app_target":"","contact":"","message_text":"","media_query":"","search_query":"","url":"","setting":"","setting_value":"","action":"","description":"","sub_tasks":[]}`
      },
      { role: 'user', content: `Command: "${normalizedCommand}"\nScreen: ${trimContext(ui_context)}` }
    ], c.env.K2_API_KEY, 500);
    const intent = safeJSON(raw, { intent: 'multi_step', confidence: 0.5 });
    return c.json({ command, normalizedCommand, entities, intent });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ── Task classification ───────────────────────────────────────────────────────
automationRoutes.post('/classify-task', async (c) => {
  try {
    const { command } = await c.req.json();
    const raw = await callK2([
      {
        role: 'system',
        content: `Classify the Android automation task. Return ONLY valid JSON.
{"task_type":"simple_nav|multi_step|research|search|compose|system_control|query|media|messaging|call|social|browser|maps","requires_screen":boolean,"agentive":boolean,"description":"one sentence","estimated_steps":number,"app_hints":["app names"],"priority":"low|medium|high"}`
      },
      { role: 'user', content: `Command: "${command}"` }
    ], c.env.K2_API_KEY, 300);
    return c.json(safeJSON(raw, { task_type: 'multi_step', agentive: true, estimated_steps: 5 }));
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ── Generate actions for intent ───────────────────────────────────────────────
automationRoutes.post('/generate-actions', async (c) => {
  try {
    const { command, intent, ui_context = {} } = await c.req.json();
    const actions = routeIntent(intent, ui_context, command, c.env.K2_API_KEY)
      || (await new AgenticExecutor(c.env.K2_API_KEY).nextStep(command, ui_context, 1, [], null));
    return c.json({ command, intent, actions });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ── Status ────────────────────────────────────────────────────────────────────
automationRoutes.get('/status', (c) => c.json({
  status:       c.env?.K2_API_KEY ? 'online' : 'degraded',
  service:      'Stremini Silent Auto Tasker v3',
  model:        K2_MODEL,
  mode:         'Silent Agentic (No-TTS)',
  version:      '3.0.0',
  max_steps:    MAX_AGENT_STEPS,
  apps_known:   Object.keys(APPS).length,
  fast_path_commands: Object.keys(FAST_EXACT).length,
  capabilities: Object.keys(Templates),
}));