import { readFileSync } from 'fs';
import { join } from 'path';

// Load the GraphQL schema from the .graphql file
const schemaPath = join(__dirname, 'schema.graphql');
const typeDefs = readFileSync(schemaPath, 'utf8');

export { typeDefs };
