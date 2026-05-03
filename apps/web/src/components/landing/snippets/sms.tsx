import { K, F, S, P } from '@/components/landing/syntax';

export function SmsSnippet() {
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
      <F>smsChannel</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/sms'</S>
      {'\n'}
      {'\n'}
      <K>const</K> ch = <F>smsChannel</F>
      <P>()</P>
      {'\n'}
      <K>const</K> rpc = <F>createNotify</F>
      <P>({'{ '}</P>channels<P>: {'{ '}</P>sms<P>:</P> ch<P>{' } }'}</P>
      <P>)</P>
      {'\n'}
      {'\n'}
      <K>const</K> catalog = rpc.<F>catalog</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}verify<P>:</P> rpc.<F>sms</F>
      <P>()</P>
      {'\n'}
      {'    '}.<F>input</F>
      <P>(</P>z.<F>object</F>
      <P>({'{ '}</P>code<P>:</P> z.<F>string</F>
      <P>(){' }'})</P>
      {'\n'}
      {'    '}.<F>body</F>
      <P>(({'{ '}</P>input<P>{' }'}) =&gt;</P>
      {'\n'}
      {'      '}
      <S>{'`Your code is ${'}</S>input.code<S>{'}`'}</S>
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
      {'  '}channels<P>: {'{ '}</P>sms<P>:</P> ch<P>{' }'},</P>
      {'\n'}
      {'  '}transportsByChannel<P>: {'{'}</P>
      {'\n'}
      {'    '}sms<P>:</P> <F>twilioTransport</F>
      <P>({'{ '}</P>accountSid<P>:</P> <S>'...'</S>
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
      <K>await</K> mail.verify.<F>send</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}to<P>:</P> <S>'+15555555555'</S>
      <P>,</P>
      {'\n'}
      {'  '}input<P>:</P> <P>{'{ '}</P>code<P>:</P> <S>'847291'</S>
      <P>{' }'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>)</P>
    </>
  );
}
