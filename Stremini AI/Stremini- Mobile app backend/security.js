import { Hono } from "hono";

export const securityRoutes = new Hono();

// ==========================================
// CONFIG
// ==========================================
const K2_MODEL = 'MBZUAI-IFM/K2-Think-v2';
const K2_API_URL = 'https://api.k2think.ai/v1/chat/completions';

const domainCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

// ==========================================
// UTILITIES
// ==========================================
function cleanOutput(text) {
  if (!text) return '';
  if (text.includes('</think>')) {
    text = text.split('</think>').pop().trim();
  }
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

function clamp(val, max = 1.0) {
  return Math.min(max, Math.max(0, val));
}

// ==========================================
// SAFE DOMAINS — declared BEFORE extractUrls()
// ==========================================
const SAFE_DOMAINS = new Set([
  'google.com', 'youtube.com', 'facebook.com', 'instagram.com',
  'twitter.com', 'x.com', 'apple.com', 'microsoft.com', 'amazon.com',
  'linkedin.com', 'github.com', 'wikipedia.org', 'reddit.com',
  'netflix.com', 'spotify.com', 'whatsapp.com', 'telegram.org',
  'stackoverflow.com', 'cloudflare.com', 'mozilla.org', 'npmjs.com'
]);

// ==========================================
// KNOWN THREAT DOMAIN BLOCKLIST
// Instant high-confidence flag on exact or apex domain match
// ==========================================
const KNOWN_THREAT_DOMAINS = new Map([
  // --- Piracy / Torrents ---
  ['thepiratebay.org',        { score: 0.95, category: 'Piracy', detail: 'The Pirate Bay — major piracy site' }],
  ['thepiratebay.se',         { score: 0.95, category: 'Piracy', detail: 'The Pirate Bay mirror' }],
  ['piratebay.org',           { score: 0.95, category: 'Piracy', detail: 'Pirate Bay mirror' }],
  ['1337x.to',                { score: 0.93, category: 'Piracy', detail: '1337x — torrent/piracy site' }],
  ['1337x.st',                { score: 0.93, category: 'Piracy', detail: '1337x mirror' }],
  ['yts.mx',                  { score: 0.92, category: 'Piracy', detail: 'YTS — illegal movie torrents' }],
  ['yts.lt',                  { score: 0.92, category: 'Piracy', detail: 'YTS mirror' }],
  ['yts.am',                  { score: 0.92, category: 'Piracy', detail: 'YTS mirror' }],
  ['rarbg.to',                { score: 0.92, category: 'Piracy', detail: 'RARBG — piracy site' }],
  ['kickasstorrents.cr',      { score: 0.92, category: 'Piracy', detail: 'KickassTorrents — piracy site' }],
  ['kat.cr',                  { score: 0.92, category: 'Piracy', detail: 'KAT — piracy site' }],
  ['torrentgalaxy.to',        { score: 0.90, category: 'Piracy', detail: 'TorrentGalaxy — piracy site' }],
  ['limetorrents.info',       { score: 0.90, category: 'Piracy', detail: 'LimeTorrents — piracy site' }],
  ['zooqle.com',              { score: 0.90, category: 'Piracy', detail: 'Zooqle — torrent/piracy site' }],
  ['nyaa.si',                 { score: 0.88, category: 'Piracy', detail: 'Nyaa — anime piracy tracker' }],
  ['rutracker.org',           { score: 0.88, category: 'Piracy', detail: 'RuTracker — piracy forum' }],
  ['fmovies.to',              { score: 0.90, category: 'Piracy', detail: 'FMovies — illegal streaming' }],
  ['fmovies.ps',              { score: 0.90, category: 'Piracy', detail: 'FMovies mirror' }],
  ['123movies.com',           { score: 0.90, category: 'Piracy', detail: '123Movies — illegal streaming' }],
  ['gomovies.to',             { score: 0.88, category: 'Piracy', detail: 'GoMovies — illegal streaming' }],
  ['putlocker.vip',           { score: 0.88, category: 'Piracy', detail: 'Putlocker — illegal streaming' }],
  ['solarmovie.one',          { score: 0.87, category: 'Piracy', detail: 'SolarMovie — illegal streaming' }],
  ['cricfree.sc',             { score: 0.87, category: 'Piracy', detail: 'CricFree — illegal sports streams' }],
  ['streameast.live',         { score: 0.87, category: 'Piracy', detail: 'StreamEast — illegal sports streams' }],
  ['crackstreams.com',        { score: 0.88, category: 'Piracy', detail: 'CrackStreams — illegal streams' }],
  ['libgen.rs',               { score: 0.90, category: 'Piracy', detail: 'Library Genesis — pirated books/papers' }],
  ['libgen.is',               { score: 0.90, category: 'Piracy', detail: 'Library Genesis mirror' }],
  ['libgen.li',               { score: 0.90, category: 'Piracy', detail: 'Library Genesis mirror' }],
  ['sci-hub.se',              { score: 0.88, category: 'Piracy', detail: 'Sci-Hub — pirated academic papers' }],
  ['sci-hub.st',              { score: 0.88, category: 'Piracy', detail: 'Sci-Hub mirror' }],
  ['sci-hub.do',              { score: 0.88, category: 'Piracy', detail: 'Sci-Hub mirror' }],
  ['z-lib.org',               { score: 0.88, category: 'Piracy', detail: 'Z-Library — pirated books' }],
  ['zlibrary.to',             { score: 0.88, category: 'Piracy', detail: 'Z-Library mirror' }],
  ['booksc.eu',               { score: 0.85, category: 'Piracy', detail: 'BookSC — pirated books' }],

  // --- Dark Web / Onion Proxies ---
  ['tor2web.org',             { score: 0.95, category: 'Dark Web', detail: 'Tor2Web — dark web proxy gateway' }],
  ['onion.ly',                { score: 0.95, category: 'Dark Web', detail: 'Onion.ly — .onion proxy' }],
  ['onion.ws',                { score: 0.95, category: 'Dark Web', detail: '.onion proxy gateway' }],
  ['dark.fail',               { score: 0.92, category: 'Dark Web', detail: 'Dark.fail — dark web link directory' }],
  ['ahmia.fi',                { score: 0.85, category: 'Dark Web', detail: 'Ahmia — Tor hidden service search engine' }],

  // --- Hacking / Cracking / Data Leak Forums ---
  ['exploit.in',              { score: 0.97, category: 'Hacking', detail: 'Exploit.in — stolen credentials marketplace' }],
  ['hackforums.net',          { score: 0.92, category: 'Hacking', detail: 'HackForums — known hacking community' }],
  ['nulled.to',               { score: 0.93, category: 'Hacking', detail: 'Nulled.to — cracked software/credentials' }],
  ['nulled.gg',               { score: 0.93, category: 'Hacking', detail: 'Nulled.gg — cracked software' }],
  ['cracked.to',              { score: 0.93, category: 'Hacking', detail: 'Cracked.to — cracking community' }],
  ['cracked.io',              { score: 0.93, category: 'Hacking', detail: 'Cracked.io — cracking community' }],
  ['zone-h.org',              { score: 0.85, category: 'Hacking', detail: 'Zone-H — defacement archive' }],
  ['leakforums.net',          { score: 0.95, category: 'Data Leak', detail: 'Leak forums — stolen data distribution' }],
  ['raidforums.com',          { score: 0.96, category: 'Data Leak', detail: 'RaidForums — stolen data marketplace' }],
  ['breachforums.com',        { score: 0.97, category: 'Data Leak', detail: 'BreachForums — stolen database marketplace' }],
  ['breachforums.is',         { score: 0.97, category: 'Data Leak', detail: 'BreachForums mirror' }],
  ['breachforums.st',         { score: 0.97, category: 'Data Leak', detail: 'BreachForums mirror' }],

  // --- Fraud / Scam Infrastructure ---
  ['sellix.io',               { score: 0.75, category: 'Fraud', detail: 'Sellix — commonly used for stolen accounts/data sales' }],
  ['shoppy.gg',               { score: 0.72, category: 'Fraud', detail: 'Shoppy — illegal digital goods reseller' }],
  ['selly.gg',                { score: 0.70, category: 'Fraud', detail: 'Selly — fraud-adjacent digital goods reseller' }],

  // --- IP Loggers / Surveillance ---
  ['iplogger.org',            { score: 0.92, category: 'Surveillance', detail: 'IPLogger — IP tracking tool' }],
  ['grabify.link',            { score: 0.92, category: 'Surveillance', detail: 'Grabify — IP grabber link' }],
  ['blasze.tk',               { score: 0.90, category: 'Surveillance', detail: 'Blasze — IP logger' }],
  ['2no.co',                  { score: 0.90, category: 'Surveillance', detail: 'IP grabber service' }],
  ['ps3cfw.com',              { score: 0.88, category: 'Surveillance', detail: 'IP logger' }],
  ['ipgrab.me',               { score: 0.90, category: 'Surveillance', detail: 'IP grab service' }],
  ['yip.su',                  { score: 0.88, category: 'Surveillance', detail: 'IP logger' }],
]);

// ==========================================
// URL EXTRACTION — catches http, www, and bare domains
// ==========================================
function extractUrls(text) {
  const found = new Set();

  // Full URLs with protocol or www
  const urlRegex = /\bhttps?:\/\/[^\s<>"'\]]+|\bwww\.[a-z0-9-]+\.[a-z]{2,}[^\s<>"'\]]*/gi;
  for (let match of (text.match(urlRegex) || [])) {
    let clean = match.replace(/[.,;!?)\]]+$/, '');
    if (!clean.startsWith('http')) clean = 'https://' + clean;
    try {
      const parsed = new URL(clean);
      const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (!SAFE_DOMAINS.has(hostname)) found.add(parsed.href);
    } catch {}
  }

  // Bare domain detection — catches "thepiratebay.org" with no protocol
  const bareDomainRegex = /\b([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.(?:org|com|net|io|to|se|mx|info|tv|cc|onion|ly|ws|gg|ru|me|co|site|online|live|app|win|top|xyz|club|vip|pw|tk|ml|gq|icu|buzz|rs|is|li|si|am|lt|ps|cr|sc|fi|eu|do)(?:\/[^\s<>"'\]]*)?)\b/gi;
  for (let match of (text.match(bareDomainRegex) || [])) {
    let clean = match.replace(/[.,;!?)\]]+$/, '');
    // Skip if already captured as part of a full URL
    if ([...found].some(u => u.toLowerCase().includes(clean.toLowerCase()))) continue;
    try {
      const parsed = new URL('https://' + clean);
      const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (!SAFE_DOMAINS.has(hostname)) found.add(parsed.href);
    } catch {}
  }

  return Array.from(found).slice(0, 15);
}

// ==========================================
// HEURISTICS — keyword and pattern analysis
// ==========================================
function assessHeuristics(text, urls) {
  const signals = [];
  const lower = text.toLowerCase();

  // --- SCAM / PHISHING ---
  if (/(?:bitcoin|usdt|eth\b|crypto|wallet address|airdrop|double your (?:money|crypto)|send .{0,20}(?:btc|eth|usdt))/i.test(lower)) {
    signals.push({ score: 0.75, detail: 'Crypto/financial scam keywords' });
  }
  if (/(?:your password|your otp|one.?time.?pass|cvv number|credit card number|social security|your pin|your ssn)/i.test(lower)) {
    signals.push({ score: 0.82, detail: 'Sensitive credential harvesting' });
  }
  if (/(?:you(?:'ve| have) won|lottery winner|claim your prize|unclaimed inheritance|compensation fund|you are a beneficiary)/i.test(lower)) {
    signals.push({ score: 0.80, detail: 'Lottery/prize scam language' });
  }
  if (/(?:guaranteed (?:profit|return|income)|100% profit|passive income|double your investment|investment opportunity returns)/i.test(lower)) {
    signals.push({ score: 0.72, detail: 'Investment scam language' });
  }
  if (/(?:act now|expires today|last chance|limited time offer|don'?t miss out|respond immediately|urgent action required)/i.test(lower)) {
    signals.push({ score: 0.38, detail: 'Urgency/pressure tactics' });
  }
  if (/(?:verify your account|account (?:suspended|blocked|restricted|terminated)|unusual (?:activity|login|sign.?in) detected)/i.test(lower)) {
    signals.push({ score: 0.60, detail: 'Account suspension phishing' });
  }
  if (/(?:dear (?:customer|valued user|winner|friend)|kindly (?:click|verify|send|provide|forward))/i.test(lower)) {
    signals.push({ score: 0.35, detail: 'Generic scam phrasing' });
  }
  if (/(?:free (?:money|iphone|laptop|gift card|robux|v-bucks)|you (?:have been )?selected|congratulations you)/i.test(lower)) {
    signals.push({ score: 0.50, detail: 'Too-good-to-be-true offer' });
  }
  if (/(?:click (?:here|this link|below) to (?:verify|confirm|claim|unlock|restore|activate))/i.test(lower)) {
    signals.push({ score: 0.62, detail: 'Phishing call-to-action' });
  }
  if (/(?:send me your|share your|provide your|enter your) (?:password|pin|otp|verification code|card details)/i.test(lower)) {
    signals.push({ score: 0.85, detail: 'Direct credential harvesting' });
  }

  // --- PIRACY / ILLEGAL CONTENT ---
  if (/(?:pirate\s?bay|1337x|yts\.(?:mx|lt|am)|rarbg|kickass\s?torrent|nyaa\.si|rutracker|fmovies|123movies|gomovies|putlocker|solarmovie|crackstream)/i.test(lower)) {
    signals.push({ score: 0.92, detail: 'Known piracy site mentioned by name' });
  }
  if (/(?:download (?:free |cracked |pirated )?(?:movies?|series|shows?|software|games?)|watch (?:free|online) (?:movies?|shows?) (?:without|no) (?:paying|subscription)|illegal stream)/i.test(lower)) {
    signals.push({ score: 0.65, detail: 'Piracy/illegal streaming content' });
  }
  if (/(?:\.torrent\b|magnet:\?xt=|magnet:\/\?xt=|torrent (?:file|download|link)|seeders|leechers)/i.test(lower)) {
    signals.push({ score: 0.80, detail: 'Torrent/magnet link detected' });
  }
  if (/(?:cracked (?:software|game|app|version)|warez|nulled (?:script|plugin|theme)|serial key generator|keygen|\.crack\b|crack (?:download|file|version))/i.test(lower)) {
    signals.push({ score: 0.88, detail: 'Cracked/warez software' });
  }
  if (/(?:libgen|sci.?hub|zlibrary|z-lib\.org|bookfi|library genesis)/i.test(lower)) {
    signals.push({ score: 0.88, detail: 'Pirated books/academic papers site' });
  }

  // --- DARK WEB ---
  if (/\.onion\b/i.test(lower)) {
    signals.push({ score: 0.93, detail: '.onion dark web address detected' });
  }
  if (/(?:dark\s?web|darknet|tor\s?browser link|tor\s?network site|hidden\s?service|onion\s?(?:link|site|address|url))/i.test(lower)) {
    signals.push({ score: 0.78, detail: 'Dark web reference' });
  }
  if (/(?:buy (?:drugs?|weed|cocaine|heroin|meth|mdma|lsd|fake (?:id|passport|documents?))|order (?:drugs?|illegal))/i.test(lower)) {
    signals.push({ score: 0.98, detail: 'Drug/illegal goods purchase' });
  }
  if (/(?:hire (?:a )?(?:hacker|hitman|assassin)|ddos (?:for hire|service|attack)|rent (?:a )?botnet|buy (?:malware|ransomware|exploit kit))/i.test(lower)) {
    signals.push({ score: 0.99, detail: 'Criminal service solicitation' });
  }
  if (/(?:stolen (?:credit cards?|cc dumps?|fullz)|cvv\s?shop|carder(?:ing)?|carding (?:forum|site|method)|buy (?:cvv|dumps|fullz))/i.test(lower)) {
    signals.push({ score: 0.99, detail: 'Credit card fraud/carding' });
  }
  if (/(?:money (?:laundering|mule)|transfer (?:dirty|illegal) money|wash (?:the )?money)/i.test(lower)) {
    signals.push({ score: 0.97, detail: 'Money laundering language' });
  }

  // --- HACKING / MALWARE ---
  if (/(?:rat\b|remote\s?access\s?tool|keylogger|password\s?stealer|info\s?stealer|stealc|redline\s?stealer|formgrabber|spyware)/i.test(lower)) {
    signals.push({ score: 0.95, detail: 'Malware tool reference' });
  }
  if (/(?:phishing\s?kit|phish\s?page|grabify|iplogger|ip\s?grab(?:ber)?|ip\s?logger|track your ip)/i.test(lower)) {
    signals.push({ score: 0.90, detail: 'IP logger/phishing kit' });
  }
  if (/(?:nulled\.(?:to|gg)|cracked\.(?:to|io)|hackforums|leakforums|breachforums)/i.test(lower)) {
    signals.push({ score: 0.95, detail: 'Known hacking/cracking forum' });
  }
  if (/(?:leaked (?:database|data|passwords?|accounts?|credentials)|data breach dump|combo\s?list|wordlist\s?download)/i.test(lower)) {
    signals.push({ score: 0.90, detail: 'Stolen/leaked data distribution' });
  }

  // --- URL SIGNALS ---
  if (urls.length > 4) signals.push({ score: 0.35, detail: 'Excessive number of links' });
  if (urls.some(u => /https?:\/\/\d{1,3}(\.\d{1,3}){3}/.test(u))) {
    signals.push({ score: 0.88, detail: 'IP-address URL (no domain name)' });
  }
  if (urls.some(u => { try { return new URL(u).hostname.split('.').length > 4; } catch { return false; } })) {
    signals.push({ score: 0.52, detail: 'Excessive subdomain depth' });
  }
  if (urls.some(u => /\.onion/i.test(u))) {
    signals.push({ score: 0.95, detail: '.onion URL in link' });
  }

  if (!signals.length) return { score: 0, details: [] };

  const sorted = signals.map(s => s.score).sort((a, b) => b - a);
  const base = sorted[0];
  const bonus = sorted.slice(1).reduce((acc, s) => acc + s * 0.18, 0);
  return { score: clamp(base + bonus), details: signals.map(s => s.detail) };
}

// ==========================================
// DOMAIN SCAN — blocklist + pattern heuristics
// ==========================================
function scanDomains(urls) {
  let maxScore = 0;
  const details = [];

  for (const url of urls) {
    let hostname;
    try { hostname = new URL(url).hostname.toLowerCase(); } catch { continue; }

    const domain = hostname.replace(/^www\./, '');
    const domainParts = domain.split('.');
    const apexDomain = domainParts.slice(-2).join('.');

    // Blocklist — check full hostname and apex domain
    for (const candidate of [domain, apexDomain]) {
      const threat = KNOWN_THREAT_DOMAINS.get(candidate);
      if (threat) {
        maxScore = Math.max(maxScore, threat.score);
        details.push(`[${threat.category}] ${threat.detail}`);
      }
    }

    // Cache check for pattern-based analysis
    const cached = domainCache.get(domain);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      maxScore = Math.max(maxScore, cached.score);
      details.push(...cached.details);
      continue;
    }

    let localScore = 0;
    const localDetails = [];

    // .onion address
    if (domain.endsWith('.onion')) {
      localScore = Math.max(localScore, 0.95);
      localDetails.push(`Dark web .onion address: ${domain}`);
    }

    // High-risk TLDs
    if (/\.(xyz|top|click|tk|ml|gq|club|vip|buzz|ws|cc|pw|icu|win|bid|loan|work|date|review|stream|gdn|racing|download|science|party|men|trade|webcam)$/.test(domain)) {
      localScore = Math.max(localScore, 0.52);
      localDetails.push(`High-risk TLD: ${domain}`);
    }

    // Typosquatting
    if (/paypa[l1][^.]*\.|amaz[o0]n[^.]*\.|g[o0]{2}gle[^.]*\.|faceb[o0]{2}k[^.]*\.|micros[o0]ft[^.]*\.|app[l1]e[^.]*\.|inst[a4]gram[^.]*\.|whatsap[^.]*\.|netfl[il1]x[^.]*\./.test(domain)) {
      localScore = Math.max(localScore, 0.93);
      localDetails.push(`Brand typosquatting detected: ${domain}`);
    }

    // Piracy/hacking keywords in domain name
    if (/(?:pirat|torrent|cracked|nulled|warez|keygen|hackforum|leakforum|darkweb|dark-web|onionsite|scihub|libgen|zlibrary|fmovie|123movie|putlock|solarmov|crackstream)/.test(domain)) {
      localScore = Math.max(localScore, 0.90);
      localDetails.push(`Threat keyword in domain name: ${domain}`);
    }

    // URL shorteners
    if (/^(bit\.ly|tinyurl\.com|is\.gd|t\.co|goo\.gl|ow\.ly|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc)$/.test(domain)) {
      localScore = Math.max(localScore, 0.40);
      localDetails.push(`URL shortener — destination hidden: ${domain}`);
    }

    // IP logger domains
    if (/(?:grabify|iplogger|ipgrab|blasze|2no\.co|ps3cfw|yip\.su|ezstat|iptracker|trackip)/.test(domain)) {
      localScore = Math.max(localScore, 0.93);
      localDetails.push(`IP logger/tracker domain: ${domain}`);
    }

    // Long random-looking subdomain
    if (/^[a-z0-9]{12,}\.[a-z0-9-]+\.[a-z]{2,}$/.test(domain)) {
      localScore = Math.max(localScore, 0.45);
      localDetails.push(`Random-looking subdomain pattern: ${domain}`);
    }

    domainCache.set(domain, { score: localScore, details: localDetails, time: Date.now() });
    maxScore = Math.max(maxScore, localScore);
    details.push(...localDetails);
  }

  return { score: maxScore, details };
}

// ==========================================
// LINK CONTENT SCAN — follow redirects, check final destination
// Catches short URLs hiding threat domains + executable downloads
// ==========================================
async function scanLinkContent(urls) {
  if (!urls.length) return { score: 0, details: [] };

  let maxScore = 0;
  const details = [];

  // Scan up to 5 URLs within timeout budget
  await Promise.allSettled(urls.slice(0, 5).map(async (url) => {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)' }
      });

      const finalUrl = res.url || url;
      const finalHostname = new URL(finalUrl).hostname.replace(/^www\./, '').toLowerCase();
      const apexDomain = finalHostname.split('.').slice(-2).join('.');
      const originalHostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();

      // Check if redirect landed on a known threat
      for (const candidate of [finalHostname, apexDomain]) {
        const threat = KNOWN_THREAT_DOMAINS.get(candidate);
        if (threat) {
          maxScore = Math.max(maxScore, threat.score);
          details.push(`Link redirects to [${threat.category}]: ${finalHostname}`);
        }
      }

      // Domain changed on redirect and destination is not safe
      if (finalHostname !== originalHostname && !SAFE_DOMAINS.has(finalHostname)) {
        maxScore = Math.max(maxScore, 0.55);
        details.push(`Suspicious redirect: ${originalHostname} → ${finalHostname}`);
      }

      // Executable/archive content type
      const contentType = res.headers.get('content-type') || '';
      if (/application\/(octet-stream|x-msdownload|x-executable|x-dosexec|zip|x-rar|x-7z|x-bzip)/.test(contentType)) {
        maxScore = Math.max(maxScore, 0.80);
        details.push(`Link serves executable/archive: ${url}`);
      }

    } catch {
      // Unreachable — slightly suspicious
      maxScore = Math.max(maxScore, 0.28);
      details.push(`URL unreachable/timed out: ${url}`);
    }
  }));

  return { score: maxScore, details };
}

// ==========================================
// AI ANALYSIS — full threat category coverage
// ==========================================
async function analyzeWithAI(apiKey, text, urls) {
  const urlList = urls.length > 0
    ? `Domains/URLs found:\n${urls.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
    : 'No URLs detected.';

  const systemPrompt = `You are a strict cybersecurity threat detection engine. Identify ALL harmful, illegal, or dangerous content. Your job is to protect users.

${urlList}

THREAT CATEGORIES (check all):
1. Phishing / credential theft / social engineering
2. Scams: crypto, lottery, investment, romance, tech support fraud
3. PIRACY: torrents, illegal streaming, cracked software, warez, libgen, sci-hub, z-library — score 0.9+
4. Dark web: .onion links, Tor references, darknet markets — score 0.9+
5. Illegal goods: drugs, weapons, fake IDs, stolen credit cards — score 0.95+
6. Malware, RATs, keyloggers, exploit kits, ransomware
7. Data leaks: credential dumps, breachforums, leaked databases
8. IP loggers, tracking links, grabify, surveillance tools
9. Hacking forums: nulled, cracked, hackforums, raidforums
10. Money laundering, fraud infrastructure, carding shops

MANDATORY SCORING FLOORS (non-negotiable):
- Piracy site (thepiratebay, 1337x, yts, fmovies, 123movies, rutracker, libgen, sci-hub) → minimum 0.90
- .onion address or dark web market → minimum 0.92
- Drug/weapon purchase request → minimum 0.97
- Hacking forum (nulled, cracked, breachforums) → minimum 0.93
- IP logger (grabify, iplogger) → minimum 0.90

SAFE (0.0–0.1 ONLY): normal greetings, questions, known safe domains, educational content with no threat

When uncertain → score HIGHER. A missed threat is worse than a false positive.

Respond ONLY with valid JSON (no markdown):
{"score":<0.0-1.0>,"verdict":"<safe|warning|danger>","category":"<threat category or none>","details":["<specific reason>"]}`;

  try {
    const res = await fetch(K2_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: K2_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this for threats:\n\n"${text.slice(0, 1500)}"` }
        ],
        temperature: 0.0,
        max_tokens: 300,
        reasoning: false
      })
    });

    if (!res.ok) return null;

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const cleaned = cleanOutput(raw);
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    if (typeof result.score !== 'number') return null;

    result.score = clamp(result.score);
    result.details = Array.isArray(result.details) ? result.details : [];
    result.verdict = result.verdict || (result.score >= 0.7 ? 'danger' : result.score >= 0.4 ? 'warning' : 'safe');
    result.category = result.category || 'unknown';

    return result;
  } catch {
    return null;
  }
}

// ==========================================
// MAIN ANALYSIS PIPELINE
// ==========================================
async function analyzeText(text, env) {
  const urls = extractUrls(text);

  // Run heuristics, domain scan, and link fetch in parallel
  const [heuristic, domain, linkScan] = await Promise.all([
    Promise.resolve(assessHeuristics(text, urls)),
    Promise.resolve(scanDomains(urls)),
    scanLinkContent(urls)
  ]);

  // Combine local scores — highest wins, others add diminishing bonus
  const scores = [heuristic.score, domain.score, linkScan.score]
    .filter(s => s > 0)
    .sort((a, b) => b - a);

  let localScore = 0;
  if (scores.length >= 1) localScore = scores[0];
  if (scores.length >= 2) localScore = clamp(localScore + scores[1] * 0.22);
  if (scores.length >= 3) localScore = clamp(localScore + scores[2] * 0.10);

  // FAST PATH: Blocklist or heuristic very confident — skip AI, return immediately
  if (domain.score >= 0.88 || heuristic.score >= 0.92) {
    const allDetails = Array.from(new Set([
      ...heuristic.details, ...domain.details, ...linkScan.details
    ])).filter(Boolean);
    return buildResponse(clamp(localScore), allDetails, false, urls.length, null, false);
  }

  // Call AI for ambiguous or medium-risk cases
  let aiResult = null;
  if (env?.K2_API_KEY) {
    aiResult = await analyzeWithAI(env.K2_API_KEY, text, urls).catch(() => null);
  }

  // Final scoring — never let AI suppress a strong local signal
  let finalScore;
  let rateLimitedFallback = false;

  if (aiResult) {
    const either_high = aiResult.score >= 0.75 || localScore >= 0.75;
    if (either_high) {
      finalScore = clamp(Math.max(aiResult.score, localScore));
    } else {
      const blended = aiResult.score * 0.55 + localScore * 0.45;
      finalScore = clamp(Math.max(blended, localScore * 0.90));
    }
  } else {
    // AI unavailable (rate limit or API error) — rely purely on local signals
    // Do NOT blindly pad the score — that causes false positives on safe messages.
    // Instead: trust local score directly, only apply a small boost when there are
    // multiple independent signals (heuristic + domain both firing).
    rateLimitedFallback = true;
    const multipleSignals = [heuristic.score, domain.score, linkScan.score].filter(s => s > 0.1).length >= 2;
    if (localScore >= 0.85) {
      // Strong local evidence — high confidence even without AI
      finalScore = localScore;
    } else if (localScore >= 0.50 && multipleSignals) {
      // Multiple independent signals — moderate bump
      finalScore = clamp(localScore + 0.06);
    } else if (localScore >= 0.30 && multipleSignals) {
      // Weak multi-signal — small bump, stay in warning zone
      finalScore = clamp(localScore + 0.04);
    } else {
      // Single weak signal or nothing — no padding, trust as-is
      finalScore = localScore;
    }
  }

  const allDetails = Array.from(new Set([
    ...heuristic.details, ...domain.details, ...linkScan.details,
    ...(aiResult?.details || [])
  ])).filter(Boolean);

  return buildResponse(finalScore, allDetails, !!aiResult, urls.length, aiResult?.category, rateLimitedFallback);
}

function buildResponse(score, details, aiUsed, scannedLinks, category = null, rateLimited = false) {
  const type = score >= 0.7 ? 'danger' : score >= 0.4 ? 'warning' : 'safe';
  return {
    is_threat: score >= 0.4,
    type,
    category: category || (score >= 0.7 ? 'threat' : score >= 0.4 ? 'suspicious' : 'none'),
    scanned_links: scannedLinks,
    confidence: parseFloat(score.toFixed(2)),
    details,
    ai_used: aiUsed,
    ...(rateLimited && { ai_note: 'AI analysis unavailable (rate limit) — result based on local heuristics only, may be less accurate' })
  };
}

// ==========================================
// ENDPOINTS
// ==========================================
securityRoutes.post('/analyze/text', async (c) => {
  try {
    const { text } = await c.req.json();
    if (!text || typeof text !== 'string') return c.json({ error: 'Missing or invalid text' }, 400);
    if (text.length > 5000) return c.json({ error: 'Text too long (max 5000 chars)' }, 400);

    const result = await analyzeText(text, c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

securityRoutes.get('/health', (c) => {
  const hasKey = !!c.env?.K2_API_KEY;
  return c.json({
    status: hasKey ? 'operational' : 'degraded',
    model: K2_MODEL,
    blocklist_domains: KNOWN_THREAT_DOMAINS.size,
    message: hasKey ? 'All systems operational' : 'K2_API_KEY missing — AI disabled'
  });
});