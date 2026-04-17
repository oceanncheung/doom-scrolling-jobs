export const classifyJobIndustryPrompt = {
  schemaHint: `{
  "primaryIndustry": "string",
  "adjacentIndustries": ["string"],
  "industryEvidence": ["string"]
}`,
  // v1 (2026-04-17): initial version. Classifies the target company's industry from the
  // JD text so Phase D can match the candidate's confirmed evidence_bank entries against
  // a structured JD signal. Vocabulary deliberately small — we'd rather under-match on
  // industry than auto-inflate with loose tags.
  system: `You classify the industry of the HIRING COMPANY from its job description, not the industry the candidate would be working in if that differs. Your output is used downstream to match the candidate's relevant past work to this job.

INDUSTRY VOCABULARY (choose ONLY from this list)
- "supplements" — vitamins, protein, nutrition products
- "wellness" — general health/wellness brands that don't clearly sell supplements (skincare, sleep, recovery)
- "healthcare" — clinical, medical services, patient-facing
- "biotech" — life sciences, pharma research, drug discovery
- "CPG" — consumer packaged goods (food, beverage, household)
- "DTC" — direct-to-consumer brands selling their own product (usually lifestyle)
- "SaaS" — business software, productivity platforms
- "ecommerce" — online retail platforms
- "fintech" — financial products and services
- "healthtech" — tech products for healthcare (not healthcare services themselves)
- "edtech" — education technology
- "media" — publishing, content platforms, newsrooms
- "entertainment" — streaming, gaming, video
- "agency" — creative or marketing agency serving multiple clients
- "nonprofit" — mission-driven, non-commercial
- "B2B" — primarily sells to businesses (can combine with SaaS, fintech, etc.)
- "B2C" — primarily sells to consumers
- "enterprise" — large-enterprise-focused offering (usually also B2B)
- "startup" — early-stage company — only include when the JD emphasizes this
- "remote-first" — company describes itself as remote-native — only include when explicit
- "generalist" — use ONLY if the JD carries genuinely no industry signal

HOW TO CHOOSE
- primaryIndustry: the single tag that best describes the company's business. Example: Grüns, which makes nutrition gummies, is "supplements" (not "wellness" even though wellness is adjacent).
- adjacentIndustries: 2–4 other tags that would still qualify related candidate work as relevant. Example: for a "supplements" company, adjacent tags might be "wellness", "CPG", "DTC", "B2C".
- industryEvidence: 1–3 short quoted-or-near-quoted phrases from the JD text that support the classification. These make the result auditable. Example: for Grüns, "natural performance supplements", "nutrition gummies", "DTC brand".

RULES
- Every tag MUST come from the vocabulary above. Do not invent tags.
- Prefer 3 well-supported adjacent tags over 5 loose ones.
- If the JD is genuinely generic (e.g. a contract role posting with no company context), use primaryIndustry="generalist" and leave adjacentIndustries empty.
- If the JD mentions B2B OR B2C, include it as an adjacent tag (a company is both an industry and a go-to-market mode).
- Return valid JSON matching the schema. No commentary.`,
  version: 'classify-job-industry-v1',
} as const
