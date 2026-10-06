# Mehwar Flow — Flutter Mobile App Implementation Runbook

This document is a complete, self-contained specification for building, configuring, and running the Mehwar Flow Flutter application (`apps/mobile`) connected to the local NestJS backend (`apps/api`).

## 1. Project Overview & Requirements
- **Backend:** NestJS 11 on `http://localhost:4000` (Postgres 16, Redis 7, MinIO S3, BullMQ worker).
- **Mobile Target:** Android (Emulator / Physical), iOS (Simulator / Physical), macOS Desktop.
- **Frontend Tech:** Flutter 3.x with Dart 3, Material 3, `dio` networking, `flutter_secure_storage`, `provider` state management, and `lucide_icons`.
- **Design System:** Nordic Slate Teal & Sage (clean, architectural, minimalist SaaS aesthetic).
- **Accessibility:** WCAG 2.1 AAA compliance (minimum 48×48 dp touch targets, dynamic font scaling, high contrast).

## 2. Design System Tokens (Nordic Slate Teal & Sage)
- **01 Primary Teal:** `#2F4B4E` (Primary Buttons, Active Filter Chips, Active Bottom Nav)
- **02 Sage Mist:** `#BFC7C8` (Borders, Inactive Chips, Outline Buttons)
- **03 Cool Slate:** `#A5B3B4` (Secondary Icons, Step Counters, Subtle Badges)
- **04 Obsidian Ink:** `#152223` (Headlines, Main Body Text — 14.8:1 Contrast)
- **05 Soft Mist Surface:** `#DCDEDE` (Input Fill, Skeletons, Card Dividers)
- **Surface & Cards:** `#FFFFFF` (Crisp White with 20-24dp rounded corners)
- **Scaffold Background:** `#F7F9F9` (Warm Off-White / Alabaster)
- **Warm Amber Accent:** `#E5A93C` (Ratings, Warning Alerts, Scheduled Post Badges)
- **Soft Red / Error:** `#D9534F`

## 3. Backend Prerequisites (/mehwar-run Workflow)

Before running the Flutter app, ensure the backend services are running on the host machine:

```bash
# 1. Start Docker infra from repository root
docker compose up -d redis minio minio-init mailpit
docker compose stop web api worker postgres migrate

# 2. Deploy database migrations to host Postgres (localhost:5432)
DIRECT_DATABASE_URL="postgresql://postgres:root@localhost:5432/mehwar" \
DATABASE_URL="postgresql://mehwar_app:root@localhost:5432/mehwar" \
pnpm --filter @mehwar/db migrate:deploy

# 3. Start NestJS API server (Port 4000)
export $(grep -v '^#' .env | xargs) && pnpm --filter @mehwar/api dev

# 4. Start BullMQ Background Worker
export $(grep -v '^#' .env | xargs) && pnpm --filter @mehwar/worker dev

# 5. Verify backend health
curl http://localhost:4000/health
# Response must be: {"status":"ok", ...}
```

## 4. Flutter Project Setup

In `apps/mobile`:
```bash
flutter pub get
```

## 5. Running on Android Emulator / Devices

Forward Backend Port to Android Emulator:
```bash
adb reverse tcp:4000 tcp:4000
```

Run Flutter Application:
```bash
cd apps/mobile
flutter run
```
