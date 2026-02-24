import { ApolloServerPluginLandingPageGraphQLPlayground } from '@apollo/server-plugin-landing-page-graphql-playground';

export const playgroundPlugin = ApolloServerPluginLandingPageGraphQLPlayground({
  settings: {
    'editor.theme': 'dark',
    'editor.fontSize': 14,
    'editor.fontFamily': 'Consolas, Monaco, "Courier New", monospace',
    'editor.reuseHeaders': true,
    'editor.cursorShape': 'line',
    'general.betaUpdates': false,
    'queryPlan.hideQueryPlan': false,
    'tracing.hideTracingResponse': false,
    'editor.prettier.printWidth': 80,
    'editor.prettier.tabWidth': 2,
    'editor.prettier.useTabs': false,
  },
  tabs: [
    {
      endpoint: '/graphql',
      name: 'NEPA GraphQL API',
      variables: {
        // Example variables for common queries
        "userId": "example-user-id",
        "billId": "example-bill-id",
        "paymentId": "example-payment-id",
      },
      query: `# Welcome to NEPA GraphQL API Playground
# This is an interactive environment to explore the GraphQL schema

# Example: Get current user profile
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

# Example: Get user's bills with pagination
query GetUserBills {
  myBills(first: 10) {
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

# Example: Create a new bill
mutation CreateBill {
  createBill(input: {
    amount: 150.50
    utilityId: "utility-id-here"
    dueDate: "2024-12-31T23:59:59Z"
    lateFee: 10.00
  }) {
    id
    amount
    dueDate
    status
    utility {
      name
      type
    }
  }
}

# Example: Process a payment
mutation ProcessPayment {
  processPayment(input: {
    billId: "bill-id-here"
    amount: 150.50
    method: STELLAR
  }) {
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

# Example: Subscribe to payment updates
subscription PaymentUpdates {
  paymentProcessed(userId: "user-id-here") {
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
}`,
    },
    {
      endpoint: '/graphql',
      name: 'Admin Operations',
      query: `# Admin-specific operations
# Note: Requires ADMIN role

# Example: Get dashboard analytics
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
    }
  }
}

# Example: Get all users with pagination
query GetAllUsers {
  users(first: 20) {
    edges {
      node {
        id
        email
        name
        role
        status
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}`,
    },
    {
      endpoint: '/graphql',
      name: 'Real-time Subscriptions',
      query: `# Real-time subscription examples
# These will push updates to you when events occur

# Subscribe to bill updates for a user
subscription BillUpdates {
  billUpdated(userId: "user-id-here") {
    id
    amount
    status
    dueDate
    updatedAt
    user {
      id
      email
    }
  }
}

# Subscribe to system events
subscription SystemEvents {
  systemEvent(event: "PAYMENT_SUCCESS") {
    id
    type
    data
    timestamp
  }
}`,
    },
  ],
});
