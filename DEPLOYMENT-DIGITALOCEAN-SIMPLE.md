# Simple DigitalOcean Deployment Guide

**Deploy M365 Tenant Manager without Docker**

This guide provides a straightforward deployment process for DigitalOcean using direct Node.js (no Docker required). For Docker deployment, see `../installation/DIGITALOCEAN-DOCKER-DEPLOYMENT.md`.

## Overview

- **Platform**: DigitalOcean Droplet
- **OS**: Ubuntu 22.04 LTS
- **Runtime**: Node.js 20 LTS (direct, no containers)
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (free)
- **Process Manager**: PM2
- **Est. Time**: 45-60 minutes
- **Cost**: $6-12/month

---

## Prerequisites

- ✅ DigitalOcean account ([sign up](https://www.digitalocean.com))
- ✅ GitHub/GitLab repo with your code
- ✅ Domain name (optional, can use droplet IP)
- ✅ SSH client (PuTTY on Windows, Terminal on Mac/Linux)

---

## Part 1: Create DigitalOcean Droplet

### 1. Create Droplet

1. Log into DigitalOcean
2. Click **Create** → **Droplets**
3. **Choose Region**: London (LON1) for UK data residency
4. **Choose Image**: Ubuntu 22.04 LTS x64
5. **Choose Size**:
   - **Basic** plan
   - **Regular Intel** CPU
   - **$6/month** (1 GB RAM, 1 CPU) - Good for testing
   - **$12/month** (2 GB RAM, 1 CPU) - Recommended for production
6. **Authentication**:
   - Choose **SSH Key** (recommended) or **Password**
   - If SSH: Add your public key (from `~/.ssh/id_rsa.pub`)
7. **Hostname**: `m365-manager` (or your choice)
8. Click **Create Droplet**

### 2. Note Your Droplet IP

Once created, copy your droplet's **Public IP address** (e.g., `167.99.123.45`)

---

## Part 2: Initial Server Setup

### 1. Connect via SSH

```bash
# Replace with your droplet IP
ssh root@167.99.123.45
```

### 2. Update System

```bash
apt update && apt upgrade -y
```

### 3. Create Non-Root User (Security Best Practice)

```bash
# Create user
adduser m365admin

# Add to sudo group
usermod -aG sudo m365admin

# Copy SSH keys (if using SSH auth)
rsync --archive --chown=m365admin:m365admin ~/.ssh /home/m365admin
```

### 4. Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

### 5. Switch to New User

```bash
# Exit root session
exit

# Reconnect as new user
ssh m365admin@167.99.123.45
```

---

## Part 3: Install Dependencies

### 1. Install Node.js 20 LTS

```bash
# Install Node.js 20 LTS (current active LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x or higher
```

### 2. Install Git

```bash
sudo apt install -y git
git --version
```

### 3. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 --version
```

### 4. Install Nginx (Reverse Proxy)

```bash
sudo apt install -y nginx
sudo systemctl status nginx  # Should show 'active (running)'
```

---

## Part 4: Clone and Configure Application

### 1. Clone Your Repository

```bash
# Navigate to home directory
cd ~

# Clone your repo (replace with your GitHub URL)
git clone https://github.com/yourusername/m365-tenant-manager.git
cd m365-tenant-manager/TenantAnalytics
```

### 2. Install Backend Dependencies

```bash
npm install
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Configure Environment Variables

#### Backend Environment

```bash
# Copy template to backend/.env
cp .env.production.template backend/.env

# Edit with nano (or vim)
nano backend/.env
```

**Update these values:**

```env
NODE_ENV=production
PORT=3000
APP_URL=https://167.99.123.45  # Use your droplet IP or domain
FRONTEND_URL=https://167.99.123.45

# Copy these from your local backend/.env (keep the same values!)
SUPABASE_URL=https://cezdrmwiiedcuutspmyl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ENCRYPTION_KEY=1429242070bef207282ff2bc46bbe5ec...
JWT_SECRET=your-jwt-secret-here
```

**Save:** Ctrl+O, Enter, Ctrl+X

#### Frontend Environment

```bash
# Create frontend/.env
nano frontend/.env
```

**Add:**

```env
REACT_APP_API_URL=https://167.99.123.45  # Same as APP_URL
```

**Save:** Ctrl+O, Enter, Ctrl+X

### 5. Build Frontend

```bash
# From TenantAnalytics directory
npm run build
```

This creates `frontend/build/` with optimized production files.

### 6. Test the Application

```bash
# Start backend
npm start
```

**In another terminal:**

```bash
# Test if it's running
curl http://localhost:3000/health
```

Should return: `{"status":"healthy",...}`

Press **Ctrl+C** to stop.

---

## Part 5: Set Up PM2 Process Manager

PM2 keeps your app running, auto-restarts on crashes, and starts on server reboot.

### 1. Start App with PM2

```bash
cd ~/m365-tenant-manager/TenantAnalytics

# Start app
pm2 start npm --name "m365-manager" -- start

# Check status
pm2 status

# View logs
pm2 logs m365-manager

# Stop viewing logs: Ctrl+C
```

### 2. Configure PM2 to Start on Boot

```bash
# Save PM2 process list
pm2 save

# Setup startup script
pm2 startup systemd

# Run the command it outputs (will be something like):
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u m365admin --hp /home/m365admin
```

### 3. Useful PM2 Commands

```bash
pm2 status                # View running apps
pm2 logs m365-manager     # View logs
pm2 restart m365-manager  # Restart app
pm2 stop m365-manager     # Stop app
pm2 delete m365-manager   # Remove from PM2
```

---

## Part 6: Configure Nginx Reverse Proxy

Nginx will:
- Listen on ports 80 (HTTP) and 443 (HTTPS)
- Forward requests to Node.js app on port 3000
- Handle SSL termination

### 1. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/m365-manager
```

**Add this configuration:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 167.99.123.45;  # Replace with your IP or domain

    # Increase upload size for Microsoft 365 data
    client_max_body_size 10M;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for long-running sync operations
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
```

**Save:** Ctrl+O, Enter, Ctrl+X

### 2. Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/m365-manager /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 3. Test HTTP Access

Visit `http://167.99.123.45` in your browser.

You should see your app (will show SSL warning - we'll fix this next).

---

## Part 7: Set Up SSL with Let's Encrypt

### 1. Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Obtain SSL Certificate

**If using a domain:**

```bash
# Replace with your domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**If using droplet IP only:**

Let's Encrypt requires a domain for SSL. Options:
- Use a free subdomain service like [DuckDNS](https://www.duckdns.org)
- Purchase a domain
- For testing, skip SSL and use HTTP

### 3. If Using a Domain - Update Environment Variables

```bash
# Update backend/.env
nano backend/.env
```

Change:
```env
APP_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

```bash
# Update frontend/.env
nano frontend/.env
```

Change:
```env
REACT_APP_API_URL=https://yourdomain.com
```

### 4. Rebuild Frontend and Restart

```bash
# Rebuild with new API URL
npm run build

# Restart PM2
pm2 restart m365-manager
```

### 5. Test HTTPS Access

Visit `https://yourdomain.com` - should show secure lock icon.

### 6. Auto-Renewal

Certbot installs a cron job for auto-renewal. Test it:

```bash
sudo certbot renew --dry-run
```

---

## Part 8: Post-Deployment

### 1. Verify Everything Works

- ✅ Visit your URL (`https://yourdomain.com` or `http://your-ip`)
- ✅ Create an account (Supabase Auth)
- ✅ Set up Azure credentials
- ✅ Run a sync
- ✅ View dashboard data

### 2. Monitor Application

```bash
# View real-time logs
pm2 logs m365-manager

# Monitor resources
pm2 monit

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 3. Set Up Monitoring (Optional)

```bash
# Set up PM2 monitoring (free)
pm2 plus
```

Or use external services:
- [UptimeRobot](https://uptimerobot.com) - Free uptime monitoring
- [Better Uptime](https://betteruptime.com) - Free tier available

---

## Updating Your Application

### Method 1: Git Pull (Recommended)

```bash
cd ~/m365-tenant-manager/TenantAnalytics

# Pull latest changes
git pull origin main

# Install any new dependencies
npm install
cd frontend && npm install && cd ..

# Rebuild frontend
npm run build

# Restart app
pm2 restart m365-manager

# View logs
pm2 logs m365-manager
```

### Method 2: Full Redeploy

```bash
cd ~
rm -rf m365-tenant-manager
git clone https://github.com/yourusername/m365-tenant-manager.git
cd m365-tenant-manager/TenantAnalytics

# Restore .env files (or recreate)
# Then follow build steps above
```

---

## Troubleshooting

### App Won't Start

```bash
# Check PM2 logs
pm2 logs m365-manager --lines 50

# Common issues:
# - Missing environment variables
# - Port 3000 already in use
# - Node modules not installed
```

### Nginx 502 Bad Gateway

```bash
# Check if app is running
pm2 status

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart m365-manager
sudo systemctl restart nginx
```

### Database Connection Issues

```bash
# Check environment variables
cat backend/.env | grep SUPABASE

# Test connection
node -e "const { createClient } = require('@supabase/supabase-js'); const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY); console.log('Connected!');"
```

### Build Fails

```bash
# Clear and reinstall
rm -rf node_modules frontend/node_modules
rm -rf frontend/build
npm install
cd frontend && npm install && cd ..
npm run build
```

---

## Security Checklist

- ✅ Using non-root user
- ✅ Firewall enabled (UFW)
- ✅ SSH key authentication (if configured)
- ✅ SSL certificate installed (if using domain)
- ✅ Environment variables secured (not in git)
- ✅ Regular security updates: `sudo apt update && sudo apt upgrade`

### Additional Security (Optional)

```bash
# Disable root SSH login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd

# Install fail2ban (brute force protection)
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Backup Strategy

### 1. Database Backups

Your Supabase database is already backed up by Supabase (automatic daily backups).

### 2. Environment Files

```bash
# Backup .env files
mkdir ~/backups
cp backend/.env ~/backups/backend.env.backup
cp frontend/.env ~/backups/frontend.env.backup
```

### 3. Full Server Snapshot

DigitalOcean offers droplet snapshots:
1. Go to droplet → **Snapshots**
2. Click **Take Snapshot**
3. Cost: $0.05 per GB per month

---

## Cost Summary

| Item | Cost | Notes |
|------|------|-------|
| DigitalOcean Droplet | $6-12/month | 1-2 GB RAM |
| SSL Certificate | Free | Let's Encrypt |
| Domain (optional) | $10-15/year | If you want custom domain |
| Supabase | Free tier | Upgrade if needed ($25/month for Pro) |
| **Total** | **$6-12/month** | Or $7-13 with domain |

---

## Support

- **DigitalOcean Community**: https://www.digitalocean.com/community
- **PM2 Docs**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **Nginx Docs**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/docs/

---

## What's Next?

- Set up automated backups
- Configure monitoring alerts
- Add custom domain
- Set up staging environment (second droplet)
- Configure GitHub Actions for auto-deployment

---

**Your app is now live in the cloud!** 🎉

Access it at `https://yourdomain.com` or `http://your-droplet-ip` and start managing your Microsoft 365 tenants.
