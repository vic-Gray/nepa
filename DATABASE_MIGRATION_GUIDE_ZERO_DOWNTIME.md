# 📖 Zero-Downtime Database Migration Guide

## Core Principle

In a blue-green deployment, both the old (blue) and new (green) versions of the application must be able to run simultaneously against the same database. This means all database migrations must be **backward-compatible**. The old application code must not break when the new schema changes are applied.

Destructive operations like `DROP COLUMN`, `RENAME COLUMN`, or making a column `NOT NULL` without a default are **not backward-compatible** and must be avoided in a single migration.

## Safe Migrations (Additive Changes)

These changes are generally safe to apply in a single deployment.

- **`CREATE TABLE`**: The old code is unaware of the new table, so it won't be affected.
- **`ADD COLUMN`**: Add new columns with a `DEFAULT` value, or ensure they are `NULL`-able. The old code will ignore the new column when reading and writing.
- **`CREATE INDEX`**: Adding an index is a non-breaking performance enhancement.

**Example (Prisma):**
```prisma
// Adding a new field is safe if it's optional
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  // highlight-next-line
  lastLogin DateTime? // New optional field
}
```

## Risky Migrations (The Expand/Contract Pattern)

For breaking changes like renaming or removing a column, you must use a multi-phase approach called "Expand/Contract".

**Scenario: Renaming `name` to `fullName` in the `User` table.**

### Phase 1: Expand (Deployment 1)

1.  **Migration**: Add the new column (`fullName`) but keep the old one (`name`).
    ```prisma
    model User {
      id       Int     @id @default(autoincrement())
      name     String? // Make old column optional
      fullName String? // Add new column as optional
    }
    ```
2.  **Application Code**:
    -   **Writes**: Write to both `name` and `fullName`.
    -   **Reads**: Read from `name`. If `name` is null, fall back to `fullName`. This ensures you can read data written by newer code versions.
3.  **Data Backfill**: Run a script to copy all data from the `name` column to the `fullName` column for existing records.

### Phase 2: Transition (Deployment 2)

1.  **Application Code**:
    -   **Writes**: Write only to `fullName`.
    -   **Reads**: Read only from `fullName`.

### Phase 3: Contract (Deployment 3)

1.  **Migration**: After confirming all services are on the Phase 2 codebase, you can safely create a migration to drop the old `name` column.
    ```prisma
    model User {
      id       Int    @id @default(autoincrement())
      fullName String // Make new column non-optional
      // The 'name' column is now removed
    }
    ```

By following this pattern, you ensure that your application remains fully functional throughout the entire migration process.