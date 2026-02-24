# NEPA GraphQL API Examples

This directory contains comprehensive examples for using the NEPA GraphQL API, including queries, mutations, and subscriptions for real-time updates.

## 📁 Files Overview

- **`queries.graphql`** - Example queries for fetching data
- **`mutations.graphql`** - Example mutations for creating/updating data
- **`subscriptions.graphql`** - Real-time subscription examples
- **`README.md`** - This documentation file

## 🚀 Getting Started

### 1. Access the GraphQL Playground

Navigate to `http://localhost:4000/graphql` in your browser to access the interactive GraphQL Playground.

### 2. Authentication

Most operations require authentication. Include your JWT token in the HTTP Headers:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

### 3. Set Variables

Use the Variables panel in the Playground to provide input values for mutations and queries.

## 📊 Query Examples

### Basic User Operations

```graphql
# Get current user profile
query GetCurrentUser {
  me {
    id
    email
    name
    role
    status
  }
}
```

### Advanced Filtering

```graphql
# Get overdue bills with pagination
query GetOverdueBills {
  myBills(
    where: { 
      status: PENDING,
      dueDate: { lt: "2024-01-01T00:00:00Z" }
    }
    first: 20
  ) {
    edges {
      node {
        id
        amount
        dueDate
        utility {
          name
          type
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

## 🔀 Mutation Examples

### User Registration

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

### Payment Processing

```graphql
mutation ProcessPayment($input: ProcessPaymentInput!) {
  processPayment(input: $input) {
    id
    amount
    status
    transactionId
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

## 📡 Subscription Examples

### Real-time Payment Updates

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

### System Events

```graphql
subscription PaymentSuccessEvents {
  systemEvent(event: "PAYMENT_SUCCESS") {
    id
    type
    data
    timestamp
  }
}
```

## 🔧 Client Integration

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

// Query example
const query = gql`
  query GetCurrentUser {
    me {
      id
      email
      name
    }
  }
`;

client.request(query).then(response => {
  console.log('User data:', response);
});

// Subscription example
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

subscription.subscribe({
  next: (data) => console.log('Payment update:', data),
  error: (err) => console.error('Subscription error:', err),
});
```

### React with Apollo Client

```jsx
import { useQuery, useSubscription, gql } from '@apollo/client';

const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      email
      name
      role
    }
  }
`;

const PAYMENT_PROCESSED = gql`
  subscription PaymentProcessed($userId: ID!) {
    paymentProcessed(userId: $userId) {
      id
      amount
      status
      transactionId
    }
  }
`;

function UserProfile() {
  const { data, loading, error } = useQuery(GET_CURRENT_USER);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h1>Welcome, {data.me.name}!</h1>
      <p>Email: {data.me.email}</p>
      <p>Role: {data.me.role}</p>
    </div>
  );
}

function PaymentNotifications({ userId }) {
  const { data, loading, error } = useSubscription(PAYMENT_PROCESSED, {
    variables: { userId },
  });

  if (loading) return <div>Listening for payments...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <h3>Payment Processed!</h3>
      <p>Amount: ${data.paymentProcessed.amount}</p>
      <p>Status: {data.paymentProcessed.status}</p>
    </div>
  );
}
```

### Python with gql

```python
from gql import gql, Client
from gql.transport.websockets import WebsocketsTransport
import asyncio

transport = WebsocketsTransport(
    url="ws://localhost:4000/graphql",
    headers={"Authorization": "Bearer YOUR_JWT_TOKEN"}
)

client = Client(transport=transport, fetch_schema_from_transport=True)

# Query example
query = gql("""
    query GetCurrentUser {
        me {
            id
            email
            name
        }
    }
""")

async def get_user():
    result = await client.execute_async(query)
    print("User data:", result)

# Subscription example
subscription = gql("""
    subscription PaymentProcessed($userId: ID!) {
        paymentProcessed(userId: $userId) {
            id
            amount
            status
        }
    }
""")

async def listen_for_payments():
    async for result in client.subscribe_async(subscription, variable_values={"userId": "user-id-here"}):
        print("Payment update:", result)

# Run the examples
asyncio.run(get_user())
asyncio.run(listen_for_payments())
```

## 📈 Performance Tips

### 1. Use Pagination

Always use pagination for large datasets:

```graphql
query GetBills($first: Int!, $after: String) {
  myBills(first: $first, after: $after) {
    edges {
      node {
        id
        amount
        dueDate
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### 2. Select Only Needed Fields

Avoid over-fetching by requesting only the fields you need:

```graphql
# Good: Only request necessary fields
query GetBillSummary {
  myBills(first: 10) {
    edges {
      node {
        id
        amount
        status
      }
    }
  }
}

# Avoid: Requesting everything
query GetBillDetails {
  myBills(first: 10) {
    edges {
      node {
        id
        amount
        lateFee
        discount
        dueDate
        status
        createdAt
        updatedAt
        user { ... }
        utility { ... }
        payments { ... }
      }
    }
  }
}
```

### 3. Use DataLoader

The API automatically uses DataLoader for efficient batch loading of related data.

### 4. Query Complexity

Be mindful of query complexity. The API enforces depth limits and complexity analysis.

## 🔒 Security Considerations

1. **Authentication**: Always include valid JWT tokens
2. **Authorization**: Users can only access their own data (except admins)
3. **Rate Limiting**: API includes rate limiting for all operations
4. **Input Validation**: All inputs are validated before processing
5. **CORS**: Properly configured for allowed origins

## 🐛 Error Handling

### GraphQL Errors Format

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
        "exception": {
          "stacktrace": ["Error: User not found..."]
        }
      }
    }
  ],
  "data": null
}
```

### Common Error Codes

- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error

## 📚 Additional Resources

- [GraphQL Official Documentation](https://graphql.org/learn/)
- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)
- [GraphQL Subscriptions](https://www.apollographql.com/docs/react/data/subscriptions/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

## 🆘 Support

For issues or questions about the NEPA GraphQL API:

1. Check the GraphQL Playground schema documentation
2. Review these example files
3. Check the API logs for detailed error information
4. Contact the development team for additional support
