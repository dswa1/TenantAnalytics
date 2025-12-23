const { supabase } = require('./config/supabase');

async function testCostCalculation() {
  const tenantId = '52798071-2413-4c2f-b750-7cef1c192647';

  // Get licenses
  const { data: licenses } = await supabase
    .from('licenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('cost_per_unit', 'is', null);

  console.log('Licenses with cost:', licenses?.length);

  // Get app usage
  const { data: appUsage } = await supabase
    .from('app_usage')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('synced_at', { ascending: false });

  console.log('App usage records:', appUsage?.length);
  const period = appUsage?.[0]?.period || 'unknown';
  console.log('Period:', period);

  // Get users
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_licensed', true);

  console.log('Licensed users:', users?.length);

  // Create lookup maps
  const appUsageByUser = {};
  if (appUsage) {
    appUsage.forEach(usage => {
      appUsageByUser[usage.user_principal_name] = usage;
    });
  }

  const licenseBySku = {};
  if (licenses) {
    licenses.forEach(license => {
      licenseBySku[license.sku_id] = license;
    });
  }

  // App-specific cost mapping
  const appCostPercentages = {
    exchange: 0.25,
    onedrive: 0.15,
    sharepoint: 0.15,
    teams: 0.25,
    skype: 0.10,
    yammer: 0.10
  };

  const apps = ['exchange', 'onedrive', 'sharepoint', 'teams', 'skype', 'yammer'];
  let underutilizedCount = 0;
  let underutilizedApps = [];

  // Check threshold
  const inactivityThresholdDays = period === 'D30' ? 30 : 90;
  const inactivityThreshold = new Date();
  inactivityThreshold.setDate(inactivityThreshold.getDate() - inactivityThresholdDays);

  console.log('\nProcessing users for underutilized apps...');
  console.log('Inactivity threshold:', inactivityThreshold.toISOString().split('T')[0]);

  if (users) {
    users.forEach(user => {
      if (!user.licenses || user.licenses.length === 0) {
        return;
      }

      const userAppUsage = appUsageByUser[user.user_principal_name];
      if (!userAppUsage) {
        return;
      }

      // Check if user is inactive
      let isInactive = false;
      if (!user.account_enabled) {
        isInactive = true;
      } else if (user.last_sign_in) {
        const lastSignIn = new Date(user.last_sign_in);
        if (lastSignIn < inactivityThreshold) {
          isInactive = true;
        }
      } else if (userAppUsage) {
        const activityDates = [
          userAppUsage.exchange_last_activity_date,
          userAppUsage.onedrive_last_activity_date,
          userAppUsage.sharepoint_last_activity_date,
          userAppUsage.teams_last_activity_date,
          userAppUsage.skype_last_activity_date,
          userAppUsage.yammer_last_activity_date
        ].filter(d => d);

        if (activityDates.length === 0) {
          isInactive = true;
        }
      }

      // Skip if user is inactive - they'll be counted separately
      if (isInactive) {
        return;
      }

      // Check for underutilized apps
      apps.forEach(app => {
        const hasLicense = userAppUsage[`has_${app}_license`];
        const lastActivityDate = userAppUsage[`${app}_last_activity_date`];

        if (hasLicense) {
          let isUnderutilized = false;

          if (!lastActivityDate) {
            isUnderutilized = true;
          } else {
            const lastActivity = new Date(lastActivityDate);
            if (lastActivity < inactivityThreshold) {
              isUnderutilized = true;
            }
          }

          if (isUnderutilized) {
            // Calculate cost
            let appCost = 0;
            user.licenses.forEach(userLicense => {
              const license = licenseBySku[userLicense.skuId];
              if (license && license.cost_per_unit) {
                const fractionalCost = license.cost_per_unit * (appCostPercentages[app] || 0.15);
                appCost += fractionalCost;
              }
            });

            if (appCost > 0) {
              underutilizedCount++;
              underutilizedApps.push({
                user: user.display_name,
                app: app,
                lastActivity: lastActivityDate || 'never',
                appCost: appCost.toFixed(2)
              });
            }
          }
        }
      });
    });
  }

  console.log('\n=== Results ===');
  console.log('Total underutilized app instances:', underutilizedCount);
  console.log('\nFirst 10 underutilized apps:');
  underutilizedApps.slice(0, 10).forEach(item => {
    console.log(`  ${item.user} - ${item.app}: Last used ${item.lastActivity}, Cost: £${item.appCost}`);
  });

  process.exit(0);
}

testCostCalculation().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
