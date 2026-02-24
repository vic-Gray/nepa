import { GraphQLResolveInfo } from 'graphql';
import { logger } from '../../middleware/logger';

export const validateOperation = (info: GraphQLResolveInfo) => {
  const operation = info.operation.operation;
  const fieldName = info.fieldName;
  const parentType = info.parentType.name;
  
  // Log GraphQL operations for monitoring
  logger.info('GraphQL operation', {
    operation,
    fieldName,
    parentType,
    complexity: calculateComplexity(info),
  });
  
  // Add any custom validation logic here
  // For example, rate limiting specific operations
  if (operation === 'mutation' && isRestrictedMutation(fieldName)) {
    // Check user permissions or rate limits
    return true;
  }
  
  return true;
};

const calculateComplexity = (info: GraphQLResolveInfo): number => {
  // Simple complexity calculation - can be enhanced
  let complexity = 1;
  
  const countFields = (node: any): number => {
    if (!node.selectionSet) return 1;
    
    return node.selectionSet.selections.reduce((acc: number, selection: any) => {
      if (selection.kind === 'Field') {
        return acc + countFields(selection);
      }
      return acc;
    }, 1);
  };
  
  complexity = countFields(info.fieldNodes[0]);
  return complexity;
};

const isRestrictedMutation = (fieldName: string): boolean => {
  const restrictedMutations = [
    'deleteUser',
    'updateUserRole',
    'updateUserStatus',
    'deleteBill',
    'deleteWebhook',
  ];
  
  return restrictedMutations.includes(fieldName);
};

export const validateDepth = (info: GraphQLResolveInfo, maxDepth: number = 10): boolean => {
  const calculateDepth = (node: any, currentDepth: number = 0): number => {
    if (!node.selectionSet) return currentDepth;
    
    return Math.max(
      ...node.selectionSet.selections.map((selection: any) => 
        calculateDepth(selection, currentDepth + 1)
      )
    );
  };
  
  const depth = calculateDepth(info.fieldNodes[0]);
  
  if (depth > maxDepth) {
    logger.warn('GraphQL query depth exceeded', {
      depth,
      maxDepth,
      fieldName: info.fieldName,
    });
    
    throw new Error(`Query depth ${depth} exceeds maximum allowed depth of ${maxDepth}`);
  }
  
  return true;
};
