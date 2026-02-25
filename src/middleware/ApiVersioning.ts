import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ResponseBuilder, HttpStatus } from '../interfaces/ApiResponse';

/**
 * API Versioning Configuration
 */
interface ApiVersionConfig {
  version: string;
  deprecated?: boolean;
  deprecationDate?: string;
  sunsetDate?: string;
  migrationGuide?: string;
  supported: boolean;
}

/**
 * Supported API Versions
 */
const API_VERSIONS: Record<string, ApiVersionConfig> = {
  'v1': {
    version: 'v1',
    supported: true
  },
  'v2': {
    version: 'v2',
    supported: true
  }
};

/**
 * Default API version
 */
const DEFAULT_VERSION = 'v1';

/**
 * API Versioning Middleware
 * Handles version detection, validation, and routing
 */
export class ApiVersioning {
  /**
   * Extract API version from request
   */
  static extractVersion(req: Request): string {
    // Priority order: Header > Query Parameter > URL Path > Default
    
    // 1. Check X-API-Version header
    const headerVersion = req.headers['x-api-version'] as string;
    if (headerVersion && API_VERSIONS[headerVersion]) {
      return headerVersion;
    }

    // 2. Check query parameter
    const queryVersion = req.query.version as string;
    if (queryVersion && API_VERSIONS[queryVersion]) {
      return queryVersion;
    }

    // 3. Check URL path (/api/v1/...)
    const pathVersion = req.path.match(/\/api\/(v\d+)\//);
    if (pathVersion && API_VERSIONS[pathVersion[1]]) {
      return pathVersion[1];
    }

    // 4. Return default version
    return DEFAULT_VERSION;
  }

  /**
   * Validate API version
   */
  static validateVersion(version: string): { valid: boolean; config?: ApiVersionConfig } {
    const config = API_VERSIONS[version];
    
    if (!config) {
      return {
        valid: false
      };
    }

    if (!config.supported) {
      return {
        valid: false,
        config
      };
    }

    return {
      valid: true,
      config
    };
  }

  /**
   * Middleware to handle API versioning
   */
  static versionMiddleware(req: Request, res: Response, next: NextFunction): void {
    const version = ApiVersioning.extractVersion(req);
    const validation = ApiVersioning.validateVersion(version);

    if (!validation.valid) {
      const config = validation.config;
      
      if (config?.deprecated) {
        // Return deprecation warning for deprecated versions
        res.setHeader('X-API-Deprecated', 'true');
        res.setHeader('X-API-Deprecation-Date', config.deprecationDate);
        res.setHeader('X-API-Sunset-Date', config.sunsetDate);
        res.setHeader('X-API-Migration-Guide', config.migrationGuide);
      }

      return res.error(
        'UNSUPPORTED_API_VERSION',
        `API version ${version} is not supported`,
        HttpStatus.BAD_REQUEST,
        {
          supportedVersions: Object.keys(API_VERSIONS).filter(v => API_VERSIONS[v].supported),
          defaultVersion: DEFAULT_VERSION,
          ...(config && { versionInfo: config })
        }
      );
    }

    // Add version information to response headers
    res.setHeader('X-API-Version', version);
    res.setHeader('X-API-Supported-Versions', Object.keys(API_VERSIONS).join(', '));

    // Add deprecation warnings if applicable
    const versionConfig = API_VERSIONS[version];
    if (versionConfig?.deprecated) {
      res.setHeader('X-API-Deprecated', 'true');
      res.setHeader('X-API-Deprecation-Date', versionConfig.deprecationDate);
      res.setHeader('X-API-Sunset-Date', versionConfig.sunsetDate);
      res.setHeader('X-API-Migration-Guide', versionConfig.migrationGuide);
      
      // Add deprecation warning to response
      (req as any).apiDeprecationWarning = {
        version,
        deprecationDate: versionConfig.deprecationDate,
        sunsetDate: versionConfig.sunsetDate,
        migrationGuide: versionConfig.migrationGuide
      };
    }

    // Attach version to request for use in controllers
    (req as any).apiVersion = version;
    (req as any).apiVersionConfig = versionConfig;

    next();
  }

  /**
   * Get version information for API documentation
   */
  static getVersionInfo(): ApiVersionConfig[] {
    return Object.values(API_VERSIONS);
  }

  /**
   * Get supported versions
   */
  static getSupportedVersions(): string[] {
    return Object.keys(API_VERSIONS).filter(version => API_VERSIONS[version].supported);
  }

  /**
   * Get deprecated versions
   */
  static getDeprecatedVersions(): string[] {
    return Object.keys(API_VERSIONS).filter(version => API_VERSIONS[version].deprecated);
  }

  /**
   * Mark version as deprecated
   */
  static deprecateVersion(
    version: string, 
    deprecationDate: string, 
    sunsetDate: string, 
    migrationGuide?: string
  ): void {
    if (API_VERSIONS[version]) {
      API_VERSIONS[version].deprecated = true;
      API_VERSIONS[version].deprecationDate = deprecationDate;
      API_VERSIONS[version].sunsetDate = sunsetDate;
      API_VERSIONS[version].migrationGuide = migrationGuide;
    }
  }

  /**
   * Add new version support
   */
  static addVersion(config: ApiVersionConfig): void {
    API_VERSIONS[config.version] = config;
  }

  /**
   * Remove version support
   */
  static removeVersion(version: string): void {
    delete API_VERSIONS[version];
  }
}

/**
 * Version-aware route builder
 */
export class VersionedRouter {
  private version: string;
  private routes: Map<string, any> = new Map();

  constructor(version: string) {
    this.version = version;
  }

  /**
   * Add route for specific version
   */
  addRoute(path: string, handler: any): void {
    this.routes.set(path, handler);
  }

  /**
   * Get versioned path
   */
  getVersionedPath(path: string): string {
    return `/api/${this.version}${path}`;
  }

  /**
   * Middleware to check version compatibility
   */
  versionCheck(req: Request, res: Response, next: NextFunction): void {
    if ((req as any).apiVersion !== this.version) {
      return res.error(
        'VERSION_MISMATCH',
        `This endpoint is only available in API version ${this.version}`,
        HttpStatus.BAD_REQUEST,
        {
          requestedVersion: (req as any).apiVersion,
          requiredVersion: this.version
        }
      );
    }
    next();
  }
}
