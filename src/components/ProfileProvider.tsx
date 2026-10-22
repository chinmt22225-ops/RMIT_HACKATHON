"use client";

import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMarginAuth } from "@/app/providers";
import { X } from "lucide-react";

const ProfileContext = createContext({ displayName: "", edit: () => {} });
export const useProfile = () => useContext(ProfileContext);

export default function ProfileProvider({ children }: { children: ReactNode }) {
  const { authenticated, secureFetch, getValueFromToken } = useMarginAuth();
  const subject = authenticated ? String(getValueFromToken("sub") || "") : "";
  const [displayName, setDisplayName] = useState("");
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dismissKey = `margin-profile-dismissed:${subject}`;

  useEffect(() => {
    let active = true;
    setOpen(false); setDisplayName(""); setValue(""); setError("");
    if (subject) {
      secureFetch(`${location.origin}/api/profile`).then(async (response) => {
        if (!response.ok) return;
        const profile = await response.json();
        if (!active) return;
        setDisplayName(profile.displayName); setValue(profile.displayName);
        let dismissed = false;
        try { dismissed = localStorage.getItem(dismissKey) === "yes"; } catch {}
        if (!profile.displayName && !dismissed) setOpen(true);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [subject]);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(dismissKey, "yes"); } catch {}
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await secureFetch(`${location.origin}/api/profile`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: value }),
      });
      const profile = await response.json();
      if (!response.ok) throw new Error(profile.error || "Could not save your display name.");
      setDisplayName(profile.displayName); dismiss();
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }

  return <ProfileContext.Provider value={{ displayName, edit: () => { setValue(displayName); setError(""); setOpen(true); } }}>
    {children}
    {open && authenticated && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) dismiss(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button className="modal-close icon-button" title="Skip display name" onClick={dismiss} disabled={saving}><X size={19} /></button>
        <div className="eyebrow">WELCOME TO YOUR WORKSPACE</div>
        <h2 id="profile-title">What should we call you?</h2>
        <p>A display name makes this space feel like yours. It’s optional, and you can change it in Settings.</p>
        <form onSubmit={save}>
          <label>Display name<input autoFocus value={value} maxLength={60} autoComplete="nickname" placeholder="Your name or a nickname" onChange={(event) => setValue(event.target.value)} /></label>
          {error && <p className="error-box" role="alert">{error}</p>}
          <div className="detail-actions"><button type="button" className="button button-light" onClick={dismiss} disabled={saving}>Not now</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save name"}</button></div>
        </form>
      </section>
    </div>}
  </ProfileContext.Provider>;
}
