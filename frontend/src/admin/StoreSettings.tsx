import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import {
  Save, Loader2, Store, Truck, Bell, CreditCard,
  RotateCcw, Star, Shield, AlertTriangle, Settings2, CheckCircle2,
  Sparkles, ArrowRight, X, ChevronDown,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type Tab = 'general' | 'storefront' | 'shipping' | 'payments' | 'notifications' | 'returns' | 'reviews' | 'system';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Store },
  { id: 'storefront', label: 'Storefront', icon: Settings2 },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'system', label: 'System', icon: Shield },
];

/* --- UI Components --- */

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors -mx-4 px-4 sm:mx-0 sm:px-0 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-dark-red/30 focus-visible:ring-offset-2 ${checked ? 'bg-dark-red' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-out ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors -mx-4 px-4 sm:mx-0 sm:px-0 rounded-lg">
      <div>
        <label className="text-sm font-medium text-slate-800 block">{label}</label>
        {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder = '', className = '', ...props }: any) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white transition-shadow ${className}`}
      {...props}
    />
  );
}

function SettingsCard({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 md:p-8 scroll-mt-36">
      <div className="mb-6 pb-4 border-b border-slate-100">
        <h3 className="text-lg font-serif text-dark-red">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      <div className="space-y-0">
        {children}
      </div>
    </section>
  );
}

function SettingsHeader({ isDirty, isSaving, isPrimaryAdmin, onSave }: any) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm -mx-4 sm:mx-0 sm:rounded-t-xl">
      <div>
        <h2 className="text-xl font-serif text-dark-red hidden sm:block">Store Settings</h2>
        <h2 className="text-lg font-serif text-dark-red sm:hidden">Settings</h2>
      </div>
      <div className="flex items-center gap-3">
        {!isPrimaryAdmin && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
            <AlertTriangle size={12} /> View-only
          </span>
        )}
        
        {isPrimaryAdmin && (
          <div className="text-xs font-medium mr-2 hidden sm:block">
            {isSaving ? (
              <span className="text-slate-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Saving...</span>
            ) : isDirty ? (
              <span className="text-amber-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Unsaved changes</span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> All changes saved</span>
            )}
          </div>
        )}

        <button
          onClick={onSave}
          disabled={!isDirty || isSaving || !isPrimaryAdmin}
          className="flex items-center gap-2 px-5 py-2 bg-dark-red text-white text-xs font-sans font-medium uppercase tracking-widest rounded-lg hover:bg-ruby-red disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span className="hidden sm:inline">{isSaving ? 'Saving' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
}

function SettingsSidebar({ tabs, activeSection, onSelect }: any) {
  return (
    <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto no-scrollbar pb-2 md:pb-0">
      {tabs.map((tab: any) => {
        const Icon = tab.icon;
        const isActive = activeSection === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap md:whitespace-normal rounded-lg md:rounded-none md:border-l-2 ${
              isActive
                ? 'bg-red-50/50 text-dark-red md:border-dark-red md:bg-red-50/30'
                : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 md:border-transparent'
            }`}
          >
            <Icon size={16} className={isActive ? 'text-dark-red' : 'text-slate-400'} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ModalBannerAdmin — full WYSIWYG control panel for the LaunchModal popup
───────────────────────────────────────────────────────────────────────────── */

const HEADER_PRESETS = [
  { label: 'Warm Dark',  value: '135deg, #3B1E0A 0%, #5C2D1E 25%, #7C3527 50%, #8B4513 75%, #4A1E0A 100%', swatch: '#5C2D1E' },
  { label: 'Rose',       value: '135deg, #881337 0%, #9F1239 40%, #BE123C 100%',                              swatch: '#9F1239' },
  { label: 'Midnight',   value: '135deg, #0F172A 0%, #1E293B 50%, #312E81 100%',                              swatch: '#1E293B' },
  { label: 'Forest',     value: '135deg, #14532D 0%, #166534 50%, #15803D 100%',                              swatch: '#166534' },
  { label: 'Amber Gold', value: '135deg, #78350F 0%, #92400E 40%, #B45309 100%',                              swatch: '#92400E' },
];
const CTA_PRESETS = [
  { label: 'Amber→Orange', value: '135deg, #FBBF24, #F97316', swatch: '#FBBF24' },
  { label: 'Red→Crimson',  value: '135deg, #9A3412, #7C2D12', swatch: '#9A3412' },
  { label: 'Pink→Rose',    value: '135deg, #EC4899, #BE185D', swatch: '#EC4899' },
  { label: 'Teal→Green',   value: '135deg, #14B8A6, #059669', swatch: '#14B8A6' },
  { label: 'Purple',       value: '135deg, #7C3AED, #6D28D9', swatch: '#7C3AED' },
];

/* Accordion row */
function Accordion({ title, icon, children, defaultOpen = false }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-slate-50/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base leading-none">{icon}</span>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
        </div>
        <ChevronDown
          size={15}
          className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 bg-slate-50/40 space-y-0 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}

/* Colour field: colour picker + hex text input side by side */
function ColorField({ label, value, onChange, description }: {
  label: string; value: string; onChange: (v: string) => void; description?: string;
}) {
  return (
    <Field label={label} description={description}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9A-Fa-f]{6}$/.test(value ?? '') ? value : '#000000'}
          onChange={e => onChange(e.target.value)}
          className="w-9 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer flex-shrink-0 bg-white"
          title="Pick a colour"
        />
        <Input
          value={value ?? ''}
          onChange={onChange}
          placeholder="#000000 or rgba(…)"
        />
      </div>
    </Field>
  );
}

/* Gradient field: text input + preset swatches */
function GradientField({ label, value, onChange, presets, description }: {
  label: string; value: string; onChange: (v: string) => void;
  presets: { label: string; value: string; swatch: string }[];
  description?: string;
}) {
  return (
    <Field label={label} description={description}>
      <Input value={value ?? ''} onChange={onChange} placeholder="135deg, #3B1E0A 0%, #7C3527 100%" />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.value)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-sans font-bold border transition-all ${
              value === p.value
                ? 'border-dark-red bg-red-50 text-dark-red'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0 border border-white/60"
              style={{ background: p.swatch }}
            />
            {p.label}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="px-2 py-1 rounded-lg text-[10px] font-sans text-slate-400 border border-slate-200 hover:text-red-500 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      {value && (
        <div
          className="mt-2 h-5 w-full rounded-md border border-slate-200"
          style={{ background: `linear-gradient(${value})` }}
        />
      )}
    </Field>
  );
}

/* Live Preview — renders the modal visually with all custom styles applied */
function ModalPreview({ m: modal }: { m: any }) {
  const headerGrad = modal.headerBg
    ? `linear-gradient(${modal.headerBg})`
    : 'linear-gradient(135deg, #3B1E0A 0%, #5C2D1E 25%, #7C3527 50%, #4A1E0A 100%)';
  const orb1    = modal.orb1Color    || '#F97316';
  const orb2    = modal.orb2Color    || '#EC4899';
  const badgeBg  = modal.badgeBg     || 'rgba(255,255,255,0.15)';
  const badgeTxt = modal.badgeTextColor || '#FDE68A';
  const titleClr = modal.titleColor  || '#ffffff';
  const descClr  = modal.descriptionColor || 'rgba(255,255,255,0.75)';
  const contentBg = modal.contentBg  || '#ffffff';
  const ctaGrad  = modal.ctaGradient
    ? `linear-gradient(${modal.ctaGradient})`
    : 'linear-gradient(135deg, #FBBF24, #F97316)';
  const ctaTxt   = modal.ctaTextColor || '#2C1208';
  const emojis   = (modal.floatingEmojisEnabled && modal.floatingEmojis?.length)
    ? modal.floatingEmojis.filter(Boolean)
    : [];

  return (
    <div className="relative w-full max-w-xs mx-auto rounded-3xl shadow-2xl overflow-hidden border border-white/20" style={{ background: contentBg }}>
      {/* Close button */}
      <div className="absolute top-2.5 right-2.5 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 text-white shadow-sm">
        <X size={12} />
      </div>
      {/* Header */}
      <div className="relative h-36 w-full flex items-center justify-center overflow-hidden" style={{ background: headerGrad }}>
        <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none" style={{ background: `radial-gradient(circle, ${orb1}60 0%, transparent 70%)` }} />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full blur-2xl pointer-events-none" style={{ background: `radial-gradient(circle, ${orb2}50 0%, transparent 70%)` }} />
        {/* Floating emojis (static in preview) */}
        {emojis.slice(0, 3).map((e: string, i: number) => (
          <span key={i} className="absolute text-lg pointer-events-none select-none opacity-80"
            style={[{top:'10%',left:'8%'},{top:'12%',right:'10%'},{bottom:'18%',left:'10%'}][i] as any}
          >{e}</span>
        ))}
        <div className="relative z-10 text-center px-4">
          {modal.image ? (
            <img
              src={modal.image}
              alt="preview"
              className="h-24 w-auto object-contain mx-auto drop-shadow-xl"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-10 h-14 mx-auto bg-white/15 rounded-lg border border-white/30 flex items-center justify-center">
              <Sparkles className="text-white opacity-60" size={16} />
            </div>
          )}
        </div>
      </div>
      {/* Urgency strip */}
      {(modal.urgencyEnabled || modal.countdownEnabled) && (
        <div className="px-4 py-2 text-[10px] font-semibold text-center" style={{ background: 'rgba(251,191,36,0.15)', color: '#92400E' }}>
          {modal.urgencyEnabled ? modal.urgencyText || '⏰ Limited time offer' : '⏰ 24:00:00'}
        </div>
      )}
      {/* Content */}
      <div className="px-5 py-4 text-center" style={{ background: contentBg }}>
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase mb-2.5" style={{ background: badgeBg, color: badgeTxt }}>
          <Sparkles size={8} />
          {modal.badge || 'Just Launched'}
        </div>
        <h3 className="text-base font-serif leading-tight mb-1.5" style={{ color: titleClr }}>
          {modal.title || 'New Collection'}
        </h3>
        <p className="text-[10px] leading-relaxed mb-4 line-clamp-2" style={{ color: descClr }}>
          {modal.description || 'Discover our latest additions, crafted with rare botanical extracts.'}
        </p>
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold px-4 py-2 rounded-xl shadow-sm" style={{ background: ctaGrad, color: ctaTxt }}>
          {modal.ctaLabel || 'Explore Collection'}
          <ArrowRight size={11} />
        </div>
      </div>
    </div>
  );
}

/**
 * A stored UTC ISO string → the local "YYYY-MM-DDTHH:mm" a datetime-local input shows.
 * Slicing the ISO string displayed the UTC clock time as if it were local, so in IST
 * the countdown target read 5½ hours earlier than what was picked.
 */
function toLocalDateTimeInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Number fields left blank. The number <Input> stores '' when cleared (so typing
 * stays possible); saved like that, Mongoose stores null — a blank free-shipping
 * threshold made `subtotal >= null` true, i.e. free shipping on every order.
 */
function findBlankNumbers(original: any, current: any, prefix = ''): string[] {
  if (!original || typeof original !== 'object' || !current || typeof current !== 'object') return [];
  return Object.keys(original).flatMap(key => {
    const path = prefix ? `${prefix}.${key}` : key;
    const before = original[key];
    const after = current[key];
    if (typeof before === 'number' && (after === '' || after === null)) return [path];
    if (before && typeof before === 'object' && !Array.isArray(before)) return findBlankNumbers(before, after, path);
    return [];
  });
}

/* The main admin panel component */
function ModalBannerAdmin({ s, update }: { s: any; update: (path: string, value: any) => void }) {
  const m = s.launchModal ?? {};
  const lm = (k: string, v: any) => update(`launchModal.${k}`, v);
  const emojis: string[] = Array.isArray(m.floatingEmojis) ? [...m.floatingEmojis] : [];
  while (emojis.length < 5) emojis.push('');
  // Slots keep their position while editing. Filtering out empty slots on every
  // keystroke re-packed the array, so a character typed into a slot after an empty one
  // jumped into the earlier slot and the box being typed in went blank. Empty slots are
  // dropped on save (handleSave) and ignored by the popup (LaunchModal filters them).
  const setEmoji = (i: number, v: string) => {
    const next = [...emojis];
    next[i] = v;
    lm('floatingEmojis', next);
  };

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800">Launch Modal / Popup Banner</h4>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {m.isActive ? '● Active' : '○ Disabled'}
        </span>
      </div>
      <p className="text-xs text-slate-500 pb-1">Configure every detail of the popup shown to first-time visitors. Changes are saved with the rest of your settings.</p>

      {/* ── Section 1: Content & General ── */}
      <Accordion title="Content & General" icon="📝" defaultOpen>
        <Toggle
          checked={!!m.isActive}
          onChange={v => lm('isActive', v)}
          label="Enable Popup"
          description="Shows the modal to visitors after the configured delay"
        />
        <Field label="Badge Text"><Input value={m.badge ?? ''} onChange={(v: string) => lm('badge', v)} placeholder="Just Launched" /></Field>
        <Field label="Headline / Title"><Input value={m.title ?? ''} onChange={(v: string) => lm('title', v)} placeholder="New Collection" /></Field>
        <Field label="Body Copy">
          <textarea
            value={m.description ?? ''}
            onChange={e => lm('description', e.target.value)}
            rows={3}
            placeholder="Describe your offer or announcement…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white resize-none transition-shadow"
          />
        </Field>
        <Field label="CTA Button Label"><Input value={m.ctaLabel ?? ''} onChange={(v: string) => lm('ctaLabel', v)} placeholder="Explore Collection" /></Field>
        <Field label="CTA Button Link"><Input value={m.ctaLink ?? ''} onChange={(v: string) => lm('ctaLink', v)} placeholder="/shop" /></Field>
        <Field label="Image URL" description="Paste any image URL — leave blank to use the sparkle graphic">
          <Input value={m.image ?? ''} onChange={(v: string) => lm('image', v)} placeholder="https://…" />
          {m.image && (
            <img
              src={m.image}
              alt="Preview"
              className="mt-2 h-16 object-contain rounded-lg border border-slate-200 bg-slate-50"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </Field>
        <Field label="Popup Delay (seconds)" description="How long after page load before the popup appears">
          <Input value={m.showDelaySeconds ?? 2.5} onChange={(v: number) => lm('showDelaySeconds', v)} type="number" />
        </Field>
        <Toggle
          checked={!!m.exitIntentTrigger}
          onChange={v => lm('exitIntentTrigger', v)}
          label="Exit-Intent Trigger"
          description="Also show the popup when the user moves their mouse toward the browser close button (desktop only)"
        />
      </Accordion>

      {/* ── Section 2: Colours & Theme ── */}
      <Accordion title="Colours & Theme" icon="🎨">
        <GradientField
          label="Header Background"
          value={m.headerBg ?? ''}
          onChange={v => lm('headerBg', v)}
          presets={HEADER_PRESETS}
          description="CSS gradient string for the top image panel. e.g. 135deg, #3B1E0A 0%, #7C3527 100%"
        />
        <Toggle checked={!!m.headerBgAnimated} onChange={v => lm('headerBgAnimated', v)} label="Animate Header" description="Slowly pulses the gradient for a living background effect" />
        <div className="grid grid-cols-3 gap-3 mt-1">
          <ColorField label="Orb 1 Colour" value={m.orb1Color ?? '#F97316'} onChange={v => lm('orb1Color', v)} />
          <ColorField label="Orb 2 Colour" value={m.orb2Color ?? '#EC4899'} onChange={v => lm('orb2Color', v)} />
          <ColorField label="Orb 3 Colour" description="High intensity only" value={m.orb3Color ?? '#FBBF24'} onChange={v => lm('orb3Color', v)} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <ColorField label="Badge Background" value={m.badgeBg ?? ''} onChange={v => lm('badgeBg', v)} />
          <ColorField label="Badge Text" value={m.badgeTextColor ?? ''} onChange={v => lm('badgeTextColor', v)} />
          <ColorField label="Title Colour" value={m.titleColor ?? '#ffffff'} onChange={v => lm('titleColor', v)} />
          <ColorField label="Description Colour" value={m.descriptionColor ?? ''} onChange={v => lm('descriptionColor', v)} />
          <ColorField label="Content Panel BG" value={m.contentBg ?? '#ffffff'} onChange={v => lm('contentBg', v)} />
          <ColorField label="CTA Text Colour" value={m.ctaTextColor ?? '#2C1208'} onChange={v => lm('ctaTextColor', v)} />
        </div>
        <GradientField
          label="CTA Button Gradient"
          value={m.ctaGradient ?? ''}
          onChange={v => lm('ctaGradient', v)}
          presets={CTA_PRESETS}
          description="Gradient for the CTA button. e.g. 135deg, #FBBF24, #F97316"
        />
        <Toggle checked={!!m.ctaGlow} onChange={v => lm('ctaGlow', v)} label="CTA Glow Ring" description="Pulsing golden glow ring behind the CTA button" />
      </Accordion>

      {/* ── Section 3: Special Effects ── */}
      <Accordion title="Special Effects" icon="✨">
        <Toggle
          checked={!!m.floatingEmojisEnabled}
          onChange={v => lm('floatingEmojisEnabled', v)}
          label="Floating Emojis"
          description="Emojis drift around the header area for a festive feel"
        />
        {m.floatingEmojisEnabled && (
          <Field label="Emojis (up to 5)" description="Type or paste any emoji into each slot">
            <div className="grid grid-cols-5 gap-2">
              {emojis.map((e, i) => (
                <input
                  key={i}
                  type="text"
                  value={e}
                  onChange={ev => setEmoji(i, ev.target.value)}
                  // maxLength counts UTF-16 units: 4 cut multi-part emoji (👩‍🔬, skin
                  // tones) in half. 16 fits any single emoji.
                  maxLength={16}
                  placeholder={['🌸','🍃','✨','🌹','🎀'][i]}
                  className="w-full text-center text-xl px-1 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white"
                />
              ))}
            </div>
          </Field>
        )}
        {m.floatingEmojisEnabled && (
          <Toggle checked={!!m.emojiTrailPhysics} onChange={v => lm('emojiTrailPhysics', v)} label="Emoji Trail Physics" description="Each emoji gets unique speed and rotation so they never look identical" />
        )}
        <Toggle checked={!!m.ctaShimmer} onChange={v => lm('ctaShimmer', v)} label="CTA Shimmer Sweep" description="A light shine glides across the CTA button periodically" />
        <Toggle checked={!!m.ctaParticleBurst} onChange={v => lm('ctaParticleBurst', v)} label="CTA Particle Burst" description="A burst of emoji particles fires from the button on click" />
        <Toggle checked={!!m.closeButtonSpin} onChange={v => lm('closeButtonSpin', v)} label="Close Button Spin" description="The × icon rotates 90° on hover" />
        <Toggle checked={!!m.backdropBlurAnimated} onChange={v => lm('backdropBlurAnimated', v)} label="Animated Backdrop" description="Backdrop eases in smoothly instead of snapping" />
        <Field label="Image Reveal Style" description="How the image animates into view when the modal opens">
          <select
            value={m.imageRevealStyle ?? 'fadeScale'}
            onChange={e => lm('imageRevealStyle', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white"
          >
            <option value="none">None — instant appear</option>
            <option value="fadeScale">Fade + Scale (default)</option>
            <option value="clipWipe">Clip Wipe (left→right reveal)</option>
          </select>
        </Field>
      </Accordion>

      {/* ── Section 4: Motion & Entrance ── */}
      <Accordion title="Motion & Entrance" icon="🎬">
        <Field label="Entrance Style" description="How the modal animates into view">
          <div className="grid grid-cols-2 gap-2">
            {(['spring','zoomFade','slideUp','flip3D'] as const).map(style => (
              <button
                key={style}
                type="button"
                onClick={() => lm('entranceStyle', style)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left ${
                  m.entranceStyle === style
                    ? 'bg-red-50 border-dark-red text-dark-red'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                {style === 'spring'   && '🌀 Spring (default)'}
                {style === 'zoomFade' && '🔍 Zoom Fade'}
                {style === 'slideUp'  && '⬆️ Slide Up'}
                {style === 'flip3D'   && '🔄 3D Flip'}
              </button>
            ))}
          </div>
        </Field>
        <Toggle checked={!!m.parallaxOnMouse} onChange={v => lm('parallaxOnMouse', v)} label="Mouse Parallax Depth" description="Orbs and image shift with cursor position — 3D depth feel (desktop)" />
        <Toggle checked={!!m.staggerContent} onChange={v => lm('staggerContent', v)} label="Stagger Content" description="Badge → title → description → CTA fade up in sequence" />
        <Field label="Effects Intensity" description="Reduces heavy effects on low-end devices">
          <div className="flex gap-2">
            {(['low','medium','high'] as const).map(level => (
              <button
                key={level}
                type="button"
                onClick={() => lm('effectsIntensity', level)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border capitalize transition-all ${
                  m.effectsIntensity === level
                    ? 'bg-red-50 border-dark-red text-dark-red'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                {level === 'low' ? '🔋 Low' : level === 'medium' ? '⚡ Medium' : '🚀 High'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
            Low: no blur, particles, or parallax &nbsp;•&nbsp; Medium: orbs + emojis &nbsp;•&nbsp; High: all effects
          </p>
        </Field>
      </Accordion>

      {/* ── Section 5: Urgency & Countdown ── */}
      <Accordion title="Urgency Strip & Countdown" icon="⏰">
        <Toggle checked={!!m.urgencyEnabled} onChange={v => lm('urgencyEnabled', v)} label="Show Urgency Strip" description="Amber strip between the header and content area" />
        {m.urgencyEnabled && (
          <Field label="Urgency Message">
            <Input value={m.urgencyText ?? ''} onChange={(v: string) => lm('urgencyText', v)} placeholder="⏰ Limited time offer" />
          </Field>
        )}
        <Toggle checked={!!m.countdownEnabled} onChange={v => lm('countdownEnabled', v)} label="Live Countdown Timer" description="Replaces the urgency text with a real ticking HH:MM:SS countdown" />
        {m.countdownEnabled && (
          <>
            <Field label="Countdown Target Date & Time" description="Stored in UTC — visitors see the countdown in their local time">
              <input
                type="datetime-local"
                value={toLocalDateTimeInput(m.countdownTargetDate)}
                onChange={e => lm('countdownTargetDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white"
              />
            </Field>
            <Field label="Expired Text" description="Shown once the countdown reaches zero">
              <Input value={m.countdownExpiredText ?? ''} onChange={(v: string) => lm('countdownExpiredText', v)} placeholder="Offer ended" />
            </Field>
          </>
        )}
      </Accordion>

      {/* ── Section 6: Live Preview ── */}
      <Accordion title="Live Preview" icon="👁️" defaultOpen={false}>
        <div className="pt-2">
          <p className="text-xs text-slate-500 mb-4 text-center">Real-time WYSIWYG preview — updates as you change any setting above.</p>
          <ModalPreview m={m} />
          {!m.isActive && (
            <p className="text-center text-xs text-amber-600 mt-3 flex items-center justify-center gap-1">
              <AlertTriangle size={11} /> Popup is disabled — enable it in the Content section above.
            </p>
          )}
        </div>
      </Accordion>
    </div>
  );
}

/* --- Main Page Component --- */

export default function StoreSettings() {
  const { getAuthHeaders, isPrimaryAdmin } = useApp();
  
  const [originalState, setOriginalState] = useState<any>(null);
  const [formState, setFormState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const [activeSection, setActiveSection] = useState<Tab>('general');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings/`, { headers });
      const data = await res.json();
      if (data.success) {
        setOriginalState(data.data);
        setFormState(JSON.parse(JSON.stringify(data.data)));
      } else {
        toast.error('Failed to load settings');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading settings');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Setup ScrollSpy for Active Section
  useEffect(() => {
    if (isLoading || !formState) return;
    
    const observer = new IntersectionObserver((entries) => {
      // Find the first intersecting entry
      const visible = entries.find(e => e.isIntersecting);
      if (visible) {
        setActiveSection(visible.target.id as Tab);
      }
    }, { 
      root: null,
      rootMargin: '-100px 0px -60% 0px' 
    });

    TABS.forEach(tab => {
      const el = document.getElementById(tab.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isLoading, formState]);

  const isDirty = formState && originalState ? JSON.stringify(formState) !== JSON.stringify(originalState) : false;

  const handleSave = async () => {
    if (!isPrimaryAdmin) {
      toast.error('Only the primary admin can save settings.');
      return;
    }
    const blanks = findBlankNumbers(originalState, formState);
    if (blanks.length > 0) {
      toast.error(`Fill in a number (0 is fine) for: ${blanks.join(', ')}`);
      return;
    }
    const payload = {
      ...formState,
      ...(formState.launchModal && {
        launchModal: {
          ...formState.launchModal,
          floatingEmojis: (formState.launchModal.floatingEmojis || []).filter(Boolean),
        },
      }),
    };
    setSaveStatus('saving');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings/`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Settings saved successfully!');
        setOriginalState(data.data);
        setFormState(JSON.parse(JSON.stringify(data.data)));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        toast.error(data.message || 'Failed to save settings');
        setSaveStatus('error');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings');
      setSaveStatus('error');
    }
  };

  const update = (path: string, value: any) => {
    setFormState((prev: any) => {
      const keys = path.split('.');
      const next = JSON.parse(JSON.stringify(prev));
      let curr = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!curr[keys[i]]) curr[keys[i]] = {};
        curr = curr[keys[i]];
      }
      curr[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id as Tab);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-dark-red" size={28} />
      </div>
    );
  }

  if (!formState) return null;

  const s = formState;

  return (
    <div className="flex flex-col -m-3 sm:-m-6 lg:-m-8">
      <SettingsHeader 
        isDirty={isDirty} 
        isSaving={saveStatus === 'saving'} 
        isPrimaryAdmin={isPrimaryAdmin} 
        onSave={handleSave} 
      />

      <div className="flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 z-10 p-4 md:py-6 overflow-x-auto md:sticky md:top-[72px] self-start">
          <SettingsSidebar tabs={TABS} activeSection={activeSection} onSelect={scrollToSection} />
        </div>

        {/* Content Area */}
        <div ref={scrollContainerRef} className="flex-1 bg-slate-50/50 p-4 sm:p-8">
          <div className="max-w-4xl mx-auto space-y-8 pb-24">
            
            <SettingsCard id="general" title="General Information" description="Basic details about your business and store profile.">
              <Field label="Store Name"><Input value={s.storeName} onChange={(v: string) => update('storeName', v)} /></Field>
              <Field label="Support Email"><Input value={s.supportEmail} onChange={(v: string) => update('supportEmail', v)} type="email" /></Field>
              <Field label="Support Phone"><Input value={s.supportPhone} onChange={(v: string) => update('supportPhone', v)} /></Field>
              <Field label="Store Address" description="Physical address for invoices"><Input value={s.storeAddress} onChange={(v: string) => update('storeAddress', v)} /></Field>
              
              <div className="pt-6 mt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Tax & Invoicing</h4>
                <Field label="Invoice Prefix"><Input value={s.invoicePrefix} onChange={(v: string) => update('invoicePrefix', v)} placeholder="BOD-" /></Field>
                <Field label="GST Number"><Input value={s.gstNumber} onChange={(v: string) => update('gstNumber', v)} /></Field>
                <Field label="PAN Number"><Input value={s.panNumber} onChange={(v: string) => update('panNumber', v)} /></Field>
                <Field label="Tax Rate (%)" description="Applied to applicable orders"><Input value={s.taxRatePercent} onChange={(v: number) => update('taxRatePercent', v)} type="number" /></Field>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Social Links & SEO</h4>
                <Field label="Instagram"><Input value={s.socialLinks?.instagram} onChange={(v: string) => update('socialLinks.instagram', v)} placeholder="https://instagram.com/..." /></Field>
                <Field label="Facebook"><Input value={s.socialLinks?.facebook} onChange={(v: string) => update('socialLinks.facebook', v)} placeholder="https://facebook.com/..." /></Field>
                <Field label="YouTube"><Input value={s.socialLinks?.youtube} onChange={(v: string) => update('socialLinks.youtube', v)} placeholder="https://youtube.com/..." /></Field>
                <Field label="SEO Title"><Input value={s.seoMeta?.title} onChange={(v: string) => update('seoMeta.title', v)} /></Field>
                <Field label="SEO Description"><Input value={s.seoMeta?.description} onChange={(v: string) => update('seoMeta.description', v)} /></Field>
              </div>
            </SettingsCard>

            <SettingsCard id="storefront" title="Storefront Experience" description="Configure announcement bars, modals, and promotional blocks.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Announcement Bar</h4>
                <Toggle checked={!!s.announcementBar?.isActive} onChange={v => update('announcementBar.isActive', v)} label="Show Announcement Bar" description="Displays a dismissible banner at the top of every page" />
                <Field label="Announcement Text"><Input value={s.announcementBar?.text} onChange={(v: string) => update('announcementBar.text', v)} placeholder="Free shipping on orders over ₹999!" /></Field>
                <Field label="Announcement Link" description="Optional — clicking the bar navigates here"><Input value={s.announcementBar?.link} onChange={(v: string) => update('announcementBar.link', v)} placeholder="/shop" /></Field>
              </div>
              {/* ════════════════════════════════════════════════════════════
                  Launch Modal / Popup Banner — full WYSIWYG admin
              ════════════════════════════════════════════════════════════ */}
              <ModalBannerAdmin s={s as any} update={update} />
            </SettingsCard>

            <SettingsCard id="shipping" title="Shipping & Delivery" description="Manage shipping thresholds, costs, and international settings.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Domestic Shipping</h4>
                <Field label="Free Shipping Threshold (₹)" description="Orders above this value get free shipping"><Input value={s.shippingThreshold} onChange={(v: number) => update('shippingThreshold', v)} type="number" /></Field>
                <Field label="Shipping Cost (₹)" description="Flat fee for orders below threshold"><Input value={s.shippingCost} onChange={(v: number) => update('shippingCost', v)} type="number" /></Field>
                <Field label="Avg. Delivery Days"><Input value={s.averageDeliveryDays} onChange={(v: number) => update('averageDeliveryDays', v)} type="number" /></Field>
                <Toggle checked={!!s.showEstimatedDeliveryDate} onChange={v => update('showEstimatedDeliveryDate', v)} label="Show Estimated Delivery Date" description="Show estimated delivery on product and cart pages" />
                <Toggle checked={!!s.temperatureSensitiveWarningEnabled} onChange={v => update('temperatureSensitiveWarningEnabled', v)} label="Temperature Sensitive Warning" description="Show warning for summer heat sensitive products" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">International Shipping</h4>
                <Toggle checked={!!s.internationalShippingEnabled} onChange={v => update('internationalShippingEnabled', v)} label="Enable International Shipping" />
                <Toggle checked={!!s.internationalCheckoutEnabled} onChange={v => update('internationalCheckoutEnabled', v)} label="Enable International Checkout" />
                <Toggle checked={!!s.autoCurrencySwitchingEnabled} onChange={v => update('autoCurrencySwitchingEnabled', v)} label="Auto Currency Switching" description="Automatically switch currency based on visitor's country" />
                <Field label="International Shipping Cost (₹)"><Input value={s.internationalShippingCost} onChange={(v: number) => update('internationalShippingCost', v)} type="number" /></Field>
                <Field label="International Free Shipping Threshold (₹)"><Input value={s.internationalShippingThreshold} onChange={(v: number) => update('internationalShippingThreshold', v)} type="number" /></Field>
              </div>
            </SettingsCard>

            <SettingsCard id="payments" title="Payments" description="Configure Cash on Delivery and payment gateways.">
              <Toggle checked={!!s.codEnabled} onChange={v => update('codEnabled', v)} label="Enable Cash on Delivery" />
              <Field label="COD Extra Charge (₹)" description="Additional fee for COD orders (0 = free)"><Input value={s.codExtraCharge} onChange={(v: number) => update('codExtraCharge', v)} type="number" /></Field>
              <Field label="Minimum Order Value for COD (₹)" description="COD not available below this amount"><Input value={s.minOrderValueForCOD} onChange={(v: number) => update('minOrderValueForCOD', v)} type="number" /></Field>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <Toggle
                  checked={!!s.codInternationalEnabled}
                  onChange={v => update('codInternationalEnabled', v)}
                  label="Enable COD for International Orders"
                  description="Offers Cash on Delivery outside India. Requires 'Enable Cash on Delivery' above to also be on."
                />
                {!!s.codInternationalEnabled && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <span className="text-amber-600 text-sm leading-none mt-0.5">⚠</span>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      International couriers cannot collect cash on delivery. Orders placed
                      this way arrive unpaid, are flagged for manual review, and must be
                      settled before dispatch. Intended for testing.
                    </p>
                  </div>
                )}
              </div>
            </SettingsCard>

            <SettingsCard id="notifications" title="Notifications & Messaging" description="Manage Email and WhatsApp automated triggers.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Master Switches</h4>
                <Toggle checked={!!s.waAllEnabled} onChange={v => update('waAllEnabled', v)} label="WhatsApp Notifications" description="Master switch for all WhatsApp messages" />
                <Toggle checked={!!s.emailAllEnabled} onChange={v => update('emailAllEnabled', v)} label="Email Notifications" description="Master switch for all email communications" />
              </div>
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">WhatsApp Triggers</h4>
                <Toggle checked={!!s.waOrderPlacedEnabled} onChange={v => update('waOrderPlacedEnabled', v)} label="Order Placed" description="Send WhatsApp on order confirmation" />
                <Toggle checked={!!s.waOutForDeliveryEnabled} onChange={v => update('waOutForDeliveryEnabled', v)} label="Out for Delivery" />
                <Toggle checked={!!s.waStaleCartEnabled} onChange={v => update('waStaleCartEnabled', v)} label="Abandoned Cart Recovery" />
                <Toggle checked={!!s.waPaymentFailureEnabled} onChange={v => update('waPaymentFailureEnabled', v)} label="Payment Failure" />
                <Toggle checked={!!s.waTicketRaisedEnabled} onChange={v => update('waTicketRaisedEnabled', v)} label="Support Ticket Raised" />
                <Toggle checked={!!s.waTicketResolvedEnabled} onChange={v => update('waTicketResolvedEnabled', v)} label="Support Ticket Resolved" />
                <Toggle checked={!!s.waTrendingProductsEnabled} onChange={v => update('waTrendingProductsEnabled', v)} label="Trending Products" />
                <Toggle checked={!!s.waReEngagementEnabled} onChange={v => update('waReEngagementEnabled', v)} label="Re-engagement Messages" />
              </div>
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Admin Email Alerts</h4>
                <Toggle checked={!!s.notifyAdminOnOrder} onChange={v => update('notifyAdminOnOrder', v)} label="Notify Admin on New Order" />
                <Field label="Admin Notification Email"><Input value={s.adminNotificationEmail} onChange={(v: string) => update('adminNotificationEmail', v)} type="email" /></Field>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Email Triggers</h4>
                <Toggle checked={!!s.sendOrderConfirmationToCustomer} onChange={v => update('sendOrderConfirmationToCustomer', v)} label="Order Confirmation to Customer" />
                <Toggle checked={!!s.emailReturnApproved} onChange={v => update('emailReturnApproved', v)} label="Return Approved" />
                <Toggle checked={!!s.emailReturnRejected} onChange={v => update('emailReturnRejected', v)} label="Return Rejected" />
                <Toggle checked={!!s.emailTicketRaised} onChange={v => update('emailTicketRaised', v)} label="Support Ticket Created" />
                <Toggle checked={!!s.emailTicketReply} onChange={v => update('emailTicketReply', v)} label="Support Ticket Reply" />
                <Toggle checked={!!s.emailTicketResolved} onChange={v => update('emailTicketResolved', v)} label="Support Ticket Resolved" />
                <Toggle checked={!!s.emailTicketCancelled} onChange={v => update('emailTicketCancelled', v)} label="Support Ticket Cancelled" />
              </div>
            </SettingsCard>

            <SettingsCard id="returns" title="Return Policy" description="Configure return windows and refund methods.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <Field label="Return Window (days)"><Input value={s.returnWindowDays} onChange={(v: number) => update('returnWindowDays', v)} type="number" /></Field>
                <Toggle checked={!!s.allowReturnOpened} onChange={v => update('allowReturnOpened', v)} label="Allow Returns on Opened Products" />
                <Toggle checked={!!s.allowReturnUnopened} onChange={v => update('allowReturnUnopened', v)} label="Allow Returns on Unopened Products" />
                <Toggle checked={!!s.requirePhotoForReturn} onChange={v => update('requirePhotoForReturn', v)} label="Require Photo Evidence for Return" />
              </div>
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Adverse Reactions</h4>
                <Toggle checked={!!s.adverseReactionReturnEnabled} onChange={v => update('adverseReactionReturnEnabled', v)} label="Enable Adverse Reaction Returns" description="Extends return window for allergic reactions" />
                <Field label="Adverse Reaction Return Window (days)"><Input value={s.adverseReactionWindowDays} onChange={(v: number) => update('adverseReactionWindowDays', v)} type="number" /></Field>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Refund Processing</h4>
                <Field label="Default Refund Method">
                  <select
                    value={s.refundMethod}
                    onChange={e => update('refundMethod', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white"
                  >
                    <option value="original">Original Payment Source</option>
                    <option value="both">Let Customer Choose (Original / Replacement)</option>
                  </select>
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard id="reviews" title="Reviews & Personalisation" description="Manage product reviews and user skin profiles.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Review Features</h4>
                <Toggle checked={!!s.reviewSkinTypeTaggingEnabled} onChange={v => update('reviewSkinTypeTaggingEnabled', v)} label="Skin Type Tagging" description="Allow reviewers to tag their skin type" />
                <Toggle checked={!!s.reviewBeforeAfterPhotosEnabled} onChange={v => update('reviewBeforeAfterPhotosEnabled', v)} label="Before & After Photos" description="Allow photo uploads with reviews" />
                <Toggle checked={!!s.reviewVerifiedBadgeEnabled} onChange={v => update('reviewVerifiedBadgeEnabled', v)} label="Verified Purchase Badge" description="Show 'Verified' badge on purchases reviews" />
                <Toggle checked={!!s.reviewModerationEnabled} onChange={v => update('reviewModerationEnabled', v)} label="Review Moderation" description="Reviews require admin approval before appearing" />
              </div>
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Review Incentives</h4>
                <Toggle checked={!!s.reviewIncentiveEnabled} onChange={v => update('reviewIncentiveEnabled', v)} label="Discount for Leaving a Review" description="Automatically send a discount code after review submission" />
                <Field label="Discount Percentage (%)"><Input value={s.reviewIncentiveDiscountPercent} onChange={(v: number) => update('reviewIncentiveDiscountPercent', v)} type="number" /></Field>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Skin Profile & Personalisation</h4>
                <Toggle checked={!!s.skinQuizEnabled} onChange={v => update('skinQuizEnabled', v)} label="Ritual Finder / Skin Quiz" />
                <Toggle checked={!!s.productCompatibilityWarningsEnabled} onChange={v => update('productCompatibilityWarningsEnabled', v)} label="Product Compatibility Warnings" />
                <Toggle checked={!!s.storeSkinProfileOnAccount} onChange={v => update('storeSkinProfileOnAccount', v)} label="Store Skin Profile on Account" />
              </div>
            </SettingsCard>

            <SettingsCard id="system" title="System & Inventory" description="Low-level application settings and maintenance mode.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <div className={`p-4 rounded-lg border mb-4 transition-colors ${s.maintenanceMode ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                  <Toggle
                    checked={!!s.maintenanceMode}
                    onChange={v => update('maintenanceMode', v)}
                    label="Maintenance Mode"
                    description="When enabled, the storefront shows a maintenance page to visitors. Admins can still access via bypass secret."
                  />
                </div>
                <Field label="Maintenance Message" description="Shown to visitors when maintenance mode is on">
                  <textarea
                    value={s.maintenanceMessage || ''}
                    onChange={e => update('maintenanceMessage', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white resize-none"
                    rows={3}
                  />
                </Field>
                <Field label="Bypass Secret" description="Add ?preview=[secret] to URL to bypass maintenance mode">
                  <Input value={s.maintenanceBypassSecret} onChange={(v: string) => update('maintenanceBypassSecret', v)} placeholder="e.g. admin123" />
                </Field>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Inventory</h4>
                <Field label="Low Stock Alert Threshold" description="Products below this quantity trigger low stock warnings">
                  <Input value={s.lowStockThreshold} onChange={(v: number) => update('lowStockThreshold', v)} type="number" />
                </Field>
              </div>
            </SettingsCard>

          </div>
        </div>
      </div>
    </div>
  );
}
