import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createNotify, createClient } from '@betternotify/core';
import { whatsappChannel } from '@betternotify/whatsapp';
import { whatsappMetaTransport } from '@betternotify/whatsapp/transports';
import { z } from 'zod';
import { env } from '../env';

export const runWhatsAppMeta = async (): Promise<void> => {
  const rpc = createNotify({ channels: { whatsapp: whatsappChannel() } });

  const catalog = rpc.catalog({
    orderConfirmation: rpc
      .whatsapp()
      .text()
      .input(z.object({ orderId: z.string(), total: z.string() }))
      .body(
        ({ input }) =>
          `Your order ${input.orderId} has been confirmed! Total: ${input.total}. Thank you for shopping with us.`,
      ),

    shippingPhoto: rpc
      .whatsapp()
      .image()
      .input(z.object({ orderId: z.string(), photoUrl: z.string() }))
      .url(({ input }) => input.photoUrl)
      .caption(({ input }) => `Your order ${input.orderId} is packed and ready to ship!`),

    invoiceUrl: rpc
      .whatsapp()
      .document()
      .input(z.object({ orderId: z.string(), invoiceUrl: z.string() }))
      .url(({ input }) => input.invoiceUrl)
      .filename(({ input }) => `invoice-${input.orderId}.pdf`)
      .caption('Here is your invoice.'),

    invoiceBuffer: rpc
      .whatsapp()
      .document()
      .input(z.object({ orderId: z.string(), pdf: z.unknown() }))
      .data(({ input }: { input: { orderId: string; pdf: unknown } }) => input.pdf as Buffer)
      .mimeType('application/pdf')
      .filename(({ input }) => `invoice-${input.orderId}.pdf`)
      .caption('Here is your invoice (buffer upload).'),

    promoVideo: rpc
      .whatsapp()
      .video()
      .input(z.object({ title: z.string(), videoUrl: z.string() }))
      .url(({ input }) => input.videoUrl)
      .caption(({ input }) => input.title),

    voiceNote: rpc
      .whatsapp()
      .audio()
      .input(z.object({ audioData: z.unknown() }))
      .data(({ input }: { input: { audioData: unknown } }) => input.audioData as Buffer)
      .mimeType('audio/mpeg'),

    storeLocation: rpc
      .whatsapp()
      .location()
      .input(z.object({ storeName: z.string(), lat: z.number(), lng: z.number() }))
      .latitude(({ input }) => input.lat)
      .longitude(({ input }) => input.lng)
      .name(({ input }) => input.storeName)
      .address('123 Main St, São Paulo, SP'),

    feedbackRequest: rpc
      .whatsapp()
      .interactive()
      .input(z.object({ orderId: z.string() }))
      .body(({ input }) => `How was your experience with order ${input.orderId}?`)
      .header('We value your feedback')
      .footer('Reply within 24h')
      .buttons([
        { id: 'great', title: 'Great!' },
        { id: 'ok', title: 'It was OK' },
        { id: 'bad', title: 'Not good' },
      ]),

    shareContact: rpc
      .whatsapp()
      .contacts()
      .input(z.object({ agentName: z.string(), agentPhone: z.string() }))
      .contacts(({ input }) => [
        {
          name: { formatted: input.agentName, first: 'Maria', last: 'Silva' },
          phones: [{ phone: input.agentPhone, type: 'WORK' }],
        },
      ]),

    ackReaction: rpc
      .whatsapp()
      .reaction()
      .input(z.object({ emoji: z.string() }))
      .emoji(({ input }) => input.emoji),
  });

  const transport = whatsappMetaTransport({
    accessToken: env.WHATSAPP_META_ACCESS_TOKEN,
    phoneNumberId: env.WHATSAPP_META_PHONE_NUMBER_ID,
  });

  const notify = createClient({
    catalog,
    transportsByChannel: { whatsapp: transport },
  });

  const to = env.WHATSAPP_META_DESTINATION_NUMBER;

  const pdfBuffer = readFileSync(join(import.meta.dirname, '../test-utils/example-pdf.pdf'));
  const audioBuffer = readFileSync(join(import.meta.dirname, '../test-utils/example-mp3.mp3'));

  const textResult = await notify.orderConfirmation.send({
    to,
    input: { orderId: 'ORD-1234', total: 'R$ 199,90' },
  });

  console.log('text:', { messageId: textResult.messageId, data: textResult.data });

  const imageResult = await notify.shippingPhoto.send({
    to,
    input: { orderId: 'ORD-1234', photoUrl: 'https://www.w3.org/Graphics/PNG/nurbcup2si.png' },
  });

  console.log('image:', { messageId: imageResult.messageId, data: imageResult.data });

  const docUrlResult = await notify.invoiceUrl.send({
    to,
    input: {
      orderId: 'ORD-1234',
      invoiceUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    },
  });

  console.log('document (url):', { messageId: docUrlResult.messageId, data: docUrlResult.data });

  const docBufferResult = await notify.invoiceBuffer.send({
    to,
    input: { orderId: 'ORD-5678', pdf: pdfBuffer },
  });

  console.log('document (buffer):', {
    messageId: docBufferResult.messageId,
    data: docBufferResult.data,
  });

  const videoResult = await notify.promoVideo.send({
    to,
    input: {
      title: 'Check out our new collection',
      videoUrl:
        'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
    },
  });

  console.log('video:', { messageId: videoResult.messageId, data: videoResult.data });

  const audioResult = await notify.voiceNote.send({
    to,
    input: { audioData: audioBuffer },
  });

  console.log('audio (buffer):', { messageId: audioResult.messageId, data: audioResult.data });

  const locationResult = await notify.storeLocation.send({
    to,
    input: { storeName: 'Loja Centro', lat: -23.5505, lng: -46.6333 },
  });

  console.log('location:', { messageId: locationResult.messageId, data: locationResult.data });

  const interactiveResult = await notify.feedbackRequest.send({
    to,
    input: { orderId: 'ORD-1234' },
  });

  console.log('interactive:', {
    messageId: interactiveResult.messageId,
    data: interactiveResult.data,
  });

  const contactResult = await notify.shareContact.send({
    to,
    input: { agentName: 'Maria Silva', agentPhone: '+5511988887777' },
  });
  console.log('contacts:', { messageId: contactResult.messageId, data: contactResult.data });

  const batchResult = await notify.orderConfirmation.batch([
    { to, input: { orderId: 'ORD-1001', total: 'R$ 50,00' } },
    { to, input: { orderId: 'ORD-1002', total: 'R$ 75,00' } },
  ]);

  console.log(`batch: ${batchResult.okCount} ok / ${batchResult.errorCount} errors`);
};
