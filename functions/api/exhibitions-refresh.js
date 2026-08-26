import { json, fail, now } from '../_lib/db.js';

// Curated global amusement / gaming / anime trade shows.
// Refreshed daily: re-validates dates and keeps the calendar current.
const SHOWS = [
  { name: 'GTI Asia Pacific Expo 2026', city: 'Guangzhou', venue: 'Poly World Trade Center', country: 'China', startDate: '2026-03-28', endDate: '2026-03-30', category: 'Amusement', region: 'asia', flag: '🇨🇳', scale: '800+ Exhibitors', description: "Asia's largest amusement and gaming equipment trade show, covering arcade, VR, redemption and FEC solutions.", url: 'https://www.gtishow.com/', featured: 1 },
  { name: 'AAE Asia Amusements & Attractions Expo 2026', city: 'Singapore', venue: 'Singapore Expo', country: 'Singapore', startDate: '2026-04-15', endDate: '2026-04-17', category: 'Amusement', region: 'asia', flag: '🇸🇬', scale: '350+ Exhibitors', description: "Southeast Asia's premier amusement industry platform connecting suppliers and operators across 14 ASEAN markets.", url: '', featured: 0 },
  { name: 'AAMA Annual Conference & Expo 2026', city: 'Las Vegas', venue: 'Bellagio Hotel', country: 'USA', startDate: '2026-06-05', endDate: '2026-06-08', category: 'Conference', region: 'americas', flag: '🇺🇸', scale: '200+ Attendees', description: "Amusement and Music Operators Association flagship event for North American FEC and route operators.", url: '', featured: 0 },
  { name: 'DEAL Expo 2026', city: 'Dubai', venue: 'Dubai World Trade Centre', country: 'UAE', startDate: '2026-07-22', endDate: '2026-07-25', category: 'Amusement', region: 'middleeast', flag: '🇦🇪', scale: '300+ Exhibitors', description: "Middle East and North Africa's leading event for the amusement, leisure and entertainment industry.", url: '', featured: 0 },
  { name: 'EAG International Expo 2026', city: 'London', venue: 'ExCeL London', country: 'UK', startDate: '2026-09-14', endDate: '2026-09-17', category: 'Amusement', region: 'europe', flag: '🇬🇧', scale: '400+ Exhibitors', description: "Europe's leading trade show for the amusement, gaming machines and entertainment industry.", url: '', featured: 1 },
  { name: 'IAAPA Expo Europe 2026', city: 'Barcelona', venue: 'Fira de Barcelona', country: 'Spain', startDate: '2026-10-08', endDate: '2026-10-10', category: 'Attractions', region: 'europe', flag: '🇪🇸', scale: '500+ Exhibitors', description: "IAAPA's European flagship event covering theme parks, water parks, FECs and attractions.", url: '', featured: 0 },
  { name: 'IAAPA Expo 2026', city: 'Orlando', venue: 'Orange County Convention Center', country: 'USA', startDate: '2026-11-18', endDate: '2026-11-21', category: 'Attractions', region: 'americas', flag: '🇺🇸', scale: '1,200+ Exhibitors', description: "The world's largest trade show for the attractions industry.", url: 'https://www.iaapa.org/expo', featured: 1 },
  { name: 'Anime Expo 2026', city: 'Los Angeles', venue: 'Los Angeles Convention Center', country: 'USA', startDate: '2026-07-02', endDate: '2026-07-05', category: 'Anime', region: 'americas', flag: '🇺🇸', scale: '100K+ Visitors', description: "North America's largest anime convention and industry gathering.", url: 'https://www.anime-expo.org/', featured: 0 },
  { name: 'Comiket 108', city: 'Tokyo', venue: 'Tokyo Big Sight', country: 'Japan', startDate: '2026-08-15', endDate: '2026-08-16', category: 'Anime', region: 'asia', flag: '🇯🇵', scale: '500K+ Visitors', description: "The world's largest doujinshi (self-published) anime/manga convention.", url: '', featured: 0 },
  { name: 'China Amusement Expo (CAE) 2026', city: 'Beijing', venue: 'China International Exhibition Center', country: 'China', startDate: '2026-05-20', endDate: '2026-05-22', category: 'Amusement', region: 'asia', flag: '🇨🇳', scale: '600+ Exhibitors', description: "China's national amusement equipment expo covering rides, playground and FEC equipment.", url: '', featured: 0 },
  { name: 'Euro Attractions Show (EAS) 2026', city: 'Barcelona', venue: 'Fira de Barcelona', country: 'Spain', startDate: '2026-10-08', endDate: '2026-10-10', category: 'Attractions', region: 'europe', flag: '🇪🇸', scale: '400+ Exhibitors', description: "Major European attractions industry tradeshow by IAAPA.", url: '', featured: 0 },
  { name: 'Gamescom 2026', city: 'Cologne', venue: 'Koelnmesse', country: 'Germany', startDate: '2026-08-26', endDate: '2026-08-30', category: 'Gaming', region: 'europe', flag: '🇩🇪', scale: '370K+ Visitors', description: "The world's largest gaming event, with strong B2B industry zone.", url: 'https://www.gamescom.global/', featured: 1 },
  { name: 'Dubai Entertainment Amusement Expo 2026', city: 'Dubai', venue: 'Dubai World Trade Centre', country: 'UAE', startDate: '2026-11-03', endDate: '2026-11-05', category: 'Amusement', region: 'middleeast', flag: '🇦🇪', scale: '250+ Exhibitors', description: "Dedicated entertainment and amusement expo for the Gulf region.", url: '', featured: 0 },
  { name: 'Tokyo Game Show 2026', city: 'Chiba', venue: 'Makuhari Messe', country: 'Japan', startDate: '2026-09-24', endDate: '2026-09-27', category: 'Gaming', region: 'asia', flag: '🇯🇵', scale: '200K+ Visitors', description: "Japan's premier game industry trade and consumer show.", url: 'https://tgs.cesa.or.jp/', featured: 0 },
  { name: 'IAAPA Expo Asia 2027', city: 'Shanghai', venue: 'Shanghai New International Expo Centre', country: 'China', startDate: '2027-04-14', endDate: '2027-04-16', category: 'Attractions', region: 'asia', flag: '🇨🇳', scale: '500+ Exhibitors', description: "IAAPA's Asia-Pacific attractions expo.", url: '', featured: 0 },
  { name: 'GTI Asia Pacific Expo 2027', city: 'Guangzhou', venue: 'Poly World Trade Center', country: 'China', startDate: '2027-03-30', endDate: '2027-04-01', category: 'Amusement', region: 'asia', flag: '🇨🇳', scale: '800+ Exhibitors', description: "Next edition of Asia's largest amusement equipment trade show.", url: 'https://www.gtishow.com/', featured: 0 }
];

function statusFor(start, end) {
  const t = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime() + 86400000; // include end day
  if (t > e) return 'ended';
  if (t >= s) return 'ongoing';
  return 'upcoming';
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return fail('Method not allowed', 405);
  const key = new URL(request.url).searchParams.get('key');
  if (!env.TOKEN_SECRET || key !== env.TOKEN_SECRET) return fail('Unauthorized', 401);

  // Refresh from curated list (delete then re-insert keeps it current).
  await env.DB.prepare('DELETE FROM exhibitions').run();
  let added = 0;
  for (const s of SHOWS) {
    const status = statusFor(s.startDate, s.endDate);
    await env.DB.prepare(
      'INSERT INTO exhibitions (name,city,venue,country,startDate,endDate,status,category,region,flag,scale,description,url,featured,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(s.name, s.city, s.venue, s.country, s.startDate, s.endDate, status, s.category, s.region, s.flag, s.scale, s.description, s.url, s.featured ? 1 : 0, now()).run();
    added++;
  }
  return json({ ok: true, added });
}
