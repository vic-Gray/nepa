# 🚀 Blue-Green Deployment Strategy

## 1. Overview

This document outlines the blue-green deployment strategy for the NEPA platform, designed to achieve zero-downtime updates and improve deployment reliability. This strategy reduces risk by ensuring the new version of the application (the "green" environment) is fully operational and tested before any production traffic is routed to it.

The core principle is to run two identical production environments, "Blue" and "Green".

- **Blue Environment**: The current, live production environment receiving all user traffic.
- **Green Environment**: A new, idle environment where the updated version of the application is deployed.

## 2. Architecture

The strategy relies on a few key components within our Kubernetes-based infrastructure:

```
                                     +------------------+
                                     |   Load Balancer  |
                                     | (K8s Ingress)    |
                                     +--------+---------+
                                              |
                                     +--------v---------+
                                     |      Service     |
                                     | (Stable Endpoint)|
                                     +--------+---------+
                                        /          \
                   (Selector: color=blue) \          / (Selector: color=green)
                                           \        /
                              +--------------v-+  +--------------v-+
                              |   Deployment   |  |   Deployment   |
                              |      BLUE      |  |      GREEN     |
                              | (Current Ver)  |  |   (New Ver)    |
                              +----------------+  +----------------+
```

- **Deployments**: We manage two distinct Kubernetes Deployments, one for `blue` and one for `green`. They are identical except for the version of the application container they run.
- **Service**: A single, stable Kubernetes Service acts as the public endpoint for the application. Its selector determines which deployment (Blue or Green) receives traffic.
- **Ingress**: The Ingress controller directs all external traffic to this single, stable Service. The magic of switching traffic happens by changing the Service's selector, not the Ingress.

## 3. The Deployment Flow

The process is automated via our CI/CD pipeline (`.github/workflows/blue-green-deploy.yml`).

**Assumptions**: The `blue` environment is currently live.

### Step 1: Deploy Green Environment
The CI/CD pipeline deploys the new version of the application as a `green` deployment. This new deployment runs alongside the `blue` one but does not receive any production traffic.

### Step 2: Health Checks & Validation
Once the `green` environment is running, automated health checks and integration tests are run against it directly. This verifies that the new version is stable and functioning correctly before it handles any user requests.

### Step 3: Promote Green (Switch Traffic)
After successful validation, the traffic is switched. This is an atomic operation where the CI/CD pipeline patches the stable Service's selector to point to the `green` deployment's pods (e.g., changing `color: blue` to `color: green`).

`kubectl patch service <service-name> -p '{"spec":{"selector":{"color":"green"}}}'`

Traffic now flows seamlessly to the new version. Users experience no downtime.

### Step 4: Monitor and Automated Rollback
The `green` environment is monitored closely after the switch. If key metrics (like error rate or latency) degrade, the pipeline automatically triggers a rollback by patching the Service selector back to `blue`.

### Step 5: Decommission Blue
After a period of monitoring confirms the stability of the `green` environment (e.g., 1 hour), the old `blue` environment is automatically decommissioned to save resources.

## 4. Database Migrations

Zero-downtime deployments require careful database schema management. Since both the old and new versions of the application may run against the same database during the deployment, migrations must be backward-compatible.

Refer to the **Zero-Downtime Database Migration Guide** for detailed procedures.

## 5. Feature Flags

To further de-risk deployments, feature flags are used to gradually roll out new functionality to users. A new feature can be deployed "darkly" (turned off) in the `green` environment and enabled for a subset of users after the deployment is complete.

This allows for testing new features in a production environment with real users without affecting everyone.

Refer to the **Feature Flag Implementation Guide** for more details.

## 6. Benefits

- **Zero Downtime**: Users are not impacted during updates.
- **Reduced Risk**: The new version is fully tested before going live.
- **Instant Rollback**: Reverting to the previous version is nearly instantaneous.
- **Improved Reliability**: Automated health checks prevent faulty deployments from reaching users.

## 7. CI/CD Integration

The entire blue-green flow is codified in our GitHub Actions workflow. This ensures consistency, speed, and reliability for every deployment.

**Workflow File**: `/.github/workflows/blue-green-deploy.yml`

This workflow handles:
- Building and pushing Docker images.
- Templating and applying Kubernetes manifests.
- Running health checks.
- Managing traffic switching.
- Performing automated rollbacks.
- Cleaning up old environments.

---

This strategy provides a robust framework for deploying updates safely and efficiently, forming a critical part of our commitment to a stable and reliable platform.