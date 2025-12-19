# M365 Tenant Manager - Architecture & Deployment Guide

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     M365 Tenant Manager                         │
│                      Web Application                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTPS/REST
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Node.js Backend API                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Auth Layer   │  │ API Routes   │  │  Storage     │         │
│  │ (MSAL)       │  │ (Express)    │  │  Strategy    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────┬──────────────────────────┬──────────────────┘
                  │                          │
                  │ Microsoft Graph API      │ Data Storage
                  ▼                          ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│   Microsoft 365 Tenant      │  │   Storage Options            │
│                             │  │                              │
│  • Azure Active Directory   │  │ Option 1: M365 Tenant        │
│  • Exchange Online          │  │  • SharePoint Lists          │
│  • SharePoint Online        │  │  • Azure Storage             │
│  • Microsoft Teams          │  │                              │
│  • Security & Compliance    │  │ Option 2: Supabase           │
│  • Device Management        │  │  • PostgreSQL Database       │
│                             │  │  • Real-time subscriptions   │
└─────────────────────────────┘  │  • RESTful API               │
                                 └──────────────────────────────┘
```

### Component Architecture

```
Frontend (React SPA)
├── Authentication Layer
│   └── Azure AD OAuth 2.0 Flow
├── Dashboard Components
│   ├── Overview Dashboard
│   ├── User Management
│   ├── Security Monitoring
│   ├── Mailbox Analytics
│   └── App Usage Reports
├── Onboarding Flow
│   ├── Storage Selection
│   └── Azure Setup Wizard
└── Remediation Actions
    ├── User Controls
    ├── License Management
    └── Security Actions

Backend API (Node.js/Express)
├── Authentication Module
│   ├── Azure AD Client Credentials
│   └── Token Management
├── Microsoft Graph Client
│   ├── User Endpoints
│   ├── License Endpoints
│   ├── Security Endpoints
│   ├── Reports Endpoints
│   └── Device Endpoints
├── Storage Strategy Pattern
│   ├── M365TenantStorage
│   │   ├── SharePoint List Integration
│   │   └── Azure Storage Integration
│   └── SupabaseStorage
│       ├── PostgreSQL Operations
│       └── Real-time Subscriptions
├── Data Processing Layer
│   ├── Data Transformations
│   ├── Analytics Calculations
│   └── Report Generation
└── API Routes
    ├── /api/init
    ├── /api/users
    ├── /api/licenses
    ├── /api/security/*
    ├── /api/mailboxes
    ├── /api/reports/*
    ├── /api/remediation/*
    └── /api/analytics/*

Data Layer
├── Supabase Option
│   ├── PostgreSQL Database
│   ├── Row-Level Security (RLS)
│   ├── Real-time Subscriptions
│   └── RESTful API
└── M365 Tenant Option
    ├── SharePoint Lists
    ├── Document Libraries
    └── Azure Blob Storage
```

## Data Flow

### User Activity Monitoring Flow

```
1. Scheduled Task → Backend API
                      ↓
2. Backend → Microsoft Graph API → Get Active Users
                      ↓
3. Process & Transform Data
                      ↓
4. Storage Strategy → Save to Selected Storage
                      ↓
5. Frontend ← Fetch Analytics ← Backend API
                      ↓
6. Render Dashboard with Charts & Metrics
```

### Remediation Action Flow

```
1. User Action (Block User) → Frontend
                                  ↓
2. Confirmation Dialog → User Confirms
                                  ↓
3. POST /api/remediation/block-user → Backend
                                  ↓
4. Validate Permissions & Credentials
                                  ↓
5. Microsoft Graph API → PATCH /users/{id}
                                  ↓
6. Log Action → Storage Strategy → Audit Table
                                  ↓
7. Response → Frontend → Update UI
```

## Security Architecture

### Authentication Flow (Client Credentials)

```
┌──────────────┐
│ Backend API  │
└──────┬───────┘
       │ 1. Request Token
       ▼
┌──────────────────────────┐
│ Azure AD Token Endpoint  │
│ oauth2/v2.0/token        │
└──────┬───────────────────┘
       │ 2. Return Access Token
       ▼
┌──────────────────────────┐
│ Backend API              │
│ (Cache Token)            │
└──────┬───────────────────┘
       │ 3. API Request with Token
       ▼
┌──────────────────────────┐
│ Microsoft Graph API      │
│ graph.microsoft.com      │
└──────────────────────────┘
```

### Security Layers

1. **Network Security**
   - HTTPS/TLS 1.3
   - CORS configuration
   - API rate limiting
   - IP allowlisting (optional)

2. **Authentication & Authorization**
   - Azure AD OAuth 2.0
   - Application permissions (not delegated)
   - Admin consent required
   - Token caching & refresh

3. **Data Security**
   - Encryption at rest (Supabase)
   - Encryption in transit (TLS)
   - Row-level security (RLS)
   - Multi-tenant isolation

4. **Audit & Compliance**
   - All actions logged
   - Immutable audit trail
   - Timestamp verification
   - User attribution

## Deployment Options

### Option 1: Azure App Service

**Recommended for production enterprise deployments**

```bash
# Prerequisites
- Azure subscription
- Azure CLI installed

# Deployment steps
az login
az group create --name m365-tenant-rg --location eastus
az appservice plan create --name m365-plan --resource-group m365-tenant-rg --sku B1
az webapp create --name m365-tenant-manager --resource-group m365-tenant-rg --plan m365-plan
az webapp deployment source config-zip --resource-group m365-tenant-rg --name m365-tenant-manager --src deploy.zip

# Configure environment variables
az webapp config appsettings set --resource-group m365-tenant-rg --name m365-tenant-manager --settings @appsettings.json
```

**Architecture:**
```
Internet → Azure Front Door → App Service
                                    ↓
                            Azure Key Vault (Secrets)
                                    ↓
                            Application Insights (Monitoring)
```

### Option 2: Docker Container

**Recommended for flexible deployments**

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app .
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node healthcheck.js
USER node
CMD ["node", "backend-api.js"]
```

```bash
# Build and run
docker build -t m365-tenant-manager:latest .
docker run -d -p 3001:3001 --env-file .env --name m365-manager m365-tenant-manager:latest

# Or use Docker Compose
docker-compose up -d
```

### Option 3: Kubernetes

**Recommended for large-scale enterprise deployments**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: m365-tenant-manager
spec:
  replicas: 3
  selector:
    matchLabels:
      app: m365-tenant-manager
  template:
    metadata:
      labels:
        app: m365-tenant-manager
    spec:
      containers:
      - name: api
        image: m365-tenant-manager:latest
        ports:
        - containerPort: 3001
        env:
        - name: AZURE_TENANT_ID
          valueFrom:
            secretKeyRef:
              name: azure-credentials
              key: tenant-id
        - name: AZURE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: azure-credentials
              key: client-id
        - name: AZURE_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: azure-credentials
              key: client-secret
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
          requests:
            cpu: "250m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: m365-tenant-manager-service
spec:
  selector:
    app: m365-tenant-manager
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

### Option 4: Serverless (Azure Functions)

**Recommended for event-driven workloads**

```javascript
// function.json
{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post"],
      "route": "users"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}

// index.js
module.exports = async function (context, req) {
    // Your Microsoft Graph API logic here
};
```

## Scaling Considerations

### Horizontal Scaling

```
Load Balancer
    ├── App Instance 1 → Supabase
    ├── App Instance 2 → Supabase
    └── App Instance 3 → Supabase
```

**Configuration:**
- Stateless application design
- Session stored in Redis/database
- Shared cache layer
- Connection pooling

### Caching Strategy

```
Request → Cache Check → Cache Hit? 
                           ├── Yes → Return Cached Data
                           └── No → Fetch from Graph API
                                        ↓
                                  Update Cache → Return Data
```

**Cache Layers:**
1. **Application Cache**: In-memory cache (Node.js)
2. **Distributed Cache**: Redis/Azure Cache
3. **Database Cache**: Supabase query caching

**Cache TTL:**
- User data: 5 minutes
- License data: 15 minutes
- Usage reports: 1 hour
- Security scores: 30 minutes

### Performance Optimization

1. **API Request Batching**
```javascript
// Instead of multiple requests
const users = await Promise.all(
  userIds.map(id => graphClient.api(`/users/${id}`).get())
);

// Batch request
const batch = {
  requests: userIds.map((id, i) => ({
    id: i.toString(),
    method: "GET",
    url: `/users/${id}`
  }))
};
const response = await graphClient.api('/$batch').post(batch);
```

2. **Pagination**
```javascript
let allUsers = [];
let nextLink = '/users?$top=100';

while (nextLink) {
  const response = await graphClient.api(nextLink).get();
  allUsers = allUsers.concat(response.value);
  nextLink = response['@odata.nextLink'];
}
```

3. **Delta Queries** (for incremental sync)
```javascript
// Initial request
const users = await graphClient
  .api('/users/delta')
  .get();

// Store deltaLink for next sync
const deltaLink = users['@odata.deltaLink'];

// Next sync (only changes)
const changes = await graphClient
  .api(deltaLink)
  .get();
```

## Monitoring & Observability

### Key Metrics to Monitor

1. **Application Metrics**
   - API response times
   - Error rates
   - Request throughput
   - Cache hit ratios

2. **Microsoft Graph Metrics**
   - API call volume
   - Rate limit status
   - Token refresh frequency
   - Failed authentication attempts

3. **Database Metrics**
   - Query performance
   - Connection pool usage
   - Storage utilization
   - Replication lag (if applicable)

4. **Business Metrics**
   - Active users count
   - License utilization
   - Security score trends
   - Remediation action frequency

### Logging Strategy

```javascript
// Structured logging
logger.info('User action', {
  action: 'block_user',
  userId: 'user-123',
  performedBy: 'admin@contoso.com',
  timestamp: new Date().toISOString(),
  success: true
});
```

**Log Levels:**
- **ERROR**: Application errors, API failures
- **WARN**: Rate limits approaching, unusual activity
- **INFO**: Normal operations, user actions
- **DEBUG**: Detailed debugging information

### Alerting Rules

1. **Critical Alerts**
   - API authentication failures
   - Database connection failures
   - High error rates (>5%)
   - Security score drops >10 points

2. **Warning Alerts**
   - Rate limit threshold reached (>80%)
   - High response times (>2s)
   - Unusual remediation activity
   - License utilization >90%

3. **Informational Alerts**
   - Daily activity summary
   - Weekly security report
   - Monthly license optimization report

## Disaster Recovery

### Backup Strategy

**Supabase Option:**
- Automatic daily backups (Supabase managed)
- Point-in-time recovery (7 days)
- Manual backup exports (weekly recommended)

**M365 Tenant Option:**
- SharePoint versioning enabled
- Azure Storage geo-redundant replication
- Manual exports to Azure Blob Storage

### Recovery Procedures

1. **Database Corruption**
```bash
# Restore from Supabase backup
supabase db restore <backup-id>
```

2. **Application Failure**
```bash
# Rollback to previous version
az webapp deployment slot swap --name m365-tenant-manager --resource-group m365-tenant-rg --slot staging
```

3. **Azure AD App Registration Lost**
- Restore from Infrastructure as Code (IaC)
- Re-grant admin consent
- Update application secrets

### Business Continuity

**Recovery Time Objective (RTO):** < 4 hours
**Recovery Point Objective (RPO):** < 1 hour

**Procedures:**
1. Activate backup API instance
2. Restore database from latest backup
3. Re-authenticate with Azure AD
4. Verify data integrity
5. Resume normal operations

## Cost Optimization

### Azure Costs

**App Service:**
- Basic tier: ~$55/month
- Standard tier: ~$100/month
- Premium tier: ~$400/month

**Storage:**
- Azure Blob Storage: ~$0.02/GB/month
- SharePoint: Included with M365 licenses

### Supabase Costs

- Free tier: Up to 500MB database, 2GB bandwidth
- Pro tier: $25/month (8GB database, 100GB bandwidth)
- Team tier: $599/month (Custom limits)

### Cost Reduction Strategies

1. **Use free tiers for development**
2. **Implement aggressive caching**
3. **Batch API requests**
4. **Use delta queries for incremental sync**
5. **Archive old data to cold storage**
6. **Optimize database queries**
7. **Right-size compute resources**

## Compliance Considerations

### Data Residency

- **Supabase**: Select region matching your compliance requirements
- **M365 Tenant**: Data stays in your configured geo
- **Azure**: Deploy to compliant regions

### Regulatory Compliance

- **GDPR**: Implement data deletion workflows
- **HIPAA**: Use Business Associate Agreement (BAA)
- **SOC 2**: Enable audit logging
- **ISO 27001**: Follow security best practices

### Data Retention

Default retention periods:
- User activity: 90 days
- Security events: 1 year
- Audit logs: 7 years
- Analytics: 2 years

Configurable via:
```env
DATA_RETENTION_DAYS=365
```

## Maintenance Procedures

### Regular Maintenance Tasks

**Daily:**
- Monitor error logs
- Check API rate limits
- Review security alerts

**Weekly:**
- Review license utilization
- Analyze inactive mailboxes
- Check security score trends
- Update cached data

**Monthly:**
- Rotate client secrets (if applicable)
- Review and optimize queries
- Analyze cost trends
- Update dependencies

**Quarterly:**
- Review Azure AD permissions
- Conduct security audit
- Optimize database indexes
- Review disaster recovery plan

### Update Procedures

1. **Test in staging environment**
2. **Create database backup**
3. **Deploy to production**
4. **Monitor for errors**
5. **Rollback if needed**

## Support & Troubleshooting

### Common Issues & Solutions

See README.md troubleshooting section for detailed solutions.

### Getting Help

1. **Check logs**: `logs/app.log` or Azure Application Insights
2. **Review Microsoft Graph API status**: https://status.graph.microsoft.com
3. **Check Supabase status**: https://status.supabase.com
4. **Review audit trail**: Check remediation_actions table
5. **Contact support**: Open GitHub issue or contact your administrator

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Maintained By:** Development Team
