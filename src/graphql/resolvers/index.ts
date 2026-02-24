import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';
import { userResolvers } from './userResolvers';
import { billResolvers } from './billResolvers';
import { paymentResolvers } from './paymentResolvers';
import { utilityResolvers } from './utilityResolvers';
import { documentResolvers } from './documentResolvers';
import { webhookResolvers } from './webhookResolvers';
import { reportResolvers } from './reportResolvers';
import { analyticsResolvers } from './analyticsResolvers';
import { authResolvers } from './authResolvers';
import { notificationResolvers } from './notificationResolvers';

// Custom scalar for DateTime
const DateTimeResolver = new GraphQLScalarType({
  name: 'DateTime',
  description: 'DateTime custom scalar type',
  serialize(value: any) {
    return new Date(value).toISOString();
  },
  parseValue(value: any) {
    return new Date(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

// Custom scalar for Decimal
const DecimalResolver = new GraphQLScalarType({
  name: 'Decimal',
  description: 'Decimal custom scalar type',
  serialize(value: any) {
    return value.toString();
  },
  parseValue(value: any) {
    return parseFloat(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
      return parseFloat(ast.value);
    }
    return null;
  },
});

// Custom scalar for JSON
const JSONResolver = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',
  serialize(value: any) {
    return value;
  },
  parseValue(value: any) {
    return value;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.OBJECT) {
      return JSON.parse(ast.value);
    }
    return null;
  },
});

// Main resolvers object
export const resolvers = {
  DateTime: DateTimeResolver,
  Decimal: DecimalResolver,
  JSON: JSONResolver,

  Query: {
    ...userResolvers.Query,
    ...billResolvers.Query,
    ...paymentResolvers.Query,
    ...utilityResolvers.Query,
    ...documentResolvers.Query,
    ...webhookResolvers.Query,
    ...reportResolvers.Query,
    ...analyticsResolvers.Query,
    ...authResolvers.Query,
  },

  Mutation: {
    ...authResolvers.Mutation,
    ...userResolvers.Mutation,
    ...billResolvers.Mutation,
    ...paymentResolvers.Mutation,
    ...documentResolvers.Mutation,
    ...webhookResolvers.Mutation,
    ...reportResolvers.Mutation,
  },

  Subscription: {
    ...userResolvers.Subscription,
    ...billResolvers.Subscription,
    ...paymentResolvers.Subscription,
    ...notificationResolvers.Subscription,
  },

  // Type resolvers for nested relationships
  User: {
    ...userResolvers.User,
  },
  Bill: {
    ...billResolvers.Bill,
  },
  Payment: {
    ...paymentResolvers.Payment,
  },
  Utility: {
    ...utilityResolvers.Utility,
  },
  Document: {
    ...documentResolvers.Document,
  },
  Webhook: {
    ...webhookResolvers.Webhook,
  },
  Report: {
    ...reportResolvers.Report,
  },
  UserProfile: {
    ...userResolvers.UserProfile,
  },
  NotificationPreference: {
    ...userResolvers.NotificationPreference,
  },
};
