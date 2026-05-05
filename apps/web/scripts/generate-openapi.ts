import { generateFiles } from 'fumadocs-openapi';

await generateFiles({
  input: ['./openapi.json'],
  output: './content/docs/reference/api',
  includeDescription: true,
});
