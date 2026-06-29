# Wevlo Admin Panel — Setup Guide

## Admin Panel URL
```
https://your-site.pages.dev/admin/
```

## Default Login
| Field    | Value            |
|----------|------------------|
| Email    | admin@wevlo.com  |
| Password | Admin@2024       |

> ⚠️ **First thing:** Settings > Admin Credentials-এ password পরিবর্তন করুন!

---

## Cloudflare Pages Deploy

### Method 1 — Drag & Drop (সহজ)
1. [pages.cloudflare.com](https://pages.cloudflare.com) → Create Project
2. "Upload assets" → পুরো `wevlo` folder drag করুন
3. Deploy!

### Method 2 — Wrangler CLI
```bash
npm install -g wrangler
wrangler login
wrangler pages deploy . --project-name=wevlo
```

### Method 3 — GitHub Auto Deploy
1. GitHub-এ repo push করুন
2. Cloudflare Pages → Connect to Git → repo select করুন
3. Build command: (ফাঁকা রাখুন — static site)
4. Output directory: `/` (root)

---

## Admin Panel Features

### 👥 User Management
- সব user দেখুন, edit করুন, delete করুন
- Wallet balance manually যোগ করুন
- Subscription grant/revoke/extend করুন
- Bulk select → bulk action (grant sub, add wallet, delete)
- CSV export করুন

### 💳 Wallet Requests
- Pending payment approve/reject করুন
- Bkash/Nagad payment verify করুন
- সব transaction history দেখুন
- CSV export

### ⭐ Subscriptions
- Active subscription দেখুন
- Manual subscription grant করুন
- Subscription revoke/extend করুন

### 📄 Templates
- Add/Edit/Delete templates
- Premium/free toggle
- Featured mark করুন
- Category manage করুন

### 🖼️ Banners
- Dashboard banner add/edit/delete
- Active/inactive toggle

### 🔬 Lab Projects
- সব lab project দেখুন
- Inappropriate project delete করুন

### 📱 APK/Apps
- App store manage করুন
- Add/Edit/Delete apps

### ⚙️ App Config
- Bkash/Nagad payment number
- Feature toggles (maintenance, registration, etc.)
- AdMob/Ads configuration

### ⚡ Flash Sale
- Flash sale enable/disable
- Sale items manage করুন
- Countdown timer set করুন

### 🔔 Push Notifications
- সব user বা specific group-কে notification পাঠান
- Notification history

### 🛠️ Settings
- Admin password পরিবর্তন
- API endpoints configure করুন

---

## API Connection (GAS)
Admin panel আপনার existing Google Apps Script API-এর সাথে connect হয়।
নতুন admin actions-এর জন্য GAS-এ এই actions যোগ করতে হবে:
- `getAllUsers`
- `adminUpdateUser`
- `adminDeleteUser`
- `adminAddWallet`
- `getAllWalletRequests`
- `adminApproveWallet`
- `adminRejectWallet`
- `getAllSubscriptions`
- `adminGrantSubscription`
- `adminRevokeSubscription`
- `adminExtendSubscription`
- `adminAddTemplate` / `adminUpdateTemplate` / `adminDeleteTemplate`
- `adminAddBanner` / `adminUpdateBanner` / `adminDeleteBanner`
- `adminDeleteLabProject`
- `adminAddApp` / `adminUpdateApp` / `adminDeleteApp`
- `adminAddPlan` / `adminUpdatePlan` / `adminDeletePlan`
- `adminSaveConfig`
- `adminSaveFeature`
- `adminSaveAdsConfig`
- `adminSaveFlashSale`
- `adminSendPushNotification`
