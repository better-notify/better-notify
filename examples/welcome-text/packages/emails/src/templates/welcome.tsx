import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';

type Props = {
  name: string;
  verifyUrl: string;
};

export const Welcome = ({ name, verifyUrl }: Props) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Example. Verify your email to finish setting up your account.</Preview>
      <Body
        className="m-0 bg-slate-100 px-4 py-10 font-sans"
        style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
      >
        <Container
          className="mx-auto max-w-[560px] overflow-hidden rounded-2xl bg-white"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          <Section
            className="bg-cyan-600 px-8 py-6"
            style={{ backgroundColor: '#0891b2', padding: '24px 32px' }}
          >
            <Text
              className="m-0 text-sm font-bold uppercase tracking-[0.2em] text-white"
              style={{
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '2px',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              Example Mail
            </Text>
            <Text
              className="mb-0 mt-2 text-sm text-cyan-50"
              style={{ color: '#ecfeff', fontSize: '14px', lineHeight: '22px', margin: '8px 0 0' }}
            >
              Account verification
            </Text>
          </Section>

          <Section
            className="bg-white px-8 pb-3 pt-10"
            style={{ backgroundColor: '#ffffff', padding: '40px 32px 12px' }}
          >
            <Text
              className="m-0 inline-block rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700"
              style={{
                backgroundColor: '#ecfeff',
                borderRadius: '999px',
                color: '#0e7490',
                display: 'inline-block',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.4px',
                margin: 0,
                padding: '6px 12px',
                textTransform: 'uppercase',
              }}
            >
              Verify your email
            </Text>
            <Heading
              className="mb-0 mt-6 text-4xl font-bold leading-tight tracking-[-0.04em] text-slate-950"
              style={{
                color: '#020617',
                fontSize: '34px',
                fontWeight: 800,
                letterSpacing: '-1.2px',
                lineHeight: '40px',
                margin: '24px 0 0',
              }}
            >
              Welcome, {name}.
            </Heading>
            <Text
              className="mb-0 mt-4 text-base leading-7 text-slate-600"
              style={{ color: '#475569', fontSize: '16px', lineHeight: '26px', margin: '16px 0 0' }}
            >
              Confirm your email address to finish setting up your account.
            </Text>
          </Section>

          <Section
            className="bg-white px-8 py-7"
            style={{ backgroundColor: '#ffffff', padding: '28px 32px' }}
          >
            <Text
              className="m-0 text-base leading-7 text-slate-700"
              style={{ color: '#334155', fontSize: '16px', lineHeight: '26px', margin: 0 }}
            >
              Thanks for signing up. Verify your email address to activate your account and make
              sure we can reach you with important updates.
            </Text>

            <Button
              href={verifyUrl}
              className="mt-8 rounded-xl bg-cyan-600 px-8 py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white hover:bg-cyan-500"
              style={{
                backgroundColor: '#0891b2',
                borderRadius: '12px',
                color: '#ffffff',
                display: 'block',
                fontSize: '14px',
                fontWeight: 800,
                letterSpacing: '1.6px',
                lineHeight: '20px',
                marginTop: '32px',
                padding: '16px 32px',
                textAlign: 'center',
                textDecoration: 'none',
                textTransform: 'uppercase',
              }}
            >
              Verify Email
            </Button>

            <Text
              className="mb-0 mt-7 text-sm leading-6 text-slate-500"
              style={{ color: '#64748b', fontSize: '14px', lineHeight: '22px', margin: '28px 0 0' }}
            >
              If the button does not work, paste this link into your browser:
            </Text>
            <Link
              href={verifyUrl}
              className="break-all rounded-md bg-cyan-50 px-1 text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-100 hover:text-cyan-900"
              style={{
                backgroundColor: '#ecfeff',
                borderRadius: '6px',
                color: '#0e7490',
                display: 'inline-block',
                fontSize: '14px',
                lineHeight: '22px',
                marginTop: '8px',
                padding: '4px 6px',
                textDecoration: 'none',
                wordBreak: 'break-all',
              }}
            >
              {verifyUrl}
            </Link>

            <Hr className="my-8 border-slate-200" style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

            <Text
              className="m-0 text-sm leading-6 text-slate-500"
              style={{ color: '#64748b', fontSize: '14px', lineHeight: '22px', margin: 0 }}
            >
              If you did not create this account, you can safely ignore this message.
            </Text>
          </Section>

          <Section
            className="bg-slate-50 px-8 py-7"
            style={{ backgroundColor: '#f8fafc', padding: '28px 32px' }}
          >
            <Text
              className="m-0 text-sm font-semibold text-slate-700"
              style={{ color: '#334155', fontSize: '14px', fontWeight: 700, margin: 0 }}
            >
              The Example Team
            </Text>
            <Text
              className="mb-0 mt-4 text-xs leading-5 text-slate-500"
              style={{ color: '#64748b', fontSize: '12px', lineHeight: '20px', margin: '16px 0 0' }}
            >
              Example Inc. 123 Demo Street, Internet City
            </Text>
            <Text
              className="mb-0 mt-3 text-xs leading-5 text-slate-500"
              style={{ color: '#64748b', fontSize: '12px', lineHeight: '20px', margin: '12px 0 0' }}
            >
              You are receiving this email because an account was created with this address.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};
