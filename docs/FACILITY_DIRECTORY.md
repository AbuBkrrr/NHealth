# Nigerian facility directory

N-Health lists Nigeria's health facilities **before** they join, so that:

- **At sign-up:** a hospital, clinic, diagnostic center or pharmacy types its name, picks itself from the list and **claims** it. Its address, state and map position are filled in from the listing.
- **For patients:** they can already find, call and get directions to facilities that are not on N-Health yet. These are marked "Not on N-Health yet" and have an **Invite** button. They appear:
  - in Providers and Facilities
  - as "Other hospitals nearby" during an emergency
  - in the list of NHIA-accredited HMOs on the Insurance screen
- **For admins:** Admin console → **Facility directory** shows what is listed by type and by state, highlights gaps, and lets admins add, correct or hide listings. Edits made by an admin are never overwritten by later data updates.

## What is in it (data loaded 27 Nov 2026)

| Type | Listed | Main source |
|---|---:|---|
| Teaching hospitals | 157 (incl. annexes) | GRID3 / national registry (NHFR) |
| Federal Medical Centres | 68 | GRID3 / NHFR |
| General hospitals | 943 | GRID3 / NHFR |
| Specialist hospitals | 812 | GRID3 / NHFR |
| Other hospitals | 7,540 | GRID3, OpenStreetMap |
| Clinics | 15,777 | GRID3, OpenStreetMap |
| Primary health centres | 23,706 | GRID3 / NPHCDA |
| Health posts | 9,488 | GRID3 |
| Maternity homes | 7,806 | GRID3 |
| Diagnostic centers | 518 | GRID3, OpenStreetMap |
| Blood banks | 20 | National Blood Service Agency, OpenStreetMap |
| Pharmacies | 361 | OpenStreetMap |
| Dental / eye / nursing homes | 162 / 287 / 280 | GRID3 |
| Health insurance (HMOs) | 94 | NHIA list of accredited HMOs |
| Other facilities | 4,072 | GRID3 |
| **Total** | **72,091** | |

Coverage:
- **States:** all 36 states and the FCT.
- **Map location:** 11,685 facilities have no map position yet. They can still be found by name.
- **Teaching hospitals:** checked against 46 well-known federal, state and private teaching hospitals. All were found except Federal Teaching Hospital Katsina and Federal Teaching Hospital Lokoja, which are listed under their former names, "Federal Medical Centre Katsina" and "Federal Medical Centre Lokoja".

## Known gaps (be honest with partners)

- **Pharmacies:** about 360 are listed. Nigeria has several thousand registered community pharmacies and far more patent medicine vendors. The Pharmacists Council of Nigeria's premises register is not published as open data. Pharmacies are added when they sign up, or by admins.
- **Private diagnostic and imaging centers:** about 520 are listed, which is far fewer than exist. Same remedy as for pharmacies.
- **Blood banks:** the 17 National Blood Service Agency centres plus a few others are listed. Most blood banks operate inside hospitals, and those hospitals are listed.
- **Health insurers:** the directory has the 94 NHIA-accredited HMOs. It does not include general insurance companies or the state health insurance agencies.
- **Data quality:** GRID3 describes its data as "non-validated". Some facilities sit in the wrong state, are duplicated, or have closed. Hide or correct them in the Facility directory. A provider's claim is checked during verification: the queue shows the claimed listing next to their documents.

## Sources and licences

| Source | Licence | What we must do |
|---|---|---|
| [GRID3 NGA Health Facilities v4.0](https://data.humdata.org/dataset/grid3-nga-health-facilities-v4-0), built from the Federal Ministry of Health's NHFR, NPHCDA and field surveys | CC BY 4.0 | Credit GRID3 (shown in the app and admin console) |
| [OpenStreetMap health facilities, Nigeria](https://data.humdata.org/dataset/hotosm_nga_health_facilities) (HOT export) | ODbL 1.0 | Show "© OpenStreetMap contributors". On request, share the OpenStreetMap-derived records (the rows with source `OSM` in `apps/backend/data/facilities-ng.ndjson.gz`) under ODbL. |
| [NHIA accredited HMOs](https://www.nhia.gov.ng/hmo/) | Public list | Keep it current |
| [National Blood Service Agency centres](https://nbsc.gov.ng/zonal-state-office/) | Public list | Keep it current |

## Updating the data

1. **Download the latest files** from the links above: the GRID3 `.gpkg`, the HOT OSM `.geojson` zip, and the two web pages saved as `.html`.
2. **Rebuild the data file:**
   ```bash
   python3 -I apps/backend/scripts/data/prepare-facilities.py --grid3 grid3.gpkg --osm health_facilities.geojson --nhia hmo.html --nbsa nbsa.html --out apps/backend/data/facilities-ng.ndjson.gz
   ```
3. **Merge and deploy.** The API loads the new file on start (`scripts/import-facilities.cjs`):
   - It adds new facilities.
   - It refreshes listings that were not claimed or edited by an admin.
   - It deletes nothing.
   - On a server, `nhealth-update` does this automatically.
