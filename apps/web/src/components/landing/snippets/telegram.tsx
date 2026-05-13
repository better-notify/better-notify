import { K, F, S, P } from '@/components/landing/syntax';

export function TelegramSnippet() {
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
      <F>telegramChannel</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/telegram'</S>
      <P>;</P>
      {'\n'}
      <K>import</K> <P>{'{ '}</P>
      <F>telegramTransport</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/telegram'</S>
      <P>;</P>
      {'\n'}
      {'\n'}
      <K>const</K> notify = <F>createNotify</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}channels<P>: {'{ '}</P>telegram<P>:</P> <F>telegramChannel</F>
      <P>(){' }'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>);</P>
      {'\n'}
      {'\n'}
      <K>const</K> catalog = notify.<F>catalog</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}alert<P>:</P> notify.<F>telegram</F>
      <P>()</P>
      {'\n'}
      {'    '}.<F>input</F>
      <P>(</P>z.<F>object</F>
      <P>({'{ '}</P>msg<P>:</P> z.<F>string</F>
      <P>(){' }'})</P>
      <P>)</P>
      {'\n'}
      {'    '}.<F>body</F>
      <P>(({'{ '}</P>input<P>{' }'}) =&gt;</P> <S>{'`Alert: ${'}</S>input.msg<S>{'}`'}</S>
      <P>)</P>
      {'\n'}
      {'    '}.<F>parseMode</F>
      <P>(</P>
      <S>'HTML'</S>
      <P>)</P>
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
      {'    '}telegram<P>:</P> <F>telegramTransport</F>
      <P>({'{ '}</P>token<P>:</P> <S>'...'</S>
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
      <K>await</K> client.alert.<F>send</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}to<P>:</P> <S>'-1001234567890'</S>
      <P>,</P>
      {'\n'}
      {'  '}input<P>:</P> <P>{'{ '}</P>msg<P>:</P> <S>'Disk at 92%'</S>
      <P>{' }'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>);</P>
    </>
  );
}
