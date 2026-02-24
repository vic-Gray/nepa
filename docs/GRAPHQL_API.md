# NEPA GraphQL API Documentation

## Overview

The NEPA GraphQL API provides a powerful and efficient way to interact with the NEPA utility payment platform. This API addresses the limitations of the traditional REST API by offering:

- **Efficient Data Fetching**: Get exactly what you need in a single request
- **Strong Typing**: Auto-generated documentation and type safety
- **Real-time Updates**: WebSocket-based subscriptions for live data
- **Performance Optimization**: DataLoader for batched database queries
- **Developer Experience**: Interactive playground and comprehensive tooling

## 🚀 Getting Started

### Endpoint

- **GraphQL Endpoint**: `http://localhost:4000/graphql`
- **WebSocket Endpoint**: `ws://localhost:4000/graphql`
- **Playground**: `http://localhost:4000/graphql` (in browser)

### Authentication

Most operations require authentication. Include your JWT token in the Authorization header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Access the GraphQL Playground in your browser at `http://localhost:4000/graphql`

## 📊 Schema Overview

### Core Types

#### User
```graphql
type User {
  id: ID!
  email: String!
  username: String
  name: String
  phoneNumber: String
  avatar: String
  role: UserRole!
  status: UserStatus!
  walletAddress: String
  isEmailVerified: Boolean!
  isPhoneVerified: Boolean!
  twoFactorEnabled: Boolean!
  twoFactorMethod: TwoFactorMethod!
  lastLoginAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relations
  bills(first: Int, after: String, where: BillWhereInput): BillConnection!
  payments(first: Int, after: String, where: PaymentWhereInput): PaymentConnection!
  profiles: [UserProfile!]!
  notificationPreference: NotificationPreference
  documents(first: Int, after: String): DocumentConnection!
  reports(first: Int, after: String): ReportConnection!
  webhooks(first: Int, after: String): WebhookConnection!
}
```

#### Bill
```graphql
type Bill {
  id: ID!
  amount: Decimal!
  lateFee: Decimal!
  discount: Decimal!
  dueDate: DateTime!
  status: BillStatus!
  userId: String!
  utilityId: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relations
  user: User!
  utility: Utility!
  payments(first: Int, after: String): PaymentConnection!
}
```

#### Payment
```graphql
type Payment {
  id: ID!
  amount: Decimal!
  method: PaymentMethod!
  status: PaymentStatus!
  transactionId: String
  billId: String!
  userId: String!
  createdAt: DateTime!
  
  # Relations
  bill: Bill!
  user: User!
}
```

#### Utility
```graphql
type Utility {
  id: ID!
  name: String!
  type: String!
  provider: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relations
  bills(first: Int, after: String, where: BillWhereInput): BillConnection!
}
```

### Enums

```graphql
enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  PENDING_VERIFICATION
}

enum BillStatus {
  PENDING
  PAID
  OVERDUE
}

enum PaymentStatus {
  SUCCESS
  FAILED
  PENDING
}

enum PaymentMethod {
  BANK_TRANSFER
  CREDIT_CARD
  CRYPTO
  STELLAR
}
```

## 🔍 Queries

### Authentication Required

#### Get Current User
```graphql
query GetCurrentUser {
  me {
    id
    email
    name
    role
    status
    createdAt
  }
}
```

#### Get User's Bills
```graphql
query GetMyBills($first: Int, $after: String, $where: BillWhereInput) {
  myBills(first: $first, after: $after, where: $where) {
    edges {
      node {
        id
        amount
        dueDate
        status
        utility {
          name
          type
          provider
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

#### Get User's Payments
```graphql
query GetMyPayments($first: Int, $after: String, $where: PaymentWhereInput) {
  myPayments(first: $first, after: $after, where: $where) {
    edges {
      node {
        id
        amount
        method
        status
        transactionId
        createdAt
        bill {
          id
          amount
          status
          utility {
            name
            type
          }
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

### Admin Only

#### Get Dashboard Analytics
```graphql
query GetDashboard {
  dashboard {
    totalUsers
    totalBills
    totalPayments
    totalRevenue
    recentPayments {
      id
      amount
      status
      createdAt
      user {
        email
        name
      }
    }
    overdueBills {
      id
      amount
      dueDate
      user {
        email
        name
      }
      utility {
        name
        type
      }
    }
    userGrowth {
      date
      count
    }
    paymentTrends {
      date
      amount
    }
  }
}
```

## 🔀 Mutations

### Authentication

#### Register User
```graphql
mutation Register($input: CreateUserInput!) {
  register(input: $input) {
    token
    refreshToken
    user {
      id
      email
      name
      role
      status
    }
  }
}
```

Variables:
```json
{
  "input": {
    "email": "user@example.com",
    "username": "johndoe",
    "name": "John Doe",
    "password": "securePassword123",
    "role": "USER"
  }
}
```

#### Login
```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    refreshToken
    user {
      id
      email
      name
      role
      lastLoginAt
    }
  }
}
```

### Bills

#### Create Bill
```graphql
mutation CreateBill($input: CreateBillInput!) {
  createBill(input: $input) {
    id
    amount
    dueDate
    status
    utility {
      name
      type
      provider
    }
  }
}
```

Variables:
```json
{
  "input": {
    "amount": 125.50,
    "utilityId": "utility-id-here",
    "dueDate": "2024-12-31T23:59:59Z",
    "lateFee": 15.00,
    "discount": 5.00
  }
}
```

### Payments

#### Process Payment
```graphql
mutation ProcessPayment($input: ProcessPaymentInput!) {
  processPayment(input: $input) {
    id
    amount
    status
    transactionId
    createdAt
    bill {
      id
      amount
      status
    }
  }
}
```

Variables:
```json
{
  "input": {
    "billId": "bill-id-here",
    "amount": 125.50,
    "method": "STELLAR",
    "couponCode": "SAVE10"
  }
}
```

## 📡 Subscriptions

### Real-time Updates

#### Payment Updates
```graphql
subscription PaymentProcessed($userId: ID!) {
  paymentProcessed(userId: $userId) {
    id
    amount
    status
    transactionId
    createdAt
    bill {
      id
      amount
      status
    }
  }
}
```

#### Bill Updates
```graphql
subscription BillUpdated($userId: ID!) {
  billUpdated(userId: $userId) {
    id
    amount
    dueDate
    status
    updatedAt
    utility {
      name
      type
    }
  }
}
```

#### System Events
```graphql
subscription SystemEvents {
  systemEvent(event: "PAYMENT_SUCCESS") {
    id
    type
    data
    timestamp
  }
}
```

## 🔧 Pagination

The API uses cursor-based pagination for efficient data fetching:

```graphql
query GetBillsWithPagination($first: Int!, $after: String) {
  myBills(first: $first, after: $after) {
    edges {
      node {
        id
        amount
        status
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

### Pagination Parameters

- `first`: Number of items to return (max 100)
- `after`: Cursor for the next page (base64 encoded)
- `pageInfo`: Contains pagination metadata
- `totalCount`: Total number of items matching the query

## 🎯 Filtering

### Bill Filtering
```graphql
query FilterBills {
  myBills(where: {
    status: PENDING
    dueDate: {
      lt: "2024-01-01T00:00:00Z"
    }
    amount: {
      gte: 100
      lte: 500
    }
  }) {
    edges {
      node {
        id
        amount
        dueDate
        status
      }
    }
    totalCount
  }
}
```

### Payment Filtering
```graphql
query FilterPayments {
  myPayments(where: {
    status: SUCCESS
    method: STELLAR
    createdAt: {
      gte: "2024-01-01T00:00:00Z"
      lte: "2024-12-31T23:59:59Z"
    }
  }) {
    edges {
      node {
        id
        amount
        method
        status
        createdAt
      }
    }
    totalCount
  }
}
```

## 📈 Performance Features

### DataLoader

The API automatically uses DataLoader to batch and cache database queries, preventing N+1 problems:

```graphql
# This query will be optimized with DataLoader
query GetUsersWithBills {
  users(first: 10) {
    edges {
      node {
        id
        email
        bills(first: 5) {
          edges {
            node {
              id
              amount
              utility {
                name
              }
            }
          }
        }
      }
    }
  }
}
```

### Query Complexity Analysis

The API analyzes query complexity to prevent abuse:

- Maximum query depth: 10 levels
- Maximum complexity score: 1000
- Rate limiting per operation type

## 🛡️ Security

### Authentication & Authorization

- JWT-based authentication
- Role-based access control
- User can only access their own data (except admins)
- Secure WebSocket connections

### Input Validation

- All inputs are validated before processing
- SQL injection prevention
- XSS protection
- File upload validation

### Rate Limiting

- Per-user rate limiting
- Operation-specific limits
- DDoS protection

## 🐛 Error Handling

### Error Format

```json
{
  "errors": [
    {
      "message": "User not found",
      "locations": [
        {
          "line": 2,
          "column": 3
        }
      ],
      "path": ["user"],
      "extensions": {
        "code": "NOT_FOUND",
        "http": { "status": 404 }
      }
    }
  ]
}
```

### Error Codes

- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Input validation failed
- `RATE_LIMITED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

## 📚 Client Libraries

### JavaScript/TypeScript

```javascript
import { createClient } from 'graphql-ws';
import { gql } from 'graphql-tag';

const client = createClient({
  url: 'ws://localhost:4000/graphql',
  connectionParams: {
    authorization: 'Bearer YOUR_JWT_TOKEN',
  },
});

// Query
const query = gql`
  query GetCurrentUser {
    me {
      id
      email
      name
    }
  }
`;

const result = await client.request(query);

// Subscription
const subscription = client.subscribe({
  query: gql`
    subscription PaymentProcessed($userId: ID!) {
      paymentProcessed(userId: $userId) {
        id
        amount
        status
      }
    }
  `,
  variables: { userId: 'user-id-here' },
});
```

### React with Apollo

```jsx
import { useQuery, useSubscription, gql } from '@apollo/client';

const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      email
      name
    }
  }
`;

function UserProfile() {
  const { data, loading, error } = useQuery(GET_CURRENT_USER);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>Welcome, {data.me.name}!</div>;
}
```

### Python

```python
from gql import gql, Client
from gql.transport.websockets import WebsocketsTransport

transport = WebsocketsTransport(
    url="ws://localhost:4000/graphql",
    headers={"Authorization": "Bearer YOUR_JWT_TOKEN"}
)

client = Client(transport=transport)

query = gql("""
    query GetCurrentUser {
        me {
            id
            email
            name
        }
    }
""")

result = await client.execute_async(query)
```

## 📊 Monitoring & Analytics

### Metrics

The API exposes comprehensive metrics for monitoring:

- Request counts by operation
- Response times
- Error rates
- Active connections
- Subscription events

### Tracing

Distributed tracing with OpenTelemetry:

- Request tracing
- Resolver performance
- Database query analysis
- Subscription lifecycle

### Logging

Structured logging with correlation IDs:

- Request/response logging
- Error tracking
- Performance metrics
- Security events

## 🧪 Testing

### Query Testing

```graphql
# Test query
query TestQuery {
  __schema {
    queryType {
      fields {
        name
        description
      }
    }
  }
}
```

### Subscription Testing

Use the GraphQL Playground to test subscriptions with the WebSocket connection.

## 📖 Examples

See the `/src/graphql/examples/` directory for comprehensive examples:

- `queries.graphql` - Query examples
- `mutations.graphql` - Mutation examples
- `subscriptions.graphql` - Subscription examples
- `README.md` - Detailed usage examples

## 🆘 Support

For issues or questions:

1. Check the GraphQL Playground schema documentation
2. Review the example files
3. Check the application logs
4. Contact the development team

## 🔄 Migration from REST

### REST Endpoint → GraphQL Query

| REST Endpoint | GraphQL Query |
|--------------|---------------|
| `GET /api/user/profile` | `query { me { id email name } }` |
| `GET /api/bills?page=1&limit=10` | `query { myBills(first: 10) { edges { node { id amount } } } }` |
| `POST /api/payment/process` | `mutation { processPayment(input: {...}) { id status } }` |

### Benefits of Migration

1. **Single Request**: Get all needed data in one request
2. **No Over-fetching**: Request only the fields you need
3. **Real-time**: Built-in subscriptions for live updates
4. **Type Safety**: Auto-generated types and documentation
5. **Performance**: DataLoader and query optimization
6. **Developer Experience**: Interactive playground and tooling

## 🚀 Future Enhancements

- GraphQL Federation for microservices
- Advanced caching strategies
- Query cost analysis
- Automated performance optimization
- Enhanced developer tools
- Real-time analytics dashboard
