import React from 'react';
import { DiemLogo } from './Icons';

interface Props {
  onBack: () => void;
}

export const TermsOfService: React.FC<Props> = ({ onBack }) => {
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
          Terms of Service &amp; Acceptable Use Policy
        </h1>
        <p className="text-stone-400 text-sm mb-12">Effective date: March 12, 2026</p>

        <div className="space-y-6">

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">1. Acceptance of Terms</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              By accessing or using Diem ("the Platform"), you agree to be bound by these Terms of Service and Acceptable Use Policy. If you do not agree, you may not use the Platform. These terms apply to all users, including fans and creators.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">2. Description of Service</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              Diem is a paid direct messaging platform that connects fans with creators. Fans can pay to send messages to creators, and creators can respond within a set time window. Diem facilitates payments between users and takes a platform fee on transactions.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">3. Acceptable Use Policy</h2>
            <p className="text-stone-500 leading-relaxed text-sm mb-3">
              All users must comply with this Acceptable Use Policy. The following content and activities are strictly prohibited on the Platform:
            </p>
            <ul className="space-y-2 text-sm text-stone-500">
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Adult or explicit content:</strong> Content that contains nudity, explicit sexual acts, or adult-only material of any kind is prohibited. Diem is a text-based professional messaging platform and does not support adult content monetization.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Intellectual property infringement:</strong> Sharing, distributing, or monetizing content that infringes on any third party's copyright, trademark, patent, or other proprietary rights is prohibited.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Violent extremism and hate speech:</strong> Content that engages in, encourages, promotes, or celebrates unlawful violence or hatred toward any group based on race, religion, disability, gender, sexual orientation, national origin, or any other characteristic is strictly prohibited.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Illegal content:</strong> Any content that violates applicable laws or regulations, including but not limited to content involving minors, fraud, or illegal services, is prohibited.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Harassment and abuse:</strong> Using the Platform to harass, threaten, stalk, or abuse any individual is prohibited.</span></li>
              <li className="flex gap-2"><span className="text-stone-300 shrink-0">—</span><span><strong className="text-stone-700">Spam and deceptive practices:</strong> Sending unsolicited bulk messages, impersonating others, or engaging in any deceptive practices is prohibited.</span></li>
            </ul>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">4. Content Moderation</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              Diem actively monitors platform activity and employs both automated systems and manual review processes to detect and remove content that violates this Acceptable Use Policy. Violations may result in immediate content removal, account suspension, or permanent termination. Diem reserves the right to report illegal content to relevant authorities. Users may report violations using the in-platform reporting tools.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">5. Payments and Refunds</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              All payments are processed securely through Stripe. Fans purchase credits to send messages. If a creator does not respond within the agreed time window, the fan's credits are automatically refunded. Platform fees are non-refundable once a transaction is completed. Creators receive payouts to their connected Stripe account, which are then automatically transferred to their linked bank account.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">6. Account Responsibilities</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              You are responsible for maintaining the confidentiality of your account credentials. You must be at least 18 years old to use the Platform. You agree to provide accurate information during registration and to keep your account information up to date. Diem reserves the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">7. Intellectual Property</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              Users retain ownership of the content they create on the Platform. By submitting content, you grant Diem a limited, non-exclusive license to display and transmit the content for the purpose of operating the Platform. Diem's branding, design, and technology are proprietary and may not be used without permission.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">8. Disclaimers and Limitation of Liability</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              The Platform is provided "as is" without warranties of any kind. Diem is not liable for any indirect, incidental, or consequential damages arising from your use of the Platform. Diem does not guarantee uninterrupted or error-free service.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">9. Changes to These Terms</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              Diem reserves the right to update these Terms of Service at any time. Users will be notified of significant changes. Continued use of the Platform after changes are posted constitutes acceptance of the revised terms.
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-stone-100 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">10. Contact</h2>
            <p className="text-stone-500 leading-relaxed text-sm">
              For questions about these Terms or to report a violation, please contact us at <a href="mailto:support@diem.ee" className="text-stone-900 underline underline-offset-2">support@diem.ee</a>.
            </p>
          </section>

        </div>
      </main>
    </div>
  );
};
