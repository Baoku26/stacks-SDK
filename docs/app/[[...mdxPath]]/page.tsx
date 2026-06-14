import type { FC, ReactNode } from 'react';
import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents as getMDXComponents } from '../../mdx-components';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

type PageProps = Readonly<{ params: Promise<{ mdxPath: string[] }> }>;

// Nextra's MDX `wrapper` is loosely typed (a union incl. `undefined`); narrow it to
// the component shape `importPage` feeds it so JSX usage type-checks.
type WrapperProps = { toc: unknown; metadata: unknown; children: ReactNode };

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  return metadata;
}

const Wrapper = getMDXComponents().wrapper as FC<WrapperProps>;

export default async function Page(props: PageProps) {
  const params = await props.params;
  const result = await importPage(params.mdxPath);
  const { default: MDXContent, toc, metadata } = result;
  return (
    <Wrapper toc={toc} metadata={metadata}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
