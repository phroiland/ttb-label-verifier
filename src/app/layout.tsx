import type { Metadata } from 'next'
import Script from 'next/script'
import { Public_Sans } from 'next/font/google'
import './globals.css'

const publicSans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-public-sans',
})

export const metadata: Metadata = {
  title: 'TTB Label Verifier — Unofficial Prototype',
  description: 'AI-powered alcohol label compliance verification (unofficial prototype)',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={publicSans.variable}>
      <body>
        <div className="gov-banner" role="note">
          <span className="gov-banner-flag" aria-hidden="true" />
          <span>
            <strong>Unofficial prototype.</strong>{' '}
            This is not a U.S. government website and is not affiliated with or endorsed by
            TTB or the Department of the Treasury.
          </span>
        </div>

        <header className="masthead">
          <div className="masthead-inner">
            <div className="masthead-seal" aria-hidden="true">TTB</div>
            <div>
              <p className="masthead-kicker">Alcohol and Tobacco Tax and Trade Bureau · Prototype</p>
              <p className="masthead-title">Label Verification System</p>
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="site-footer-inner">
            <p>
              Prototype developed for evaluation purposes. Not an official system of record;
              verification results are advisory and do not constitute a TTB determination.
            </p>
            <p>
              Official label requirements:{' '}
              <a href="https://www.ttb.gov/labeling" target="_blank" rel="noopener noreferrer">
                ttb.gov/labeling
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
