/**
 * Lightweight inline SVG illustrations used by the templates (no external image host needed,
 * crisp at any size, and they render inside embeds on any domain).
 */
const uri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;

/** Analytics dashboard mockup: used in hero sections. */
export const DASHBOARD = uri(`
<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800' viewBox='0 0 1200 800'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#eef2ff'/><stop offset='1' stop-color='#e0f2fe'/></linearGradient>
    <linearGradient id='area' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#6366f1' stop-opacity='.35'/><stop offset='1' stop-color='#6366f1' stop-opacity='0'/></linearGradient>
    <linearGradient id='brand' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#4f46e5'/><stop offset='1' stop-color='#06b6d4'/></linearGradient>
    <filter id='sh' x='-10%' y='-10%' width='120%' height='130%'><feDropShadow dx='0' dy='18' stdDeviation='22' flood-color='#1e1b4b' flood-opacity='.18'/></filter>
  </defs>
  <rect width='1200' height='800' rx='40' fill='url(#bg)'/>
  <g filter='url(#sh)'>
    <rect x='80' y='80' width='1040' height='640' rx='24' fill='#fff'/>
  </g>
  <rect x='80' y='80' width='1040' height='56' rx='24' fill='#f8fafc'/>
  <rect x='80' y='112' width='1040' height='24' fill='#f8fafc'/>
  <circle cx='118' cy='108' r='8' fill='#f87171'/><circle cx='146' cy='108' r='8' fill='#fbbf24'/><circle cx='174' cy='108' r='8' fill='#34d399'/>
  <rect x='420' y='96' width='360' height='24' rx='12' fill='#e2e8f0'/>
  <rect x='80' y='136' width='200' height='584' fill='#f8fafc'/>
  <rect x='104' y='164' width='120' height='18' rx='9' fill='url(#brand)'/>
  <g fill='#e2e8f0'><rect x='104' y='214' width='140' height='14' rx='7'/><rect x='104' y='250' width='110' height='14' rx='7'/><rect x='104' y='286' width='130' height='14' rx='7'/><rect x='104' y='322' width='100' height='14' rx='7'/></g>
  <g font-family='Arial, sans-serif'>
    <rect x='312' y='168' width='240' height='120' rx='16' fill='#eef2ff'/>
    <text x='336' y='208' font-size='18' fill='#64748b'>Leads this month</text>
    <text x='336' y='256' font-size='40' font-weight='700' fill='#1e1b4b'>2,481</text>
    <rect x='576' y='168' width='240' height='120' rx='16' fill='#ecfeff'/>
    <text x='600' y='208' font-size='18' fill='#64748b'>Conversion rate</text>
    <text x='600' y='256' font-size='40' font-weight='700' fill='#0e7490'>12.4%</text>
    <rect x='840' y='168' width='248' height='120' rx='16' fill='#fef3c7'/>
    <text x='864' y='208' font-size='18' fill='#64748b'>Revenue</text>
    <text x='864' y='256' font-size='40' font-weight='700' fill='#92400e'>$48.2k</text>
  </g>
  <rect x='312' y='312' width='504' height='376' rx='16' fill='#fff' stroke='#e2e8f0' stroke-width='2'/>
  <g stroke='#f1f5f9' stroke-width='2'><line x1='336' y1='420' x2='792' y2='420'/><line x1='336' y1='500' x2='792' y2='500'/><line x1='336' y1='580' x2='792' y2='580'/></g>
  <path d='M336 620 C400 600 430 540 480 548 S560 470 610 480 S690 400 730 410 S770 360 792 350 L792 660 L336 660 Z' fill='url(#area)'/>
  <path d='M336 620 C400 600 430 540 480 548 S560 470 610 480 S690 400 730 410 S770 360 792 350' fill='none' stroke='#4f46e5' stroke-width='6' stroke-linecap='round'/>
  <circle cx='730' cy='410' r='10' fill='#fff' stroke='#4f46e5' stroke-width='5'/>
  <rect x='840' y='312' width='248' height='376' rx='16' fill='#fff' stroke='#e2e8f0' stroke-width='2'/>
  <g fill='url(#brand)'><rect x='872' y='540' width='32' height='120' rx='8'/><rect x='920' y='480' width='32' height='180' rx='8'/><rect x='968' y='420' width='32' height='240' rx='8'/><rect x='1016' y='380' width='32' height='280' rx='8'/></g>
  <g filter='url(#sh)'>
    <rect x='620' y='600' width='300' height='92' rx='18' fill='#fff'/>
  </g>
  <circle cx='666' cy='646' r='24' fill='url(#brand)'/>
  <path d='M656 646 l7 7 l13 -14' fill='none' stroke='#fff' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>
  <g font-family='Arial, sans-serif'><text x='704' y='640' font-size='19' font-weight='700' fill='#1e1b4b'>New lead captured</text><text x='704' y='668' font-size='16' fill='#64748b'>Added to CRM · just now</text></g>
</svg>`);

/** Funnel steps diagram: used next to the "How it works" tabs. */
export const FUNNEL = uri(`
<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='760' viewBox='0 0 1000 760'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f5f3ff'/><stop offset='1' stop-color='#ecfeff'/></linearGradient>
    <linearGradient id='b' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#4f46e5'/><stop offset='1' stop-color='#06b6d4'/></linearGradient>
    <filter id='sh' x='-10%' y='-20%' width='120%' height='160%'><feDropShadow dx='0' dy='12' stdDeviation='16' flood-color='#1e1b4b' flood-opacity='.15'/></filter>
  </defs>
  <rect width='1000' height='760' rx='36' fill='url(#bg)'/>
  <g font-family='Arial, sans-serif'>
    <g filter='url(#sh)'><rect x='120' y='90' width='760' height='140' rx='22' fill='#fff'/></g>
    <rect x='150' y='124' width='72' height='72' rx='18' fill='#eef2ff'/><text x='186' y='172' font-size='34' text-anchor='middle' fill='#4f46e5'>1</text>
    <text x='250' y='152' font-size='26' font-weight='700' fill='#1e1b4b'>Landing page</text><text x='250' y='186' font-size='19' fill='#64748b'>10,240 visitors</text>
    <rect x='620' y='150' width='220' height='18' rx='9' fill='#e2e8f0'/><rect x='620' y='150' width='220' height='18' rx='9' fill='url(#b)'/>
    <path d='M500 236 v40' stroke='#a5b4fc' stroke-width='6' stroke-linecap='round'/><path d='M486 266 l14 16 l14 -16' fill='none' stroke='#a5b4fc' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/>
    <g filter='url(#sh)'><rect x='170' y='300' width='660' height='140' rx='22' fill='#fff'/></g>
    <rect x='200' y='334' width='72' height='72' rx='18' fill='#ecfeff'/><text x='236' y='382' font-size='34' text-anchor='middle' fill='#0891b2'>2</text>
    <text x='300' y='362' font-size='26' font-weight='700' fill='#1e1b4b'>Opt-in form</text><text x='300' y='396' font-size='19' fill='#64748b'>2,481 leads · 24%</text>
    <rect x='600' y='360' width='190' height='18' rx='9' fill='#e2e8f0'/><rect x='600' y='360' width='120' height='18' rx='9' fill='url(#b)'/>
    <path d='M500 446 v40' stroke='#a5b4fc' stroke-width='6' stroke-linecap='round'/><path d='M486 476 l14 16 l14 -16' fill='none' stroke='#a5b4fc' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/>
    <g filter='url(#sh)'><rect x='220' y='510' width='560' height='140' rx='22' fill='#fff'/></g>
    <rect x='250' y='544' width='72' height='72' rx='18' fill='#fef3c7'/><text x='286' y='592' font-size='34' text-anchor='middle' fill='#b45309'>3</text>
    <text x='350' y='572' font-size='26' font-weight='700' fill='#1e1b4b'>Booked call</text><text x='350' y='606' font-size='19' fill='#64748b'>612 calls · 25%</text>
    <rect x='590' y='570' width='150' height='18' rx='9' fill='#e2e8f0'/><rect x='590' y='570' width='60' height='18' rx='9' fill='url(#b)'/>
  </g>
</svg>`);
