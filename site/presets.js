// Form presets for formfit.
//
// How to read an entry
//   kind        photo | signature | thumb | document
//   format      jpg | png
//   px / mm+dpi target size (px, or millimetres converted at `dpi`)
//   dimsRule    'exact'     the form rejects any other pixel size
//               'range'     any size between minPx and maxPx is accepted (px is our target)
//               'suggested' the form states no pixel size; px/mm is a sensible default and we may
//                           step the size down if that is the only way to reach the KB limit
//               'free'      no size at all (e.g. "Under 50 KB"); user picks the crop shape
//   kb          {min,max} in KB (either may be omitted)
//   verified    true  = numbers were read from an OFFICIAL source on `checked`
//               false = numbers come from a third-party summary or are only partly confirmed.
//                       The UI then says: "Check the official notice - requirements change every year."
//   source      where the numbers came from;  officialUrl = where the user should double-check
//   next        id of the preset to offer after this one ("Do the signature next")
//
// Every number below was researched on 2026-10-27. Nothing is guessed: where a form states no
// pixel size, dimsRule is 'suggested' and the note says so.

export const CHECKED = '2026-10-27';

export const GROUPS = [
  { id: 'exams', en: 'Indian exams', hi: 'भारतीय परीक्षाएँ' },
  { id: 'govid', en: 'Government ID', hi: 'सरकारी पहचान पत्र' },
  { id: 'visas', en: 'Visas and travel', hi: 'वीज़ा और यात्रा' },
  { id: 'generic', en: 'Generic', hi: 'सामान्य' },
];

const JEE_MAIN_PDF = 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/10/202610241890224107.pdf';
const NEET_PDF = 'https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/02/202602231394640855.pdf';

export const PRESETS = [
  // ------------------------------------------------------------------ Indian exams
  {
    id: 'jee-main-photo', group: 'exams', name: 'JEE Main - Photograph', kind: 'photo', format: 'jpg',
    mm: { w: 35, h: 45 }, dpi: 300, dimsRule: 'suggested', kb: { min: 10, max: 200 },
    bg: 'White background, face (with ears) about 80% of the frame, no mask.',
    alsoCheck: 'The bulletin gives no pixel size, so formfit uses a standard 3.5 x 4.5 cm passport size. Recent colour photo; edited or filtered photos are not allowed.',
    source: { url: JEE_MAIN_PDF, label: 'JEE (Main) 2027 Information Bulletin, Step 2 (published 24 Oct 2026)' },
    officialUrl: 'https://jeemain.nta.nic.in/', checked: CHECKED, verified: true, next: 'jee-main-sign',
    tags: 'jee nta engineering main',
  },
  {
    id: 'jee-main-sign', group: 'exams', name: 'JEE Main - Signature', kind: 'signature', format: 'jpg',
    mm: { w: 35, h: 15 }, dpi: 300, dimsRule: 'suggested', kb: { min: 10, max: 100 },
    alsoCheck: 'The bulletin says only "clearly legible" and gives no pixel size; formfit defaults to 3.5 x 1.5 cm. Sign on white paper with a blue or black pen.',
    source: { url: JEE_MAIN_PDF, label: 'JEE (Main) 2027 Information Bulletin, Step 2 (published 24 Oct 2026)' },
    officialUrl: 'https://jeemain.nta.nic.in/', checked: CHECKED, verified: true,
    tags: 'jee nta engineering main sign',
  },
  {
    id: 'neet-ug-photo', group: 'exams', name: 'NEET (UG) - Photograph', kind: 'photo', format: 'jpg',
    mm: { w: 35, h: 45 }, dpi: 300, dimsRule: 'suggested', kb: { min: 10, max: 200 },
    bg: 'White background, face (with ears) about 80% of the frame, no mask.',
    alsoCheck: 'The bulletin gives no pixel size; formfit uses 3.5 x 4.5 cm. The photo must be taken after 1 January 2026. Spectacles only if you wear them regularly. Colour or black-and-white are both allowed.',
    source: { url: NEET_PDF, label: 'NEET (UG) 2026 Information Bulletin, Chapter 3, Step 2(d)' },
    officialUrl: 'https://neet.nta.nic.in/', checked: CHECKED, verified: true, next: 'neet-ug-sign',
    tags: 'neet nta medical mbbs ug',
  },
  {
    id: 'neet-ug-sign', group: 'exams', name: 'NEET (UG) - Signature', kind: 'signature', format: 'jpg',
    mm: { w: 35, h: 15 }, dpi: 300, dimsRule: 'suggested', kb: { min: 10, max: 100 },
    alsoCheck: 'No pixel size is given in the bulletin; formfit defaults to 3.5 x 1.5 cm. Older guides quote 4-30 KB: the 2026 bulletin says 10-100 KB.',
    source: { url: NEET_PDF, label: 'NEET (UG) 2026 Information Bulletin, Chapter 3, Step 2(d)' },
    officialUrl: 'https://neet.nta.nic.in/', checked: CHECKED, verified: true, next: 'neet-ug-thumb',
    tags: 'neet nta medical mbbs ug sign',
  },
  {
    id: 'neet-ug-thumb', group: 'exams', name: 'NEET (UG) - Thumb / finger impression', kind: 'thumb', format: 'jpg',
    px: { w: 480, h: 480 }, dpi: 200, dimsRule: 'suggested', kb: { min: 50, max: 200 },
    alsoCheck: 'The bulletin lists 10-200 KB in one place and 50-300 KB in another. formfit uses the overlap (50-200 KB) so either rule passes. Pixel size is not given; formfit defaults to a square 480 x 480 px.',
    source: { url: NEET_PDF, label: 'NEET (UG) 2026 Information Bulletin (two ranges quoted)' },
    officialUrl: 'https://neet.nta.nic.in/', checked: CHECKED, verified: false,
    tags: 'neet nta thumb finger impression',
  },
  {
    id: 'cuet-ug-photo', group: 'exams', name: 'CUET (UG) - Photograph', kind: 'photo', format: 'jpg',
    mm: { w: 35, h: 45 }, dpi: 200, dimsRule: 'suggested', kb: { min: 10, max: 200 },
    bg: 'White background, face (with ears) at least 80% visible, no mask.',
    alsoCheck: 'From a coaching-site summary of the CUET (UG) 2026 bulletin, not the NTA PDF itself. No pixel size is given; formfit uses 3.5 x 4.5 cm.',
    source: { url: 'https://www.pw.live/cuet/exams/how-to-upload-photo-and-signature-on-cuet-form', label: 'Physics Wallah summary of the CUET (UG) 2026 bulletin' },
    officialUrl: 'https://cuet.nta.nic.in/', checked: CHECKED, verified: false, next: 'cuet-ug-sign',
    tags: 'cuet nta university common entrance',
  },
  {
    id: 'cuet-ug-sign', group: 'exams', name: 'CUET (UG) - Signature', kind: 'signature', format: 'jpg',
    mm: { w: 35, h: 15 }, dpi: 200, dimsRule: 'suggested', kb: { min: 10, max: 50 },
    alsoCheck: 'The summary quotes 10 KB minimum in one place and 4 KB in another; formfit uses 10 KB so both pass. No pixel size given.',
    source: { url: 'https://www.pw.live/cuet/exams/how-to-upload-photo-and-signature-on-cuet-form', label: 'Physics Wallah summary of the CUET (UG) 2026 bulletin' },
    officialUrl: 'https://cuet.nta.nic.in/', checked: CHECKED, verified: false,
    tags: 'cuet nta sign',
  },
  {
    id: 'gate-photo', group: 'exams', name: 'GATE 2027 - Photograph', kind: 'photo', format: 'jpg',
    px: { w: 354, h: 455 }, dimsRule: 'range', minPx: { w: 200, h: 260 }, maxPx: { w: 530, h: 690 },
    kb: { min: 5, max: 600 }, dpi: 300,
    bg: 'Plain white background, face about 60-70% of the image, full frontal view.',
    alsoCheck: 'From a coaching-site summary of the IIT Madras GOAPS rules. Width/height ratio must be between 0.66 and 0.89. Photo should be less than 3 months old.',
    source: { url: 'https://www.pw.live/gate/exams/gate-2027-photographs-and-signature-guidelines', label: 'Physics Wallah summary of GATE 2027 GOAPS guidelines (20 Jul 2026)' },
    officialUrl: 'https://gate2027.iitr.ac.in/', checked: CHECKED, verified: false, next: 'gate-sign',
    tags: 'gate iit engineering pg goaps',
  },
  {
    id: 'gate-sign', group: 'exams', name: 'GATE 2027 - Signature', kind: 'signature', format: 'jpg',
    px: { w: 400, h: 120 }, dimsRule: 'range', minPx: { w: 250, h: 80 }, maxPx: { w: 580, h: 180 },
    kb: { min: 3, max: 300 }, dpi: 300,
    alsoCheck: 'Black or dark-blue ink only. Height : width must be between 1:2.75 and 1:3.75. Scanned or digital signatures and signatures in capital letters are rejected.',
    source: { url: 'https://www.pw.live/gate/exams/gate-2027-photographs-and-signature-guidelines', label: 'Physics Wallah summary of GATE 2027 GOAPS guidelines (20 Jul 2026)' },
    officialUrl: 'https://gate2027.iitr.ac.in/', checked: CHECKED, verified: false,
    tags: 'gate iit sign goaps',
  },
  {
    id: 'cat-photo', group: 'exams', name: 'CAT - Photograph', kind: 'photo', format: 'jpg',
    mm: { w: 30, h: 45 }, dpi: 300, dimsRule: 'suggested', kb: { max: 80 },
    bg: 'Coloured passport-size photo.',
    alsoCheck: 'From a Careers360 summary of the CAT 2026 notification (registration closed 22 Sep 2026; keep for reference or for CAT 2027). Only a maximum size (80 KB) is stated; no pixel size.',
    source: { url: 'https://www.careers360.com/mba/articles/cat-2026-photo-signature-specifications', label: 'Careers360 summary of the CAT 2026 notification' },
    officialUrl: 'https://iimcat.ac.in/', checked: CHECKED, verified: false, next: 'cat-sign',
    tags: 'cat iim mba management',
  },
  {
    id: 'cat-sign', group: 'exams', name: 'CAT - Signature', kind: 'signature', format: 'jpg',
    mm: { w: 80, h: 35 }, dpi: 200, dimsRule: 'suggested', kb: { max: 80 },
    alsoCheck: 'Black or blue pen on white paper. Only a maximum size (80 KB) is stated.',
    source: { url: 'https://www.careers360.com/mba/articles/cat-2026-photo-signature-specifications', label: 'Careers360 summary of the CAT 2026 notification' },
    officialUrl: 'https://iimcat.ac.in/', checked: CHECKED, verified: false,
    tags: 'cat iim mba sign',
  },
  {
    id: 'upsc-photo', group: 'exams', name: 'UPSC CSE - Photograph', kind: 'photo', format: 'jpg',
    mm: { w: 35, h: 45 }, dpi: 300, dimsRule: 'suggested', kb: { min: 20, max: 200 },
    bg: 'Colour photo, plain white background, front-facing, face about 75% of the frame.',
    alsoCheck: 'Two coaching sites agree on these limits but neither is the UPSC PDF. The file must be named "photo". No pixel size is stated.',
    source: { url: 'https://www.pw.live/upsc/exams/upsc-photo-and-signature-instructions', label: 'Physics Wallah / Vajiram and Ravi summaries of UPSC guidance (2026)' },
    officialUrl: 'https://upsconline.nic.in/', checked: CHECKED, verified: false, next: 'upsc-sign',
    tags: 'upsc civil services ias cse',
  },
  {
    id: 'upsc-sign', group: 'exams', name: 'UPSC CSE - Signature', kind: 'signature', format: 'jpg',
    mm: { w: 60, h: 40 }, dpi: 300, dimsRule: 'suggested', kb: { min: 20, max: 100 },
    alsoCheck: 'UPSC asks for THREE signatures, one below the other on a single white sheet, in black ink, scanned together as one image. Photograph all three together before using formfit. Pixel size is not stated.',
    source: { url: 'https://www.pw.live/upsc/exams/upsc-photo-and-signature-instructions', label: 'Physics Wallah / Vajiram and Ravi summaries of UPSC guidance (2026)' },
    officialUrl: 'https://upsconline.nic.in/', checked: CHECKED, verified: false,
    tags: 'upsc civil services ias cse sign',
  },
  {
    id: 'ssc-cgl-sign', group: 'exams', name: 'SSC CGL - Signature', kind: 'signature', format: 'jpg',
    mm: { w: 40, h: 20 }, dpi: 300, dimsRule: 'suggested', kb: { min: 10, max: 20 },
    alsoCheck: 'SSC CGL 2026 takes the PHOTOGRAPH live (webcam or phone camera) inside the application, so there is no photo file to prepare. Sources disagree on the signature size (4.0 x 2.0 cm vs 6.0 x 2.0 cm); the KB limit is the same.',
    source: { url: 'https://www.pw.live/ssc/exams/ssc-cgl-signature-upload-rules', label: 'Physics Wallah summaries of SSC CGL 2026 rules' },
    officialUrl: 'https://ssc.gov.in/', checked: CHECKED, verified: false,
    tags: 'ssc cgl staff selection sign',
  },
  {
    id: 'ibps-photo', group: 'exams', name: 'IBPS PO / Clerk - Photograph', kind: 'photo', format: 'jpg',
    px: { w: 200, h: 230 }, dpi: 200, dimsRule: 'suggested', kb: { min: 20, max: 50 },
    bg: 'Plain light background.',
    alsoCheck: 'KB limits from an IBPS CRP PO/MT-XVI (July 2026) summary; the 200 x 230 px size is the long-standing IBPS convention. A live photo may also be required during registration.',
    source: { url: 'https://career.aglasem.com/banking/ibps-po/application', label: 'AglaSem summary of the IBPS PO 2026 notification' },
    officialUrl: 'https://www.ibps.in/', checked: CHECKED, verified: false, next: 'ibps-sign',
    tags: 'ibps bank po clerk rrb so',
  },
  {
    id: 'ibps-sign', group: 'exams', name: 'IBPS PO / Clerk - Signature', kind: 'signature', format: 'jpg',
    px: { w: 140, h: 60 }, dpi: 200, dimsRule: 'suggested', kb: { min: 10, max: 20 },
    alsoCheck: 'Sign with black ink on white paper, NOT in capital letters.',
    source: { url: 'https://career.aglasem.com/banking/ibps-po/application', label: 'AglaSem summary of the IBPS PO 2026 notification' },
    officialUrl: 'https://www.ibps.in/', checked: CHECKED, verified: false, next: 'ibps-thumb',
    tags: 'ibps bank po clerk sign',
  },
  {
    id: 'ibps-thumb', group: 'exams', name: 'IBPS PO / Clerk - Left thumb impression', kind: 'thumb', format: 'jpg',
    px: { w: 240, h: 240 }, dpi: 200, dimsRule: 'suggested', kb: { min: 20, max: 50 },
    alsoCheck: 'Use the left thumb, in black or blue ink on white paper, a clear print.',
    source: { url: 'https://career.aglasem.com/banking/ibps-po/application', label: 'AglaSem summary of the IBPS PO 2026 notification' },
    officialUrl: 'https://www.ibps.in/', checked: CHECKED, verified: false, next: 'ibps-decl',
    tags: 'ibps bank thumb',
  },
  {
    id: 'ibps-decl', group: 'exams', name: 'IBPS PO / Clerk - Handwritten declaration', kind: 'document', ink: true, format: 'jpg',
    px: { w: 800, h: 400 }, dpi: 200, dimsRule: 'suggested', kb: { min: 50, max: 100 },
    alsoCheck: 'Write the exact declaration text IBPS prescribes, by hand, in black ink on white paper. Do not copy the sample in capital letters.',
    source: { url: 'https://career.aglasem.com/banking/ibps-po/application', label: 'AglaSem summary of the IBPS PO 2026 notification' },
    officialUrl: 'https://www.ibps.in/', checked: CHECKED, verified: false,
    tags: 'ibps bank declaration handwritten',
  },
  {
    id: 'sbi-photo', group: 'exams', name: 'SBI PO / Clerk - Photograph', kind: 'photo', format: 'jpg',
    px: { w: 200, h: 230 }, dpi: 200, dimsRule: 'exact', kb: { min: 20, max: 50 },
    bg: 'Plain light background.',
    alsoCheck: 'From a coaching-site summary of the SBI PO 2026 notification (18 Jun 2026). SBI Clerk normally uses the same limits, but check.',
    source: { url: 'https://www.pw.live/banking/exams/sbi-po-apply-online', label: 'Physics Wallah summary of SBI PO 2026 notification' },
    officialUrl: 'https://sbi.bank.in/web/careers/current-openings', checked: CHECKED, verified: false, next: 'sbi-sign',
    tags: 'sbi bank po clerk state bank',
  },
  {
    id: 'sbi-sign', group: 'exams', name: 'SBI PO / Clerk - Signature', kind: 'signature', format: 'jpg',
    px: { w: 140, h: 60 }, dpi: 200, dimsRule: 'exact', kb: { min: 10, max: 20 },
    alsoCheck: 'Not in capital letters.',
    source: { url: 'https://www.pw.live/banking/exams/sbi-po-apply-online', label: 'Physics Wallah summary of SBI PO 2026 notification' },
    officialUrl: 'https://sbi.bank.in/web/careers/current-openings', checked: CHECKED, verified: false, next: 'sbi-thumb',
    tags: 'sbi bank sign',
  },
  {
    id: 'sbi-thumb', group: 'exams', name: 'SBI PO / Clerk - Left thumb impression', kind: 'thumb', format: 'jpg',
    px: { w: 240, h: 240 }, dpi: 200, dpiRequired: true, dimsRule: 'exact', kb: { min: 20, max: 50 },
    alsoCheck: '3 x 3 cm at 200 DPI.',
    source: { url: 'https://www.pw.live/banking/exams/sbi-po-apply-online', label: 'Physics Wallah summary of SBI PO 2026 notification' },
    officialUrl: 'https://sbi.bank.in/web/careers/current-openings', checked: CHECKED, verified: false, next: 'sbi-decl',
    tags: 'sbi bank thumb',
  },
  {
    id: 'sbi-decl', group: 'exams', name: 'SBI PO / Clerk - Handwritten declaration', kind: 'document', ink: true, format: 'jpg',
    px: { w: 800, h: 400 }, dpi: 200, dpiRequired: true, dimsRule: 'exact', kb: { min: 50, max: 100 },
    alsoCheck: '10 x 5 cm at 200 DPI. Written in English, black ink, white paper, not in capital letters.',
    source: { url: 'https://www.pw.live/banking/exams/sbi-po-apply-online', label: 'Physics Wallah summary of SBI PO 2026 notification' },
    officialUrl: 'https://sbi.bank.in/web/careers/current-openings', checked: CHECKED, verified: false,
    tags: 'sbi bank declaration handwritten',
  },
  {
    id: 'rrb-ntpc-photo', group: 'exams', name: 'RRB NTPC - Photograph', kind: 'photo', format: 'jpg',
    mm: { w: 35, h: 45 }, dpi: 300, dimsRule: 'suggested', kb: { min: 20, max: 50 },
    bg: 'Light-coloured background.',
    alsoCheck: 'From a coaching-site summary of CEN 2025. Each RRB notification (CEN) sets its own limits, so confirm against the current CEN.',
    source: { url: 'https://www.pw.live/railway/exams/documents-required-to-apply-for-rrb-ntpc-2025', label: 'Physics Wallah summary of RRB NTPC CEN 2025' },
    officialUrl: 'https://www.rrbcdg.gov.in/', checked: CHECKED, verified: false, next: 'rrb-ntpc-sign',
    tags: 'rrb ntpc railway',
  },
  {
    id: 'rrb-ntpc-sign', group: 'exams', name: 'RRB NTPC - Signature', kind: 'signature', format: 'jpg',
    px: { w: 140, h: 60 }, dpi: 200, dimsRule: 'suggested', kb: { min: 30, max: 49 },
    alsoCheck: 'Black ink on white paper. The summary quotes "minimum 140 x 60" without a unit; formfit treats it as pixels.',
    source: { url: 'https://www.pw.live/railway/exams/documents-required-to-apply-for-rrb-ntpc-2025', label: 'Physics Wallah summary of RRB NTPC CEN 2025' },
    officialUrl: 'https://www.rrbcdg.gov.in/', checked: CHECKED, verified: false,
    tags: 'rrb ntpc railway sign',
  },

  // ------------------------------------------------------------------ Government ID
  {
    id: 'in-passport', group: 'govid', name: 'Indian passport (Passport Seva) - Photograph', kind: 'photo', format: 'jpg',
    px: { w: 630, h: 810 }, dimsRule: 'suggested', kb: { min: 10, max: 250 },
    bg: 'Plain white only (cream and off-white are rejected). Head 36-38 mm of the 45 mm height.',
    alsoCheck: 'From a commercial photo-service page quoting Passport Seva rules effective 16 Feb 2026 (3.5 x 4.5 cm, 630 x 810 px, 10-250 KB). The old 2 x 2 inch format is no longer accepted per that page. Confirm on Passport Seva.',
    source: { url: 'https://photogov.net/documents/in-passport-35x45mm-photo/', label: 'PhotoGov summary of Passport Seva photo rules' },
    officialUrl: 'https://www.passportindia.gov.in/', checked: CHECKED, verified: false,
    tags: 'passport seva mea india',
  },
  {
    id: 'pan-photo', group: 'govid', name: 'PAN card (NSDL / UTIITSL) - Photograph', kind: 'photo', format: 'jpg',
    px: { w: 213, h: 213 }, dpi: 300, dimsRule: 'exact', kb: { min: 10, max: 30 },
    bg: 'Plain white background.',
    alsoCheck: 'Third-party tool pages quote 213 x 213 px, 300 DPI, 10-30 KB; older guides quote "up to 50 KB". formfit uses 10-30 KB so both pass. Confirm on the application portal.',
    source: { url: 'https://onlineresult.in/tools/exam-photo-resizer/pan-card', label: 'onlineresult.in PAN specs table (third party)' },
    officialUrl: 'https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html', checked: CHECKED, verified: false, next: 'pan-sign',
    tags: 'pan income tax nsdl uti',
  },
  {
    id: 'pan-sign', group: 'govid', name: 'PAN card (NSDL / UTIITSL) - Signature', kind: 'signature', format: 'jpg',
    px: { w: 354, h: 157 }, dpi: 200, dimsRule: 'suggested', kb: { min: 10, max: 30 },
    alsoCheck: 'Sources disagree on the signature size (354 x 157 px vs 400 x 200 px). formfit makes 354 x 157; the KB window is the safe overlap. Sign inside a box on white paper.',
    source: { url: 'https://onlineresult.in/tools/exam-photo-resizer/pan-card', label: 'onlineresult.in PAN specs table (third party)' },
    officialUrl: 'https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html', checked: CHECKED, verified: false,
    tags: 'pan income tax sign',
  },
  {
    id: 'aadhaar-doc', group: 'govid', name: 'Aadhaar update - Supporting document', kind: 'document', format: 'jpg',
    dimsRule: 'free', maxSide: 1600, kb: { max: 2000 },
    alsoCheck: 'The UIDAI FAQ says the upload must be under 2 MB in JPEG, PNG or PDF. The FAQ PDF is undated, so check the portal. formfit shrinks the picture; make sure every word is still readable.',
    source: { url: 'https://uidai.gov.in/images/doc_update/en/Commonly_Asked_Questions.pdf', label: 'UIDAI document update FAQ (undated)' },
    officialUrl: 'https://myaadhaar.uidai.gov.in/', checked: CHECKED, verified: true,
    tags: 'aadhaar uidai address document proof',
  },

  // ------------------------------------------------------------------ Visas and travel
  {
    id: 'us-visa', group: 'visas', name: 'US visa - Digital photo (DS-160)', kind: 'photo', format: 'jpg',
    px: { w: 1000, h: 1000 }, dpi: 300, dimsRule: 'range', minPx: { w: 600, h: 600 }, maxPx: { w: 1200, h: 1200 },
    kb: { max: 240 }, maxCompressionRatio: 20, square: true,
    bg: 'Plain white or off-white background, no shadows.',
    alsoCheck: 'Must be square, JPEG, colour (24-bit sRGB). Compression ratio no more than 20:1 - formfit therefore never makes the file smaller than needed for that rule. A printed US photo is 2 x 2 inches with the head 1 to 1 3/8 inches; check the State Department photo page for head size.',
    source: { url: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/digital-image-requirements.html', label: 'travel.state.gov - Digital Image Requirements' },
    officialUrl: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html', checked: CHECKED, verified: true,
    tags: 'usa us visa ds-160 america b1 b2 f1',
  },
  {
    id: 'schengen', group: 'visas', name: 'Schengen visa - Photograph (35 x 45 mm)', kind: 'photo', format: 'jpg',
    mm: { w: 35, h: 45 }, dpi: 300, dimsRule: 'suggested', kb: {},
    bg: 'Plain light grey or white background, head 32-36 mm, neutral expression.',
    alsoCheck: 'The 35 x 45 mm size is the common consulate standard but the EU gives no single digital rule; VFS and each consulate add their own KB and pixel limits. If your portal states them, choose Custom.',
    source: { url: 'https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy_en', label: 'EU visa policy page (does not state photo rules)' },
    officialUrl: 'https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy_en', checked: CHECKED, verified: false,
    tags: 'schengen europe visa vfs germany france',
  },
  {
    id: 'uk-passport', group: 'visas', name: 'UK passport - Online photo (GOV.UK)', kind: 'photo', format: 'jpg',
    px: { w: 800, h: 1000 }, dpi: 300, dimsRule: 'range', minPx: { w: 600, h: 750 }, maxPx: { w: 4000, h: 5000 },
    kb: { min: 50, max: 10240 },
    bg: 'Plain light-coloured background.',
    alsoCheck: 'GOV.UK states a minimum of 600 x 750 px and 50 KB-10 MB for digital photos, and a plain light background. It does not state a file type on that page; JPG is accepted in practice. This is for passports, not UK visa applications (UKVI/VFS have own rules).',
    source: { url: 'https://www.gov.uk/photos-for-passports', label: 'GOV.UK - Photos for passports (digital photo requirements)' },
    officialUrl: 'https://www.gov.uk/photos-for-passports', checked: CHECKED, verified: true,
    tags: 'uk britain passport gov.uk',
  },
  {
    id: 'ca-passport-digital', group: 'visas', name: 'Canada passport - Online renewal photo', kind: 'photo', format: 'jpg',
    px: { w: 1200, h: 1800 }, dpi: 300, dimsRule: 'range', minPx: { w: 1200, h: 1800 }, maxPx: { w: 3000, h: 4500 },
    kb: { min: 200, max: 5120 },
    bg: 'Plain white or light-coloured background.',
    alsoCheck: 'Official digital rules: JPEG, 3:2 portrait, 1200 x 1800 up to 3000 x 4500 px, 200 KB-5 MB, head 45-50% of the photo height, saved straight from the camera (scans are not accepted), taken within 6 months. This is for online passport renewal; IRCC visa photos (35 x 45 mm) have separate rules not checked here.',
    source: { url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html', label: 'Canada.ca - Passport photos' },
    officialUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html', checked: CHECKED, verified: true,
    tags: 'canada passport ircc',
  },
  {
    id: 'au-passport', group: 'visas', name: 'Australia passport - Photo (print size)', kind: 'photo', format: 'jpg',
    mm: { w: 35, h: 45 }, dpi: 300, dimsRule: 'suggested', kb: {},
    bg: 'Plain white or light grey background that contrasts with your face.',
    alsoCheck: 'Australia accepts 35-40 mm wide and 45-50 mm high prints, face (chin to crown) 32-36 mm, taken within 6 months. The official page covers prints only; for online upload sizes see the Department of Home Affairs or your visa portal.',
    source: { url: 'https://www.passports.gov.au/getting-passport-how-it-works/photo-guidelines', label: 'passports.gov.au - Photo guidelines' },
    officialUrl: 'https://www.passports.gov.au/getting-passport-how-it-works/photo-guidelines', checked: CHECKED, verified: true,
    tags: 'australia passport visa',
  },

  // ------------------------------------------------------------------ Generic
  {
    id: 'gen-20kb', group: 'generic', name: 'Under 20 KB', kind: 'photo', format: 'jpg', dimsRule: 'free', maxSide: 800,
    kb: { max: 20 }, alsoCheck: 'Any shape: pick the crop shape in the next steps.', verified: true, checked: CHECKED, generic: true,
    tags: 'small kb limit',
  },
  {
    id: 'gen-50kb', group: 'generic', name: 'Under 50 KB', kind: 'photo', format: 'jpg', dimsRule: 'free', maxSide: 1000,
    kb: { max: 50 }, alsoCheck: 'Any shape: pick the crop shape in the next steps.', verified: true, checked: CHECKED, generic: true,
    tags: 'small kb limit',
  },
  {
    id: 'gen-100kb', group: 'generic', name: 'Under 100 KB', kind: 'photo', format: 'jpg', dimsRule: 'free', maxSide: 1200,
    kb: { max: 100 }, alsoCheck: 'Any shape: pick the crop shape in the next steps.', verified: true, checked: CHECKED, generic: true,
    tags: 'small kb limit',
  },
  {
    id: 'gen-passport', group: 'generic', name: 'Passport photo 35 x 45 mm', kind: 'photo', format: 'jpg',
    mm: { w: 35, h: 45 }, dpi: 300, dimsRule: 'exact', kb: {},
    bg: 'Plain white background.',
    alsoCheck: 'The common international passport-photo size, 413 x 531 px at 300 DPI.', verified: true, checked: CHECKED, generic: true,
    tags: 'passport 35x45 generic',
  },
];

// "Custom" is built at runtime from the user's inputs (see app.js, makeCustomPreset).
export const CUSTOM_ID = 'custom';

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || null;
}
