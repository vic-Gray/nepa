# Dat
**: Create separate schemas
2. **Phase 2**: Dual-write to both monolithic and new databases
3. **Phase 3**: Migrate read operations to new databases
4. **Phase 4**: Remove dual-write, use only new databases
5. **Phase 5**: Decommission monolithic database

## Technology Diversity

While all services currently use PostgreSQL, the architecture supports:
- **MongoDB** for document-heavy services
- **Redis** for caching and session storage
- **Elasticsearch** for search-intensive services
- **TimescaleDB** for time-series analytics

## Best Practices

1. **Never access another service's database directly**
2. **Use service APIs or events for cross-service data access**
3. **Implement proper connection pooling**
4. **Monitor database performance independently**
5. **Backup each database separately**
6. **Version control all schema changes**
7. **Test migrations in staging before production**

## Troubleshooting

### Connection Issues
```bash
# Test database connectivity
psql -h localhost -p 5432 -U user -d nepa_user_service
```

### Migration Failures
```bash
# Reset a specific service database
npx prisma migrate reset --schema=databases/user-service/schema.prisma
```

### Client Generation Issues
```bash
# Clean and regenerate
rm -rf node_modules/.prisma
npm run db:generate-all
```
