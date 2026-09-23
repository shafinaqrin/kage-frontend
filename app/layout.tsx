import type { Metadata } from 'next'
import Script from 'next/script'
import '../src/styles/tokens.css'
import '../src/styles/tailwind.css'
import '../src/styles/app.css'

export const metadata: Metadata = {
  title: 'Kage · Bursa Intraday',
  description: 'Kage — Material 3 intraday dashboard for Bursa Malaysia monitoring.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var stored=localStorage.getItem('kage-theme');var theme=stored==='dark'||stored==='light'?stored:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',theme)}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`}
        </Script>
        {children}
      </body>
    </html>
  )
}
