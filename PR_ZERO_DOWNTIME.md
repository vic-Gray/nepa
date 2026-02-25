# 🚀 Implement Blue-Green Zero-Downtime Deployment Strategy

## 📋 Summary

This PR implements a comprehensive blue-green deployment strategy to enable zero-downtime updates for the NEPA platform. This resolves issue #125 by introducing a robust, automated, and reliable deployment process that eliminates service interruptions.

## 🛠️ Technical Implementation

### 1. **CI/CD Automation (GitHub Actions)**
- A new workflow (`.github/workflows/blue-green-deploy.yml`) automates the entire process:
  - Builds and pushes versioned Docker images.
  - Deploys the new version to a "green" environment.
  - Runs automated health checks to validate the deployment.
  - Atomically switches production traffic to the new version.
  - Automatically rolls back on failure.
  - Decommissions the old "blue" environment after a successful deployment.

### 2. **Kubernetes Configuration**
- **Templated Manifests**: New `deployment.yaml` and `service.yaml` files in the `k8s/` directory serve as templates for our microservices.
- **Traffic Switching**: The strategy uses a stable Kubernetes Service with a selector that is patched to switch traffic between blue and green deployments atomically, ensuring no dropped requests.

### 3. **Database Migration Strategy**
- A new guide (`docs/DATABASE_MIGRATION_GUIDE_ZERO_DOWNTIME.md`) has been created to establish best practices for writing backward-compatible database migrations, a critical requirement for zero-downtime deployments.

### 4. **Health Checks**
- A new `scripts/health-check.sh` script is used by the CI/CD pipeline to verify the health of the green environment before it receives production traffic.

## ✅ Impact

- **Eliminates Downtime**: Deployments will no longer cause service interruptions.
- **Improves Reliability**: Automated health checks and rollbacks prevent faulty code from impacting users.
- **Reduces Risk**: The ability to validate a new version in an isolated production environment before release significantly de-risks the deployment process.

Closes #125