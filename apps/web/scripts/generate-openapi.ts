import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  input: ['./openapi.json'],
  output: './content/docs/reference/api',
  includeDescription: true,
});
