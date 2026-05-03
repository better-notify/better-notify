import { K, F, S, P } from '@/components/landing/syntax';

export function EmailSnippet() {
  return (
    <>
      <K>import</K> <P>{'{ '}</P>
      <F>createNotify</F>
      <P>, </P>
      <F>createClient</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/core'</S>
      {'\n'}
      <K>import</K> <P>{'{ '}</P>
      <F>emailChannel</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/email'</S>
      {'\n'}
      <K>import</K> <P>{'{ '}</P>
      <F>smtpTransport</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/smtp'</S>
      {'\n'}
      {'\n'}
      <K>const</K> ch = <F>emailChannel</F>
      <P>()</P>
      {'\n'}
      <K>const</K> rpc = <F>createNotify</F>
      <P>({'{ '}</P>channels<P>: {'{ '}</P>email<P>:</P> ch<P>{' } }'}</P>
      <P>)</P>
      {'\n'}
      {'\n'}
      <K>const</K> catalog = rpc.<F>catalog</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}welcome<P>:</P> rpc.<F>email</F>
      <P>()</P>
      {'\n'}
      {'    '}.<F>input</F>
      <P>(</P>z.<F>object</F>
      <P>({'{ '}</P>name<P>:</P> z.<F>string</F>
      <P>(){' }'})</P>
      {'\n'}
      {'    '}.<F>subject</F>
      <P>(({'{ '}</P>input<P>{' }'}) =&gt;</P>
      {'\n'}
      {'      '}
      <S>{'`Welcome, ${'}</S>input.name<S>{'}`'}</S>
      <P>)</P>
      {'\n'}
      {'    '}.<F>template</F>
      <P>(({'{ '}</P>input
      <P>
        {' }'}) =&gt; ({'{'}
      </P>
      {'\n'}
      {'      '}html<P>:</P> <S>{'`<p>Hi ${'}</S>input.name<S>{'}</p>`'}</S>
      {'\n'}
      {'    '}
      <P>{'}'})</P>
      <P>)</P>
      {'\n'}
      <P>{'}'}</P>
      <P>)</P>
      {'\n'}
      {'\n'}
      <K>const</K> mail = <F>createClient</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}catalog<P>,</P>
      {'\n'}
      {'  '}channels<P>: {'{ '}</P>email<P>:</P> ch<P>{' }'},</P>
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
      <P>)</P>
      {'\n'}
      {'\n'}
      <K>await</K> mail.welcome.<F>send</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}to<P>:</P> <S>'ada@example.com'</S>
      <P>,</P>
      {'\n'}
      {'  '}input<P>:</P> <P>{'{ '}</P>name<P>:</P> <S>'Ada'</S>
      <P>{' }'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>)</P>
    </>
  );
}
