import React from 'react';
import { DiemLogo } from './Icons';

interface Props {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#FAFAF9] font-sans text-stone-900 relative">
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true" style={{
        backgroundImage: 'linear-gradient(to right, rgba(168,162,158,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,162,158,0.08) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 100%)',
      }} />
      <nav className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={onBack}>
          <DiemLogo size={24} />
          <span className="font-semibold text-stone-900 tracking-tight">Diem</span>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-stone-500 hover:text-stone-800 transition-colors font-medium"
        >
          ← Back
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-24">
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
          Legal
        </div>

        <h1 className="text-4xl font-semibold text-stone-900 tracking-tight leading-tight mb-4">
          Privacy Policy
        </h1>
        <p className="text-stone-400 text-sm mb-12">Last updated: April 26, 2026</p>

        <div className="space-y-6">

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <p className="text-stone-500 leading-relaxed text-sm">
              This Privacy Policy describes how diem ("we", "us", or "the app") collects, uses, and protects information when you use the diem iOS app and the diem.ee website (collectively, the "Service"). The Service is operated by diem ("we"), reachable at <a href="mailto:team@diem.ee" className="text-stone-900 underline underline-offset-2">team@diem.ee</a>.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">1. What we collect</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              We collect only what we need to make the Service work.
            </p>
            <p className="text-stone-500 leading-relaxed text-sm">
              <strong className="text-stone-700">Account information.</strong> When you sign up we collect your email address. If you sign in with Apple, we receive an Apple-relayed email and a stable user identifier from Apple.
            </p>
            <p className="text-stone-500 leading-relaxed text-sm">
              <strong className="text-stone-700">Content you save.</strong> Items you save into diem — links you paste, photos you attach, text and notes you type, screenshots, and the metadata fetched for URLs (page title, description, preview image) — are stored in your account.
            </p>
            <p className="text-stone-500 leading-relaxed text-sm">
              <strong className="text-stone-700">Spaces and sharing.</strong> When you create or join a Space, we store the Space's name, the list of members, and which items belong to which Space.
            </p>
            <p className="text-stone-500 leading-relaxed text-sm">
              <strong className="text-stone-700">Subscription state.</strong> If you purchase diem Pro, we store the Apple transaction identifier and the renewal/expiry timestamps reported by Apple. We do not see or store your payment method, card number, or billing address — all payment is handled by Apple.
            </p>
            <p className="text-stone-500 leading-relaxed text-sm">
              <strong className="text-stone-700">Device information for support.</strong> Diagnostic information such as iOS version and app version may be attached to crash reports if you have iOS crash reporting enabled. We do not link this information to your account.
            </p>
            <p className="text-stone-500 leading-relaxed text-sm">
              We do <strong className="text-stone-700">not</strong> collect: location, contacts, calendar, health data, advertising identifiers, or browsing history outside the items you explicitly save.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">2. How we use it</h2>
            <ul className="space-y-2 text-sm text-stone-500">
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span>To provide the Service: store, display, search, and sync your saves across your devices.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span>To enable Spaces: share saves with people you have explicitly invited.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span>To process subscriptions through Apple's StoreKit.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span>To respond to your support requests at team@diem.ee.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span>To diagnose crashes and improve reliability.</span></li>
            </ul>
            <p className="text-stone-500 leading-relaxed text-sm">
              We do not use your content to train machine-learning models. We do not sell, rent, or trade your data. We do not show you ads.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">3. Where it lives</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              Your account and saves are stored on Supabase infrastructure (Supabase Inc., United States). Data is encrypted in transit (TLS) and at rest. Photos and screenshots are stored in Supabase Storage; structured data in Supabase Postgres.
            </p>
            <p className="text-stone-500 leading-relaxed text-sm">
              URL summary generation is performed by a Cloudflare Worker we operate. The worker fetches the URL you saved, extracts metadata, and returns it. The URL is logged transiently for caching and is discarded within 24 hours. The worker does not see your account identifier.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">4. Sharing with other users</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              When you invite someone to a Space, the items in that Space become visible to every member of that Space. Their email and display name become visible to other members. You can remove a member at any time, which immediately revokes their access to items in that Space.
            </p>
            <p className="text-stone-500 leading-relaxed text-sm">
              We do not otherwise share your content with anyone.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">5. Third-party processors</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left py-2 pr-4 font-semibold text-stone-700">Processor</th>
                    <th className="text-left py-2 pr-4 font-semibold text-stone-700">Purpose</th>
                    <th className="text-left py-2 font-semibold text-stone-700">Data shared</th>
                  </tr>
                </thead>
                <tbody className="text-stone-500">
                  <tr className="border-b border-stone-50">
                    <td className="py-2 pr-4">Apple</td>
                    <td className="py-2 pr-4">Sign in with Apple, push notifications, IAP</td>
                    <td className="py-2">Apple ID relay email, transaction ID</td>
                  </tr>
                  <tr className="border-b border-stone-50">
                    <td className="py-2 pr-4">Supabase</td>
                    <td className="py-2 pr-4">Database and file storage</td>
                    <td className="py-2">All account data and saves</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Cloudflare</td>
                    <td className="py-2 pr-4">Edge runtime for URL summarization</td>
                    <td className="py-2">URLs you save (transient)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-stone-500 leading-relaxed text-sm">
              We have data processing agreements with each processor.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">6. Children</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              diem is not directed to children under 13 (or under the equivalent minimum age in your jurisdiction). We do not knowingly collect data from children. If we learn that we have, we delete it.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">7. Your rights</h2>
            <p className="text-stone-500 leading-relaxed text-sm">You can:</p>
            <ul className="space-y-2 text-sm text-stone-500">
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Access and export</strong> your data at any time from Settings → Export.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Delete your account</strong> from Settings → Delete Account. This permanently deletes your saves, your Spaces (where you are the owner), your account record, and all associated files. This action cannot be undone.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Correct</strong> account information from Settings.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Withdraw consent</strong> for processing by deleting your account.</span></li>
            </ul>
            <p className="text-stone-500 leading-relaxed text-sm">
              If you reside in the EU/UK, you have rights under the GDPR including the right to lodge a complaint with your local supervisory authority. Our data controller is diem, contact <a href="mailto:team@diem.ee" className="text-stone-900 underline underline-offset-2">team@diem.ee</a>.
            </p>
            <p className="text-stone-500 leading-relaxed text-sm">
              If you reside in California, you have rights under the CCPA including the right to know what we collect and the right to delete. We do not sell personal information.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">8. Retention</h2>
            <ul className="space-y-2 text-sm text-stone-500">
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Active accounts:</strong> data is kept as long as your account exists.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Deleted accounts:</strong> data is purged within 30 days of deletion request. Backups are rotated within 60 days.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Support emails:</strong> kept for 2 years.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Cloudflare URL cache:</strong> 24 hours.</span></li>
            </ul>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">9. Security</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              We use industry-standard practices: TLS in transit, encryption at rest, least-privilege access for engineers, and 2FA on every administrative account. No system is perfectly secure; if a breach affects you we will notify you within 72 hours of confirmation.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">10. Changes</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              We may update this policy. We will notify you in-app for material changes and update the "Last updated" date above. Continuing to use the Service after a change constitutes acceptance.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">11. Contact</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              <a href="mailto:team@diem.ee" className="text-stone-900 underline underline-offset-2">team@diem.ee</a>
            </p>
          </section>

        </div>
      </main>
    </div>
  );
};
