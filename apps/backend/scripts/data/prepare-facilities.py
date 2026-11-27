#!/usr/bin/env python3
"""Builds apps/backend/data/facilities-ng.ndjson.gz: Nigerian health facilities that are not (yet) on N-Health.

Sources (download them first, see docs/FACILITY_DIRECTORY.md):
  --grid3  GRID3 NGA Health Facilities v4.0 (.gpkg)            CC BY 4.0      https://data.humdata.org/dataset/grid3-nga-health-facilities-v4-0
  --osm    HOT OSM Nigeria health facilities (.geojson)       ODbL 1.0       https://data.humdata.org/dataset/hotosm_nga_health_facilities
  --nhia   NHIA accredited HMOs page (saved .html)            public list    https://www.nhia.gov.ng/hmo/
  --nbsa   NBSA zonal & state centres page (saved .html)      public list    https://nbsc.gov.ng/zonal-state-office/

Run:  python3 -I prepare-facilities.py --grid3 g.gpkg --osm h.geojson --nhia hmo.html --nbsa nbsa.html --out ../../data/facilities-ng.ndjson.gz
Only standard-library Python is used.
"""
import argparse, collections, gzip, html, json, math, re, sqlite3, struct

STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara']
_SK = {re.sub(r'[^a-z]', '', s.lower()): s for s in STATES}


def state_of(v):
    if not v:
        return None
    k = re.sub(r'[^a-z]', '', str(v).lower())
    if k.startswith('fct') or 'abuja' in k or 'federalcapital' in k:
        return 'FCT'
    if k == 'nassarawa':
        return 'Nasarawa'
    return _SK.get(k)


def clean(v, n=200):
    if v is None:
        return None
    v = re.sub(r'\s+', ' ', str(v)).strip()
    return v[:n] or None


def title(v):
    v = clean(v)
    if not v:
        return None
    return v if not v.isupper() else v.title()


KW = [
    ('BLOOD_BANK', r'\bblood\s*(bank|transfusion|service|centre|center)\b'),
    ('TEACHING_HOSPITAL', r'\bteaching\s*hosp'),
    ('FEDERAL_MEDICAL_CENTRE', r'\bfederal\s+medical\s+cent'),
    ('DIAGNOSTIC', r'\b(diagnostic|laborator|lab\b|imaging|radiolog|x-?ray|scan\b|scans\b|ultrasound|mri\b|ct\s+scan|pathology)'),
    ('PHARMACY', r'\b(pharmacy|pharmaceutical|chemist|patent\s+medicine)'),
    ('MATERNITY', r'\bmaternity\b'),
    ('EYE', r'\b(eye|optical|ophthalm|optometr)'),
    ('DENTAL', r'\bdental\b'),
]


def by_keyword(name):
    n = (name or '').lower()
    if re.search(r'school of|college of|nursing school', n):
        return None
    for cat, rx in KW:
        if re.search(rx, n):
            return cat
    return None


GRID3_TYPE = {
    'Teaching/Tertiary Hospital': 'TEACHING_HOSPITAL', 'Federal Medical Center': 'FEDERAL_MEDICAL_CENTRE',
    'General Hospital': 'GENERAL_HOSPITAL', 'Specialist Hospital': 'SPECIALIST_HOSPITAL', 'Hospital': 'HOSPITAL',
    'Cottage Hospital': 'HOSPITAL', 'Medical Center': 'HOSPITAL', 'Eye Hospital': 'EYE', 'Dental Hospital': 'DENTAL',
    'Clinic': 'CLINIC', 'Primary Health Clinic': 'CLINIC', 'Specialist Clinic': 'CLINIC', 'Eye Clinic': 'EYE', 'Dental Clinic': 'DENTAL',
    'Primary Health Center': 'PRIMARY_HEALTH_CENTRE', 'Health Center': 'PRIMARY_HEALTH_CENTRE', 'Health Post': 'HEALTH_POST',
    'Maternity Home': 'MATERNITY', 'Diagnostic / Laboratory Center': 'DIAGNOSTIC', 'Nursing / Convalescent Home': 'NURSING_HOME',
    'Outreach Center': 'HEALTH_POST',
}
# Keyword can refine these generic types (a "Clinic" named "... Diagnostic Centre" is a diagnostic centre).
REFINABLE = {None, 'HOSPITAL', 'CLINIC', 'PRIMARY_HEALTH_CENTRE', 'HEALTH_POST', 'SPECIALIST_HOSPITAL', 'GENERAL_HOSPITAL'}


def grid3(path):
    c = sqlite3.connect(path)
    t = [r[0] for r in c.execute("select table_name from gpkg_contents where data_type='features'")][0]
    cols = [r[1] for r in c.execute(f'pragma table_info("{t}")')]
    out = []
    for row in c.execute(f'select * from "{t}"'):
        r = dict(zip(cols, row))
        if r.get('functional') == 'Closed':
            continue
        name = title(r.get('facility_name'))
        if not name:
            continue
        cat = GRID3_TYPE.get(r.get('facility_type') or '')
        kw = by_keyword(name)
        if kw and (cat in REFINABLE or kw in ('TEACHING_HOSPITAL', 'FEDERAL_MEDICAL_CENTRE', 'BLOOD_BANK')):
            cat = kw
        if not cat:
            lvl = (r.get('facility_level') or '').lower()
            cat = 'HOSPITAL' if lvl in ('secondary', 'tertiary') else 'CLINIC' if lvl == 'primary' else 'OTHER'
        lat, lng = r.get('latitude'), r.get('longitude')
        out.append({
            'source': 'GRID3', 'sourceId': r['unique_id'], 'name': name, 'category': cat,
            'level': clean(r.get('facility_level')) or None, 'ownership': clean(r.get('facility_ownership')) or None,
            'ownershipType': clean(r.get('facility_ownership_type')) or None,
            'state': state_of(r.get('state_standard')), 'lga': clean(r.get('lga_standard')), 'ward': clean(r.get('ward_standard')),
            'address': clean(r.get('settlement_name')), 'lat': round(lat, 6) if lat else None, 'lng': round(lng, 6) if lng else None,
            'functional': clean(r.get('functional')), 'nhfrCode': clean(r.get('nhfr_facility_code')) or None,
        })
    return out


OSM_CAT = {('pharmacy', None): 'PHARMACY', ('pharmacy', 'pharmacy'): 'PHARMACY', (None, 'laboratory'): 'DIAGNOSTIC',
           ('dentist', 'dentist'): 'DENTAL', (None, 'blood_bank'): 'BLOOD_BANK', (None, 'blood_donation'): 'BLOOD_BANK',
           (None, 'optometrist'): 'EYE'}


def osm(path):
    d = json.load(open(path, encoding='utf-8'))
    out = []
    for f in d['features']:
        p = f['properties']
        name = title(p.get('name') or p.get('name_en') or p.get('name_latin'))
        if not name:
            continue
        a, h = p.get('amenity'), p.get('healthcare')
        cat = OSM_CAT.get((a, h)) or OSM_CAT.get((None, h)) or OSM_CAT.get((a, None))
        if not cat:
            cat = 'HOSPITAL' if a == 'hospital' or h == 'hospital' else 'CLINIC' if a in ('clinic', 'doctors', 'health_post') or h in ('clinic', 'doctor', 'centre', 'primary') else None
        kw = by_keyword(name)
        if kw and cat in REFINABLE:
            cat = kw
        if not cat:
            continue
        g = f.get('geometry') or {}
        lng = lat = None
        if g.get('type') == 'Point':
            lng, lat = g['coordinates'][:2]
        elif g.get('type') in ('Polygon', 'MultiPolygon'):
            ring = g['coordinates'][0] if g['type'] == 'Polygon' else g['coordinates'][0][0]
            lng = sum(x[0] for x in ring) / len(ring); lat = sum(x[1] for x in ring) / len(ring)
        out.append({
            'source': 'OSM', 'sourceId': p.get('id'), 'name': name, 'category': cat, 'state': state_of(p.get('adm1_name')),
            'lga': clean(p.get('adm2_name')), 'address': clean(p.get('addr_full') or p.get('addr_city')),
            'ownership': {'public': 'Public', 'private': 'Private', 'government': 'Public'}.get((p.get('operator_type') or '').lower()),
            'lat': round(lat, 6) if lat else None, 'lng': round(lng, 6) if lng else None,
        })
    return out


def text_lines(path):
    s = open(path, encoding='utf-8', errors='ignore').read()
    s = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
    return s


def nhia(path):
    s = text_lines(path)
    out = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S):
        cells = [html.unescape(re.sub('<[^>]+>', ' ', c)) for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)]
        links = re.findall(r'href="(https?://[^"]+)"', row)
        if len(cells) < 7 or not cells[0].strip().isdigit():
            continue
        name = title(cells[1]); addr = clean(cells[4].replace('?', ' '))
        phones = re.sub(r'\bO(?=\d)', '0', cells[6])  # the page sometimes types the letter O for 0
        st = next((x for x in STATES if addr and re.search(r'\b' + re.escape(x) + r'\b', addr, re.I)), None)
        if not st and addr and re.search(r'abuja|wuse|garki|maitama|gwarinpa|jabi|utako|asokoro', addr, re.I):
            st = 'FCT'
        out.append({'source': 'NHIA', 'sourceId': 'HMO-' + cells[2].strip(), 'name': name, 'category': 'HMO', 'state': st,
                    'address': addr, 'email': clean(cells[5].split()[0] if cells[5].split() else None),
                    'phone': clean(', '.join(re.findall(r'\+?\d[\d ]{8,14}\d', phones)[:3])) or None,
                    'website': next((l for l in links if 'nhia.gov.ng' not in l), None), 'ownership': 'Private'})
    return out


def nbsa(path):
    s = html.unescape(re.sub(r'<[^>]+>', '\n', text_lines(path)))
    lines = [l.strip() for l in s.split('\n') if l.strip()]
    out = []
    i = 0
    while i < len(lines):
        l = lines[i]
        if l.startswith('NBSA ') and ('Centre' in l or 'Center' in l):
            block = []
            j = i + 1
            while j < len(lines) and not lines[j].startswith(':::') and not lines[j].startswith('NBSA '):
                block.append(lines[j]); j += 1
            email = next((b for b in block if '@' in b), None)
            addr = ', '.join(b for b in block if '@' not in b and not re.match(r'(Zonal|State|Centre|Ag\.|Acting|\()', b))
            st = next((x for x in STATES if re.search(r'\b' + re.escape(x) + r'\b', addr + ' ' + l, re.I)), None)
            city_state = {'Owerri': 'Imo', 'Ibadan': 'Oyo', 'Jos': 'Plateau', 'Kaduna': 'Kaduna', 'Benin': 'Edo', 'Maiduguri': 'Borno', 'Port Harcourt': 'Rivers', 'Abeokuta': 'Ogun', 'Lokoja': 'Kogi', 'Nangere': 'Yobe', 'Katsina': 'Katsina', 'Ado-Ekiti': 'Ekiti', 'Enugu': 'Enugu', 'Jalingo': 'Taraba', 'Calabar': 'Cross River', 'Sokoto': 'Sokoto', 'Abuja': 'FCT'}
            if not st:
                st = next((v for k, v in city_state.items() if k.lower() in (l + ' ' + addr).lower()), None)
            out.append({'source': 'NBSA', 'sourceId': re.sub(r'[^A-Z0-9]+', '-', l.upper()).strip('-')[:60], 'name': 'National Blood Service Agency - ' + re.sub(r'^NBSA\s+', '', l).replace('(State Centre)', '').strip(),
                        'category': 'BLOOD_BANK', 'state': st, 'address': clean(addr, 300), 'email': email, 'ownership': 'Public', 'ownershipType': 'Federal Government'})
            i = j
        else:
            i += 1
    return out


def norm_tokens(n):
    n = re.sub(r'[^a-z0-9 ]', ' ', (n or '').lower())
    stop = {'the', 'of', 'and', 'hospital', 'clinic', 'centre', 'center', 'health', 'medical', 'primary', 'phc', 'ltd', 'limited', 'nig', 'nigeria'}
    return {t for t in n.split() if t not in stop and len(t) > 1}


def group(cat):
    return 'CARE' if cat in ('HOSPITAL', 'GENERAL_HOSPITAL', 'SPECIALIST_HOSPITAL', 'TEACHING_HOSPITAL', 'FEDERAL_MEDICAL_CENTRE', 'CLINIC', 'PRIMARY_HEALTH_CENTRE', 'HEALTH_POST', 'MATERNITY', 'NURSING_HOME', 'OTHER') else cat


def dedupe_osm(grid, osm_rows):
    """Keep an OSM facility only if GRID3 has nothing with a similar name within 300 m (or the same name in the same LGA)."""
    cell = lambda lat, lng: (int(lat * 200), int(lng * 200))  # ~550 m cells
    idx = collections.defaultdict(list)
    by_name = collections.defaultdict(set)
    for g in grid:
        if g['lat']:
            idx[cell(g['lat'], g['lng'])].append(g)
        by_name[(g['name'].lower(), g.get('state'))].add(g['sourceId'])
    kept = []
    for o in osm_rows:
        if (o['name'].lower(), o.get('state')) in by_name:
            continue
        dup = False
        if o['lat']:
            cx, cy = cell(o['lat'], o['lng']); tok = norm_tokens(o['name'])
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for g in idx.get((cx + dx, cy + dy), []):
                        d = math.hypot((g['lat'] - o['lat']) * 111, (g['lng'] - o['lng']) * 111 * math.cos(math.radians(o['lat'])))
                        if group(g['category']) != group(o['category']):
                            continue  # a pharmacy next to a clinic is a different place
                        gt = norm_tokens(g['name'])
                        similar = len(tok & gt) / max(1, min(len(tok), len(gt))) >= 0.5 if tok and gt else d < 0.08
                        if d < 0.3 and similar:
                            dup = True; break
                    if dup: break
                if dup: break
        if not dup:
            kept.append(o)
    return kept


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--grid3'); ap.add_argument('--osm'); ap.add_argument('--nhia'); ap.add_argument('--nbsa')
    ap.add_argument('--out', required=True); ap.add_argument('--summary')
    a = ap.parse_args()
    g = grid3(a.grid3) if a.grid3 else []
    # GRID3 itself has a few exact duplicates (same name, same place): keep one.
    seen = set(); g2 = []
    for r in g:
        k = (r['name'].lower(), r['lat'] and round(r['lat'], 3), r['lng'] and round(r['lng'], 3), r.get('lga'))
        if k in seen: continue
        seen.add(k); g2.append(r)
    o = dedupe_osm(g2, osm(a.osm)) if a.osm else []
    rows = g2 + o + (nhia(a.nhia) if a.nhia else []) + (nbsa(a.nbsa) if a.nbsa else [])
    rows = [{k: v for k, v in r.items() if v not in (None, '')} for r in rows]
    with gzip.open(a.out, 'wt', encoding='utf-8', compresslevel=9) as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False, separators=(',', ':')) + '\n')
    summary = {'total': len(rows), 'bySource': collections.Counter(r['source'] for r in rows), 'byCategory': collections.Counter(r['category'] for r in rows),
               'withoutState': sum(1 for r in rows if not r.get('state')), 'withoutCoordinates': sum(1 for r in rows if 'lat' not in r)}
    print(json.dumps(summary, indent=1))
    if a.summary:
        json.dump(summary, open(a.summary, 'w'), indent=1)


if __name__ == '__main__':
    main()
