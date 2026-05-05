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
  Tailwind,
  Text,
} from 'react-email';

type Props = {
  name: string;
  verifyUrl: string;
};

const theme = {
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f7f6fe',
          100: '#edeafc',
          200: '#d9d4f9',
          300: '#b8aef3',
          400: '#8e7eeb',
          500: '#5145c7',
          600: '#3d2fb3',
          700: '#2f2590',
          800: '#1f1a64',
          900: '#1a1552',
          950: '#110f3a',
        },
        slate: {
          50: '#fafafa',
          100: '#f5f5f6',
          200: '#eeeff0',
          300: '#dcdde0',
          400: '#a8a9ae',
          500: '#838489',
          600: '#626369',
          700: '#484950',
          800: '#2e2f34',
          900: '#1c1d21',
          950: '#121316',
        },
      },
    },
  },
};

export const Welcome = ({ name, verifyUrl }: Props) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome! Verify your email to finish setting up your account.</Preview>
      <Tailwind config={theme}>
        <Body className="m-0 bg-slate-100 px-4 py-10 font-sans">
          <Container className="mx-auto max-w-[560px] overflow-hidden rounded-2xl bg-white">
            <Section className="bg-navy-600 px-8 py-6">
              <Text className="m-0 text-sm font-bold uppercase tracking-[0.16em] text-white">
                {'{{name}}'}
              </Text>
              <Text className="mb-0 mt-2 text-sm text-navy-200">Account verification</Text>
            </Section>

            <Section className="px-8 pb-3 pt-10">
              <Text className="m-0 inline-block rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-navy-600">
                Verify your email
              </Text>
              <Heading className="mb-0 mt-6 text-3xl font-bold tracking-tight text-slate-950">
                Welcome, {name}.
              </Heading>
              <Text className="mb-0 mt-4 text-base leading-7 text-slate-600">
                Confirm your email address to finish setting up your account.
              </Text>
            </Section>

            <Section className="px-8 py-7">
              <Text className="m-0 text-base leading-7 text-slate-700">
                Thanks for signing up. Verify your email address to activate your account and make
                sure we can reach you with important updates.
              </Text>

              <Button
                href={verifyUrl}
                className="mt-8 rounded-xl bg-navy-600 px-8 py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white"
              >
                Verify Email
              </Button>

              <Text className="mb-0 mt-7 text-sm leading-6 text-slate-500">
                If the button does not work, paste this link into your browser:
              </Text>
              <Link
                href={verifyUrl}
                className="mt-2 inline-block break-all rounded-md bg-navy-50 px-1.5 py-1 text-sm font-medium text-navy-600 no-underline"
              >
                {verifyUrl}
              </Link>

              <Hr className="my-8 border-slate-200" />

              <Text className="m-0 text-sm leading-6 text-slate-500">
                If you did not create this account, you can safely ignore this message.
              </Text>
            </Section>

            <Section className="bg-slate-50 px-8 py-7">
              <Text className="m-0 text-sm font-semibold text-slate-700">{'{{name}}'}</Text>
              <Text className="mb-0 mt-4 text-xs leading-5 text-slate-500">
                You are receiving this email because an account was created with this address.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
