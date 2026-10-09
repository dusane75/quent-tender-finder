import { APP_NAME } from "@/lib/constants";

export const metadata = { title: `About our robot — ${APP_NAME}` };

export default function AboutBot() {
  return (
    <div className="wrap narrow stack" style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: 32 }}>About QuentTenderFinderBot</h1>
      <div className="card stack">
        <p>
          This robot reads public government tender notice pages so that small Indian businesses hear about
          tenders they can bid for. It identifies itself as <code>QuentTenderFinderBot/1.0</code>.
        </p>
        <h3>How it behaves</h3>
        <ul className="clean">
          <li>It reads each site’s robots.txt rules before every visit and does not fetch pages that robots are asked to leave alone.</li>
          <li>It visits a small number of pages once a day, not continuously.</li>
          <li>It never tries to get past a CAPTCHA, a login or any other protection.</li>
          <li>It only reads pages that are already public, and only tender notices.</li>
          <li>It never submits forms or bids.</li>
        </ul>
        <h3>Want us to stop?</h3>
        <p>
          Add a Disallow rule for <code>QuentTenderFinderBot</code> in your robots.txt and we will stop on the next run,
          or email {process.env.NEXT_PUBLIC_CONTACT_EMAIL || "quentnow@gmail.com"} and we will remove your site at once.
        </p>
      </div>
    </div>
  );
}
