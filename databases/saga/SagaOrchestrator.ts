// Saga Orchestrator for distributed transactions
import { v4 as uuidv4 } from 'uuid';

export interface SagaStep {
  name: string;
  execute: () => Promise<any>;
  compensate: () => Promise<void>;
}

export interface SagaResult {
  sagaId: string;
  success: boolean;
  completedSteps: string[];
  failedStep?: string;
  error?: Error;
}

export class SagaOrchestrator {
  async executeSaga(sagaName: string, steps: SagaStep[]): Promise<SagaResult> {
    const sagaId = uuidv4();
    const completedSteps: string[] = [];
    const executedSteps: SagaStep[] = [];

    console.log(`🔄 Starting saga: ${sagaName} (ID: ${sagaId})`);

    try {
      // Execute all steps in sequence
      for (const step of steps) {
        console.log(`  ▶️  Executing step: ${step.name}`);
        await step.execute();
        completedSteps.push(step.name);
        executedSteps.push(step);
        console.log(`  ✅ Step completed: ${step.name}`);
      }

      console.log(`✅ Saga completed successfully: ${sagaName}`);
      return {
        sagaId,
        success: true,
        completedSteps,
      };
    } catch (error) {
      const failedStep = steps[completedSteps.length]?.name || 'unknown';
      console.error(`❌ Saga failed at step: ${failedStep}`, error);

      // Compensate in reverse order
      console.log(`🔄 Starting compensation for ${completedSteps.length} steps...`);
      for (let i = executedSteps.length - 1; i >= 0; i--) {
        const step = executedSteps[i];
        try {
          console.log(`  ◀️  Compensating step: ${step.name}`);
          await step.compensate();
          console.log(`  ✅ Compensation completed: ${step.name}`);
        } catch (compensationError) {
          console.error(`❌ Compensation failed for step: ${step.name}`, compensationError);
          // Log to monitoring system - this is critical
        }
      }

      return {
        sagaId,
        success: false,
        completedSteps,
        failedStep,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }
}

export default new SagaOrchestrator();
