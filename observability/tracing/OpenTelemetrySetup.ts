// OpenTelemetry setup for distributed tracing
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PrismaInstrumentation } from '@prisma/instrumentation';

export class OpenTelemetrySetup {
  private sdk: NodeSDK;

  constructor(serviceName: string) {
    // Configure Jaeger exporter
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    });

    // Configure resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    // Initialize SDK
    this.sdk = new NodeSDK({
      resource,
      spanProcessor: new BatchSpanProcessor(jaegerExporter),
      instrumentations: [
        // Auto-instrumentations
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable fs instrumentation (too noisy)
          },
        }),
        
        // HTTP instrumentation
        new HttpInstrumentation({
          requestHook: (span, request) => {
            span.setAttribute('http.request.headers', JSON.stringify(request.headers));
          },
          responseHook: (span, response) => {
            span.setAttribute('http.response.status_code', response.statusCode);
          },
        }),
        
        // Express instrumentation
        new ExpressInstrumentation({
          requestHook: (span, requestInfo) => {
            span.setAttribute('express.route', requestInfo.route);
          },
        }),
        
        // Prisma instrumentation
        new PrismaInstrumentation(),
      ],
    });
  }

  /**
   * Start OpenTelemetry SDK
   */
  start() {
    this.sdk.start();
    console.log('✅ OpenTelemetry tracing initialized');
  }

  /**
   * Shutdown OpenTelemetry SDK
   */
  async shutdown() {
    await this.sdk.shutdown();
    console.log('✅ OpenTelemetry tracing shut down');
  }
}

export default OpenTelemetrySetup;
