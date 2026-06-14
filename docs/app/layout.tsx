import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';

export const metadata: Metadata = {
  title: { default: '@baoku26/sbtc-sdk', template: '%s — @baoku26/sbtc-sdk' },
  description:
    'Universal React SDK for sBTC and Stacks — React Native / Expo and web from a single install.',
};

const REPO = 'https://github.com/Baoku26/stacks-SDK';

const navbar = <Navbar logo={<b>@baoku26/sbtc-sdk</b>} projectLink={REPO} />;
const footer = <Footer>MIT {new Date().getFullYear()} © @baoku26/sbtc-sdk</Footer>;

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={await getPageMap()}
          docsRepositoryBase={`${REPO}/tree/main/docs`}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
