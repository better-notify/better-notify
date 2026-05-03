import { K, F, S, P } from '@/components/landing/syntax';

export function PushSnippet() {
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
      <F>pushChannel</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/push'</S>
      {'\n'}
      {'\n'}
      <K>const</K> ch = <F>pushChannel</F>
      <P>()</P>
      {'\n'}
      <K>const</K> rpc = <F>createNotify</F>
      <P>({'{ '}</P>channels<P>: {'{ '}</P>push<P>:</P> ch<P>{' } }'}</P>
      <P>)</P>
      {'\n'}
      {'\n'}
      <K>const</K> catalog = rpc.<F>catalog</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}alert<P>:</P> rpc.<F>push</F>
      <P>()</P>
      {'\n'}
      {'    '}.<F>input</F>
      <P>(</P>z.<F>object</F>
      <P>({'{ '}</P>msg<P>:</P> z.<F>string</F>
      <P>(){' }'})</P>
      {'\n'}
      {'    '}.<F>title</F>
      <P>(</P>
      <S>'New alert'</S>
      <P>)</P>
      {'\n'}
      {'    '}.<F>body</F>
      <P>(({'{ '}</P>input<P>{' }'}) =&gt;</P> input.msg<P>)</P>
      {'\n'}
      {'    '}.<F>data</F>
      <P>({'{ '}</P>deeplink<P>:</P> <S>'/alerts'</S>
      <P>{' }'}</P>
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
      {'  '}channels<P>: {'{ '}</P>push<P>:</P> ch<P>{' }'},</P>
      {'\n'}
      {'  '}transportsByChannel<P>: {'{'}</P>
      {'\n'}
      {'    '}push<P>:</P> <F>fcmTransport</F>
      <P>({'{ '}</P>projectId<P>:</P> <S>'...'</S>
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
      <K>await</K> mail.alert.<F>send</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}to<P>:</P> <S>'device-token-abc'</S>
      <P>,</P>
      {'\n'}
      {'  '}input<P>:</P> <P>{'{ '}</P>msg<P>:</P> <S>'Disk 92%'</S>
      <P>{' }'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>)</P>
    </>
  );
}
