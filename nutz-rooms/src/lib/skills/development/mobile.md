---
name: Mobile Development
slug: development/mobile
description: Help founders build mobile apps
triggers:
  - mobile app
  - ios
  - android
  - react native
  - flutter
  - app store
---

# Mobile Development

## DO U NEED AN APP?

most startups don't need native apps early.
web apps work on mobile.
apps are expensive to build and maintain.

build an app when:
- need offline
- need push notifications (real ones)
- need hardware access (camera, GPS)
- users expect it (consumer apps)

## TECH CHOICES

### React Native
- JS/TS (same as web)
- good if web team
- Expo makes it easy
- used by: Discord, Shopify

### Flutter
- Dart language
- great UI toolkit
- good performance
- used by: Google Pay, BMW

### Native (Swift/Kotlin)
- best performance
- full platform features
- 2x development cost
- when u have resources

**for most startups: React Native + Expo**

## EXPO QUICKSTART

```bash
# create app
npx create-expo-app MyApp
cd MyApp

# run on phone (scan QR)
npx expo start
```

## MOBILE-SPECIFIC UX

- touch targets: 44x44px minimum
- no hover states
- swipe gestures
- loading states matter more
- offline handling
- deep links

## APP STORE TIPS

### Apple (harder)
- 1-7 days review
- strict guidelines
- $99/year
- privacy labels required

### Google Play (easier)
- faster review
- more lenient
- $25 one-time
- less strict

## COMMON MISTAKES

- building native too early
- same UX as web (feels wrong)
- no offline handling
- ignoring app size
- no deep links

## PUSH NOTIFICATIONS

use:
- Expo Push (built-in)
- OneSignal (cross-platform)
- Firebase (google)

don't spam. users will uninstall.

## WEB ALTERNATIVE

**PWA (Progressive Web App)**

web app that feels native:
- add to home screen
- offline support
- push notifications (limited)

good enough for MVP, no app store needed.
