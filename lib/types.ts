export type TenantId = 'rose-and-stem' | 'petal-atelier' | 'tulip-house';
export type CatalogOverride = {as_of:string;products:Record<string,{price?:number;in_stock?:boolean;stock_qty?:number}>;zones:Record<string,{same_day?:boolean}>};
export type Verdict = 'yes' | 'no' | 'partial' | 'needs_details';
export type Requirements = {
  flower: 'rose' | 'tulip' | null;
  color: 'red' | 'pink' | 'white' | null;
  zone: string | null;
  deadline_local: string | null;
  delivery_date: 'today' | 'tomorrow' | null;
  budget: number | null;
  stems_min: number | null;
  note: string | null;
  language: 'en';
};
export type Product = {
  sku: string; name: string; flower: 'rose' | 'tulip'; color: 'red' | 'pink' | 'white';
  stems: number; price: number; in_stock: boolean; stock_qty: number;
  card_note: { available: boolean; max_chars: number; fee: number };
  substitutes: string[]; image: string; description: string;
};
export type DeliveryZone = {
  zone: string; label: string; same_day: boolean; cutoff_local?: string;
  next_day_from: string; fee: number; eta_text: string;
};
export type Tenant = {
  id: TenantId; name: string; tagline: string; role: 'yes' | 'no' | 'partial'; currency: 'TRY';
  timezone: string; locale: string; brand: { primary: string; accent: string };
  catalog: { as_of: string; products: Product[]; delivery_zones: DeliveryZone[]; returns: string; reviews: { verified_count: number; avg: number } };
  policy: { same_price_for_everyone: true; negotiation: false; session_ttl_minutes: number; quote_ttl_minutes: number; max_questions_per_session: number; menu: {id: string; label: string; fee: number}[] };
};
export type Fact = { fact_ref: string; label: string; value: string | number | boolean };
export type Match = {
  sku: string; name: string; image: string; price: number; currency: 'TRY'; in_stock: boolean;
  zone: string | null; delivery_fee: number | null; total: number | null;
  same_day: boolean; deadline_met: boolean; eta_text: string; kind: 'exact' | 'alternative';
  eligible: boolean; reasons: string[];
};
export type Selection = { verdict: Verdict; matches: Match[]; alternatives: Match[]; facts: Fact[]; frames: {id: string; text: string; fact_refs: string[]}[]; question: string | null; reasons: string[] };
export type Quote = { id: string; sku: string; zone: string; addons: string[]; product_price: number; delivery_fee: number; addon_total: number; total: number; currency: 'TRY'; eta_text: string; issued_at: string; expires_at: string; catalog_as_of: string; same_price_for_everyone: true; eligible: boolean; reasons: string[]; revised?: boolean; previous_total?: number };
export type AssistantIdentity = {label: 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'unknown'; confidence: 'proxy_user_agent' | 'unknown'};
export type ModelUsage = {calls:number;input_tokens:number;output_tokens:number;cost_usd:number|null};
export type Mode = { extraction: 'model' | 'rules'; composition: 'model' | 'template'; referee: 'model_and_rules' | 'rules'; models: {extractor?: string; composer?: string; judge?: string}; fallback_reason?: string; usage?:ModelUsage };
export type RefereeResult = { verdict: 'pass' | 'filtered'; checked: number; dropped: {text: string; reason: string; fact_refs: string[]}[]; mode: 'model_and_rules' | 'rules'; synthetic?: boolean };
export type Session = { h: string; tenant: TenantId; created_at: number; expires_at: number; questions: number; requirements: Requirements; shown: string[]; quote?: Quote; note: string | null; turns: {at: string; summary: string; answer: string; answer_hash: string}[]; assistant: AssistantIdentity };
export type NextLink = { rel: 'continue' | 'transcript' | 'evidence' | 'quote' | 'checkout' | 'discovery'; label: string; url: string; method: 'GET' };
export type AskEnvelope = {
  protocol: 'askagent'; version: '0.1'; kind: 'discovery' | 'answer' | 'transcript' | 'evidence' | 'quote' | 'checkout' | 'error';
  tenant: {id: TenantId; name: string}; scenario: {demo: true; clock: string; timezone: string; catalog_as_of: string};
  h?: string; session?: {h: string; expires_at: string}; status?: Verdict;
  answer: { title: string; bullets: string[]; question: string | null };
  requirements?: Requirements; matches?: Match[]; alternatives?: Match[]; facts?: Fact[];
  quote?: Quote; transcript?: Session['turns']; capabilities?: string[];
  mode?: Mode; referee?: RefereeResult; next: NextLink[]; error?: {code: string; message: string};
};
export type AuditLog = { id: string; ts: string; tenant: TenantId; route: string; session_hash?: string; assistant: AssistantIdentity; skus: string[]; status?: Verdict; referee?: RefereeResult; ms: number; mode?: Mode; synthetic?: boolean;usage?:ModelUsage };
export type PanelData = { totalCalls: number; questions: number; handoffs: number; orders: number; quotes: number; blockedClaims: number; averageMs: number; p95Ms: number; modelCalls: number; ruleCalls: number; totalCostUsd:number|null; callsWithReportedCost:number; tenants: {id: TenantId; name: string; calls: number; questions: number; handoffs: number; orders: number}[]; assistants: {label: string; calls: number; confidence: string}[]; recent: AuditLog[]; refereeEvents: AuditLog[]; storage: 'd1' | 'redis' | 'local_file'; scenarioClock: string; syntheticEvents: number };
