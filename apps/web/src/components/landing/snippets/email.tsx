import { K, F, S, P, C } from '@/components/landing/syntax';

export function EmailSnippet() {
  return (
    <>
      <K>import</K> <P>{'{ '}</P>
      <F>createNotify</F>
      <P>, </P>
      <F>createClient</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/core'</S>
      <P>;</P>
      {'\n'}
      <K>import</K> <P>{'{ '}</P>
      <F>emailChannel</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/email'</S>
      <P>;</P>
      {'\n'}
      <K>import</K> <P>{'{ '}</P>
      <F>smtpTransport</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/smtp'</S>
      <P>;</P>
      {'\n'}
      {'\n'}
      <K>const</K> notify = <F>createNotify</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}channels<P>: {'{ '}</P>email<P>:</P> <F>emailChannel</F>
      <P>(){' }'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>);</P>
      {'\n'}
      {'\n'}
      <K>const</K> catalog = notify.<F>catalog</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}welcome<P>:</P> notify.<F>email</F>
      <P>()</P>
      {'\n'}
      {'    '}.<F>input</F>
      <P>(</P>z.<F>object</F>
      <P>({'{ '}</P>name<P>:</P> z.<F>string</F>
      <P>(){' }'})</P>
      <P>)</P>
      {'\n'}
      {'    '}.<F>subject</F>
      <P>(({'{ '}</P>input<P>{' }'}) =&gt;</P> <S>{'`Welcome, ${'}</S>input.name<S>{'}`'}</S>
      <P>)</P>
      {'\n'}
      {'    '}.<F>template</F>
      <P>(</P>WelcomeEmail<P>)</P>
      {'\n'}
      <P>{'}'}</P>
      <P>);</P>
      {'\n'}
      {'\n'}
      <K>const</K> client = <F>createClient</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}catalog<P>,</P>
      {'\n'}
      {'  '}transportsByChannel<P>: {'{'}</P>
      {'\n'}
      {'    '}email<P>:</P> <F>smtpTransport</F>
      <P>({'{ '}</P>host<P>:</P> <S>'...'</S>
      <P>{' }'}</P>
      <P>)</P>
      {'\n'}
      {'  '}
      <P>{'}'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>);</P>
      {'\n'}
      {'\n'}
      <C>{'// fully typed: TS knows welcome expects { name: string }'}</C>
      {'\n'}
      <K>await</K> client.welcome.<F>send</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}to<P>:</P> <S>'ada@example.com'</S>
      <P>,</P>
      {'\n'}
      {'  '}input<P>:</P> <P>{'{ '}</P>name<P>:</P> <S>'Ada'</S>
      <P>{' }'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>);</P>
    </>
  );
}
