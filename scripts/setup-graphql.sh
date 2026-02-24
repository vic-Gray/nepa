#!/bin/bash

# NEPA GraphQL API Setup Script
# This script sets up the GraphQL API implementation

echo "🚀 Setting up NEPA GraphQL API..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing GraphQL dependencies..."

# Install GraphQL dependencies
npm install @apollo/server@^4.9.5 \
    @apollo/server-plugin-landing-page-graphql-playground@^4.1.1 \
    @graphql-tools/schema@^10.0.0 \
    @graphql-tools/utils@^10.0.0 \
    @graphql-upload/graphql-upload@^16.0.2 \
    dataloader@^2.2.2 \
    graphql@^16.8.1 \
    graphql-subscriptions@^2.0.0 \
    graphql-ws@^5.14.3 \
    ws@^8.14.2

# Install TypeScript types
npm install --save-dev @types/graphql@^14.5.0 \
    @types/graphql-upload@^16.0.1 \
    @types/ws@^8.5.10

echo "🔧 Setting up environment variables..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your configuration"
fi

echo "🗄️  Generating Prisma client..."

# Generate Prisma client
npm run prisma:generate

echo "🏗️  Building TypeScript..."

# Build the project
npm run build

echo "🧪 Running tests..."

# Run tests
npm test

echo "✅ GraphQL API setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Update your .env file with database configuration"
echo "2. Run database migrations: npm run db:migrate-all"
echo "3. Start the GraphQL server: npm run dev"
echo "4. Access GraphQL Playground: http://localhost:4000/graphql"
echo ""
echo "📖 Documentation:"
echo "- GraphQL API docs: docs/GRAPHQL_API.md"
echo "- Examples: src/graphql/examples/"
echo "- Schema: src/graphql/schema.graphql"
echo ""
echo "🚀 Start the server with: npm run dev"
