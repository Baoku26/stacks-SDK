import nextra from 'nextra';

// Nextra 4 (App Router). Theme config lives in `app/layout.tsx`, not here.
const withNextra = nextra({
  defaultShowCopyCode: true,
});

export default withNextra({
  reactStrictMode: true,
});
