import { K, F, S, P, C } from '@/components/landing/syntax';

export function WhatsappSnippet() {
  return (
    <>
      <K>import</K> <P>{'{ '}</P>
      <F>createNotify</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/core'</S>
      <P>;</P>
      {'\n'}
      <K>import</K> <P>{'{ '}</P>
      <F>whatsappChannel</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/whatsapp'</S>
      <P>;</P>
      {'\n'}
      {'\n'}
      <K>const</K> notify = <F>createNotify</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}channels<P>: {'{ '}</P>whatsapp<P>:</P> <F>whatsappChannel</F>
      <P>(){' }'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>);</P>
      {'\n'}
      {'\n'}
      <C>{'// interactive message with reply buttons'}</C>
      {'\n'}
      <K>const</K> catalog = notify.<F>catalog</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}confirm<P>:</P> notify.<F>whatsapp</F>
      <P>()</P>
      {'\n'}
      {'    '}.<F>interactive</F>
      <P>()</P>
      {'\n'}
      {'    '}.<F>input</F>
      <P>(</P>z.<F>object</F>
      <P>({'{'}</P>
      {'\n'}
      {'      '}orderId<P>:</P> z.<F>string</F>
      <P>()</P>
      {'\n'}
      {'    '}
      <P>{'}'}</P>
      <P>))</P>
      {'\n'}
      {'    '}.<F>body</F>
      <P>(</P>
      {'\n'}
      {'      '}
      <P>({'{ '}</P>input<P>{' }'}) =&gt;</P>
      {'\n'}
      {'        '}
      <S>{'`Order ${'}</S>input.orderId<S>{'} confirmed`'}</S>
      {'\n'}
      {'    '}
      <P>)</P>
      {'\n'}
      {'    '}.<F>buttons</F>
      <P>([</P>
      {'\n'}
      {'      '}
      <P>{'{ '}</P>id<P>:</P> <S>'track'</S>
      <P>,</P> title<P>:</P> <S>'Track'</S>
      <P>{' }'}</P>
      <P>,</P>
      {'\n'}
      {'      '}
      <P>{'{ '}</P>id<P>:</P> <S>'help'</S>
      <P>,</P> title<P>:</P> <S>'Help'</S>
      <P>{' }'}</P>
      {'\n'}
      {'    '}
      <P>])</P>
      {'\n'}
      <P>{'}'}</P>
      <P>);</P>
      {'\n'}
      {'\n'}
      <K>await</K> client.confirm.<F>send</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}to<P>:</P> <S>'5511999887766'</S>
      <P>,</P>
      {'\n'}
      {'  '}input<P>:</P> <P>{'{ '}</P>orderId<P>:</P> <S>'#4821'</S>
      <P>{' }'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>);</P>
    </>
  );
}
