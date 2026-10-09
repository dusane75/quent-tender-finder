import { APP_NAME } from "@/lib/constants";

export const metadata = { title: `Privacy notice — ${APP_NAME}` };

export default function Privacy() {
  return (
    <div className="wrap narrow stack" style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: 32 }}>Privacy notice</h1>
      <p className="muted">Written for India’s Digital Personal Data Protection Act, 2023. Last updated 9 October 2026.</p>
      <div className="card stack">
        <h3>What we collect</h3>
        <p>Your email; your business name, contact person, phone and address; the work you do, districts and tender size; and details you choose to add for eligibility checks (experience, turnover, registrations, GSTIN, PAN, Udyam number and which documents you hold). We also store tenders you upload.</p>
        <h3>Why we use it</h3>
        <p>Only to find tenders that match you, explain them, check your eligibility, prepare your bid papers and send the alerts and reminders you asked for. We do not sell your data or use it for advertising.</p>
        <h3>Who processes it</h3>
        <p>Your data is stored with Supabase (database) and the app runs on Vercel. Tender text and the relevant profile details are sent to Google’s Gemini AI service to write summaries and bid papers. Emails are sent through an email delivery service.</p>
        <h3>Your rights</h3>
        <p>You can see and change your details in Settings, download all your data, turn off alerts, or delete your account and data at any time. You can withdraw consent by deleting your account.</p>
        <h3>What we never do</h3>
        <p>We never submit bids or sign anything for you, never ask for your digital signature, passwords or portal logins, and only use public tender information.</p>
        <h3>Contact / grievance</h3>
        <p>Email {process.env.NEXT_PUBLIC_CONTACT_EMAIL || "quentnow@gmail.com"} and we will respond within 7 days.</p>
      </div>
    </div>
  );
}
