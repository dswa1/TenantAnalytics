# M365 Tenant Manager - Admin Consent Flow

Enterprise-grade Microsoft 365 tenant management application with **automated admin consent flow** following Microsoft's Zero Trust security recommendations.

## 🔐 Admin Consent Flow (Recommended Method)

This application implements Microsoft's recommended **admin consent endpoint** approach, as documented in:
https://learn.microsoft.com/en-us/security/zero-trust/develop/permissions-require-admin-consent

### Why Admin Consent Flow?

✅ **Automated Permission Granting**: No manual API permission configuration required  
✅ **Zero Trust Compliant**: Follows Microsoft's security best practices  
✅ **Audit Trail**: All consent actions are logged in Azure AD  
✅ **User-Friendly**: Simple click-through process for administrators  
✅ **Transparent**: Users see exactly what permissions are being requested  

## 🚀 Quick Start with Admin Consent

### Step 1: Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**
3. Configure:
   ```
   Name: M365 Tenant Manager
   Supported account types: Single tenant
   Redirect URI: 
     Platform: Web
     URI: http://localhost:8000/auth/callback (or your production URL)
   ```
4. Click **Register**

### Step 2: Get Application Details

From the **Overview** page, copy:
- **Application (client) ID**
- **Directory (tenant) ID**

**That's it!** No need to manually configure API permissions.

### Step 3: Run the Application

1. Open `m365-tenant-manager-v2.html` in your browser
2. Click "Get Started"
3. Select your storage option (M365 Tenant or Supabase)
4. Enter your **Tenant ID** and **Client ID**
5. Click "Continue"

### Step 4: Grant Admin Consent

The application will generate an admin consent URL and present it to you:

```
https://login.microsoftonline.com/{tenant}/adminconsent?
  client_id={clientId}
  &redirect_uri={redirectUri}
  &scope=User.Read.All Directory.Read.All Reports.Read.All...
  &prompt=admin_consent
```

Click **"Open Admin Consent Page"** and you'll be redirected to Microsoft's consent page where you can:

1. Sign in with Global Administrator credentials
2. Review all requested permissions
3. Click **"Accept"** to grant consent for your organization
4. Automatically return to the application

### What Permissions Are Requested?

The admin consent flow requests these **Application permissions**:

```
User.Read.All                          - Read all users
Directory.Read.All                     - Read directory data
Reports.Read.All                       - Read usage reports
SecurityEvents.Read.All                - Read security events
Policy.Read.All                        - Read policies
Device.Read.All                        - Read devices
Mail.Read                              - Read mail in all mailboxes
User.ReadWrite.All                     - Read and write users (for remediation)
UserAuthenticationMethod.ReadWrite.All - Manage authentication methods
```

These are automatically configured when you grant consent - no manual API permission setup required!

## 📋 Features

### Core Functionality
- **User & License Management**
  - Real-time user inventory with license details
  - Unused license identification
  - License utilization analytics
  - Automated license reclamation

- **Security & Compliance**
  - Security score monitoring
  - Risky user detection
  - Device compliance tracking
  - Conditional access policy management
  - Real-time security event monitoring

- **Mailbox Analytics**
  - Mailbox usage tracking
  - Inactive mailbox detection (90+ days)
  - Storage optimization recommendations
  - Automated mailbox cleanup

- **Application Usage**
  - Teams, SharePoint, Exchange, OneDrive usage
  - User adoption metrics
  - Activity trend analysis

- **Automated Remediation**
  - Block/unblock user accounts
  - Revoke user sessions
  - Remove licenses
  - Delete inactive accounts
  - Full audit trail

### Flexible Storage Options

#### Option 1: M365 Tenant Storage
- Data stays within your Microsoft 365 environment
- Uses SharePoint lists or Azure Storage
- No external dependencies
- Full compliance control

#### Option 2: Supabase Database
- Advanced analytics capabilities
- Real-time dashboards
- Historical trend analysis
- Multi-tenant support

## 🔧 Traditional Setup (Alternative Method)

If you prefer the traditional manual permission configuration:

### Step 1: Create App Registration (same as above)

### Step 2: Manually Configure API Permissions

1. Navigate to **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**
2. Add all required permissions (listed above)
3. Click **"Grant admin consent for [Your Organization]"**

### Step 3: Create Client Secret

1. Navigate to **Certificates & secrets** → **New client secret**
2. Add description and expiration
3. Copy the secret value immediately

### Step 4: Configure Environment

Create `.env` file:
```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
STORAGE_TYPE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-key
```

## 🔄 Admin Consent Flow - Technical Details

### How It Works

1. **User Initiates Consent**
   - Application generates consent URL with required scopes
   - URL includes state parameter for CSRF protection

2. **Redirect to Microsoft**
   ```
   GET https://login.microsoftonline.com/{tenant}/adminconsent
   ```

3. **Admin Reviews & Accepts**
   - Administrator signs in
   - Reviews requested permissions
   - Grants consent for entire organization

4. **Callback to Application**
   ```
   GET {redirect_uri}?admin_consent=True&tenant={tenant}&state={state}
   ```

5. **Application Validates**
   - Verifies state parameter
   - Confirms consent was granted
   - Proceeds with setup

### URL Parameters

```javascript
const consentUrl = `https://login.microsoftonline.com/${tenantId}/adminconsent?` +
  `client_id=${clientId}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&response_mode=query` +
  `&scope=${encodeURIComponent(scopes.join(' '))}` +
  `&state=${state}` +
  `&prompt=admin_consent`;
```

### Success Response

```
https://your-app.com/auth/callback?
  admin_consent=True
  &tenant=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  &state=12345
```

### Error Response

```
https://your-app.com/auth/callback?
  error=access_denied
  &error_description=The+admin+canceled+the+request
  &state=12345
```

## 🛡️ Security Considerations

### Why Admin Consent is Secure

1. **Administrator Control**: Only Global Administrators or Privileged Role Administrators can grant consent
2. **Transparency**: All permissions are clearly displayed before granting
3. **Audit Trail**: All consent actions are logged in Azure AD audit logs
4. **Revocable**: Consent can be revoked at any time from Azure Portal
5. **State Parameter**: CSRF protection prevents unauthorized consent grants

### Best Practices

1. **Review Permissions**: Always review requested permissions before granting
2. **Least Privilege**: Application only requests necessary permissions
3. **Regular Audits**: Review granted permissions quarterly
4. **Monitor Usage**: Set up alerts for unusual API activity
5. **Rotate Credentials**: Rotate client secrets every 6-12 months

### Monitoring Consent

View granted consents in Azure Portal:
```
Azure AD → Enterprise applications → [Your App] → Permissions
```

Review consent audit logs:
```
Azure AD → Audit logs → Filter: Activity = "Consent to application"
```

## 📚 API Endpoints (Backend)

### Initialize with Admin Consent

```http
POST /api/init
Content-Type: application/json

{
  "tenantId": "...",
  "clientId": "...",
  "storageType": "supabase"
}
```

Note: No `clientSecret` needed when using admin consent - the application uses the granted permissions.

### Get Users

```http
POST /api/users
Content-Type: application/json

{
  "tenantId": "...",
  "clientId": "..."
}
```

## 🔧 Installation

### Backend Setup

```bash
# Clone repository
git clone <repository-url>
cd m365-tenant-manager

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start backend
npm start
```

### Frontend Setup

```bash
# Serve the HTML file
npx serve .

# Or use Python
python -m http.server 8000

# Open browser
http://localhost:8000/m365-tenant-manager-v2.html
```

## 🎯 Usage Flow

1. **Welcome Screen** → Click "Get Started"
2. **Storage Selection** → Choose M365 Tenant or Supabase
3. **Azure App Setup** → Enter Tenant ID and Client ID
4. **Grant Consent** → Click button to open consent page
5. **Consent Page** → Sign in and click "Accept"
6. **Return to App** → Automatically redirected back
7. **Dashboard** → Start managing your tenant!

## 🐛 Troubleshooting

### Common Issues

#### 1. "User is not authorized to consent"
**Solution**: Ensure you're signed in as Global Administrator or Privileged Role Administrator

#### 2. "Redirect URI mismatch"
**Solution**: Ensure redirect URI in Azure app matches the one in your application

#### 3. "Invalid client_id"
**Solution**: Verify you copied the correct Application (client) ID from Azure Portal

#### 4. "The application is not configured"
**Solution**: Ensure the app registration exists and is not deleted

### Enable Debug Mode

Add to your environment:
```env
LOG_LEVEL=debug
```

## 📊 Compliance & Audit

### Viewing Consent History

```powershell
# Connect to Azure AD
Connect-AzureAD

# Get service principal
$sp = Get-AzureADServicePrincipal -Filter "AppId eq 'your-client-id'"

# View granted permissions
Get-AzureADServicePrincipalOAuth2PermissionGrant -ObjectId $sp.ObjectId
```

### Revoking Consent

1. Go to Azure Portal → Azure AD → Enterprise applications
2. Find your application
3. Navigate to **Permissions**
4. Click **Revoke admin consent**

## 🚀 Production Deployment

### Update Redirect URI

1. In Azure Portal, update redirect URI to production URL:
   ```
   https://your-production-domain.com/auth/callback
   ```

2. Update in application configuration:
   ```javascript
   redirectUri: 'https://your-production-domain.com/auth/callback'
   ```

### Use HTTPS

Admin consent requires HTTPS in production. Configure SSL certificate for your domain.

### Monitor API Usage

Set up monitoring for:
- Consent grant events
- API call volumes
- Failed authentication attempts
- Permission usage patterns

## 📖 Additional Resources

- [Microsoft Identity Platform - Admin Consent](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-admin-consent)
- [Zero Trust Development Guide](https://learn.microsoft.com/en-us/security/zero-trust/develop/)
- [Microsoft Graph API Documentation](https://docs.microsoft.com/graph/)
- [Azure AD App Registration Best Practices](https://docs.microsoft.com/azure/active-directory/develop/security-best-practices)

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Support

For issues or questions:
- Review Microsoft documentation on admin consent
- Check Azure AD audit logs
- Open GitHub issue
- Contact your administrator

---

**Document Version:** 2.0 (Admin Consent Flow)  
**Last Updated:** December 2024  
**Microsoft Documentation**: https://learn.microsoft.com/en-us/security/zero-trust/develop/permissions-require-admin-consent
