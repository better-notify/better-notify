import { K, F, S, P } from '@/components/landing/syntax';

export function CrossTransportSnippet() {
  return (
    <>
      <K>import</K> <P>{'{ '}</P>
      <F>multiTransport</F>
      <P>, </P>
      <F>createTransport</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/core/transports'</S>
      {'\n'}
      <K>import</K> <P>{'{ '}</P>
      <F>telegramTransport</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/telegram'</S>
      {'\n'}
      <K>import</K> <P>{'{ '}</P>
      <F>smtpTransport</F>
      <P>{' } '}</P>
      <K>from</K> <S>'@betternotify/smtp'</S>
      {'\n'}
      {'\n'}
      <K>const</K> smtp = <F>smtpTransport</F>
      <P>({'{ '}</P>host<P>:</P> <S>'...'</S>
      <P>{' }'}</P>
      <P>)</P>
      {'\n'}
      {'\n'}
      <K>const</K> smtpMirror = <F>createTransport</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}name<P>:</P> <S>'smtp-mirror'</S>
      <P>,</P>
      {'\n'}
      {'  '}send<P>:</P> <K>async</K> <P>(</P>rendered<P>,</P> ctx<P>) =&gt; {'{'}</P>
      {'\n'}
      {'    '}
      <K>await</K> smtp.<F>send</F>
      <P>({'{'}</P>
      {'\n'}
      {'      '}from<P>:</P> <S>'bot@example.com'</S>
      <P>,</P>
      {'\n'}
      {'      '}to<P>: [{'{ '}</P>email<P>:</P> <S>'team@example.com'</S>
      <P>{' }'}],</P>
      {'\n'}
      {'      '}subject<P>:</P> <S>{'`[${'}</S>ctx.route<S>{'}] Mirror`'}</S>
      <P>,</P>
      {'\n'}
      {'      '}html<P>:</P> <S>{'`<p>${'}</S>rendered.body<S>{'}</p>`'}</S>
      {'\n'}
      {'    '}
      <P>{'}'}, </P>ctx<P>)</P>
      {'\n'}
      {'    '}
      <K>return</K> <P>{'{ '}</P>messageId<P>:</P> 0<P>,</P> chatId<P>:</P> rendered.to ?? 0
      <P>{' }'}</P>
      {'\n'}
      {'  '}
      <P>{'}'}</P>
      {'\n'}
      <P>{'}'}</P>
      <P>)</P>
      {'\n'}
      {'\n'}
      <K>const</K> transport = <F>multiTransport</F>
      <P>({'{'}</P>
      {'\n'}
      {'  '}strategy<P>:</P> <S>'mirrored'</S>
      <P>,</P>
      {'\n'}
      {'  '}transports<P>: [</P>
      {'\n'}
      {'    '}
      <P>{'{ '}</P>transport<P>:</P> <F>telegramTransport</F>
      <P>({'{ '}</P>token<P>:</P> <S>'...'</S>
      <P>
        {' }'}){' }'},
      </P>
      {'\n'}
      {'    '}
      <P>{'{ '}</P>transport<P>:</P> smtpMirror<P>{' }'}</P>
      {'\n'}
      {'  '}
      <P>]</P>
      {'\n'}
      <P>{'}'}</P>
      <P>)</P>
    </>
  );
}
