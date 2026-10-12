'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, X } from 'lucide-react';
import { DEMO_QUESTION } from '@/lib/demo';

export const DEFAULT_ASK = `${DEMO_QUESTION} Compare all three shops and give me the prepared order link for the option that meets my requirements.`;

function publicOrigin(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname) ? url.origin : null;
  } catch { return null; }
}

export function makeChatGPTPrompt(origin: string, tenant?: string, ask = DEFAULT_ASK) {
  const url = tenant ? `${origin}/t/${tenant}/askagent?format=html` : `${origin}/askagent?format=html`;
  return `${ask}\n\nUse the merchant agents on this site to complete the request: ${url}\n\nFirst open the link and read its AskAgent instructions. Ask through the GET question links using format=html. If an agent is processing, follow its returned status links until the completed LLM answer arrives. Then follow its continuation links, preserving the conversation handle. Check prices, stock, and delivery against the site’s evidence and quote links. Use the agents' actual replies; if a request fails, report that rather than inferring an answer from storefront pages. Explain which requirements are met and give me the prepared product page to review. Do not place an order.`;
}

export function ChatGPTLaunch({ siteOrigin, tenant, label = 'Try in ChatGPT', ask, compact = false }: { siteOrigin?: string; tenant?: string; label?: string; ask?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]:not([aria-disabled="true"]),textarea,input') || []);
    focusable()[0]?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [open]);
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const origin = publicOrigin(browserOrigin) || publicOrigin(siteOrigin) || siteOrigin?.replace(/\/$/, '') || browserOrigin;
  const isPublic = Boolean(publicOrigin(origin));
  const prompt = makeChatGPTPrompt(origin || 'http://localhost:3000', tenant, ask);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setCopyError(false);
    } catch {
      promptRef.current?.focus();
      promptRef.current?.select();
      let successful = false;
      try { successful = document.execCommand('copy'); } catch { /* The selected prompt remains available for manual copy. */ }
      setCopied(successful);
      setCopyError(!successful);
    }
  }

  return <>
    <button type="button" className={`button button-dark ${compact ? 'button-small' : ''}`} onClick={() => setOpen(true)}>{label} <ArrowUpRight size={18} aria-hidden="true" /></button>
    {open ? <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="launch-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="launch-title">
        <button className="icon-button dialog-close" type="button" aria-label="Close prompt" onClick={() => setOpen(false)}><X size={20} /></button>
        <h2 id="launch-title">Your assistant takes it from here.</h2>
        <p>Give ChatGPT this request. The shops answer from their own catalogs and delivery rules.</p>
        {!isPublic ? <p className="notice">ChatGPT needs a public HTTPS URL to reach the website agents. Open the deployed site to test this scenario.</p> : null}
        <textarea className="prompt-preview" ref={promptRef} aria-label="Prompt for ChatGPT" value={prompt} readOnly rows={8} />
        <div className="dialog-actions">
          <button className="button button-outline" type="button" onClick={copy}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Prompt copied' : 'Copy prompt'}</button>
          <a className={`button button-dark ${!isPublic ? 'button-disabled' : ''}`} href={isPublic ? `https://chatgpt.com/?q=${encodeURIComponent(prompt)}` : undefined} aria-disabled={!isPublic} target="_blank" rel="noopener noreferrer">Open ChatGPT <ArrowUpRight size={17} /></a>
        </div>
        <p className="small muted" role="status">{copyError ? 'Clipboard access unavailable. Select and copy the text above.' : copied ? 'Copied. You can paste this into your ChatGPT conversation.' : 'ChatGPT browsing availability depends on your account. The protocol instructions are on every shop page.'}</p>
      </section>
    </div> : null}
  </>;
}
