# BolekAI — Development Roadmap

> Complete todo list for building "max pro" agent system.
> Organized by priority. For Codex and future agents.

---

## 🎯 TIER 1: Core Features (High Priority)

### T1.1: Calendar Integration ⭐⭐⭐⭐⭐

**Why:** Coordinates all tasks/workflows around user's schedule

Tasks:
- [ ] **T1.1.1** Create `src/tools/calendar.ts`
  - [ ] Define tool: `calendar_get_events` (get events for date range)
  - [ ] Define tool: `calendar_create_event` (create event)
  - [ ] Define tool: `calendar_delete_event` (delete event)
  - [ ] Implement Google Calendar API client
  - [ ] Add auth flow (OAuth2)
  - [ ] Error handling for API failures

- [ ] **T1.1.2** Add to env.ts
  - [ ] GOOGLE_CALENDAR_CLIENT_ID
  - [ ] GOOGLE_CALENDAR_CLIENT_SECRET
  - [ ] GOOGLE_CALENDAR_REDIRECT_URI

- [ ] **T1.1.3** Register in tools/index.ts
  - [ ] Import calendar tools
  - [ ] Add to tools array
  - [ ] Add executeCalendarTool dispatcher

- [ ] **T1.1.4** Test
  - [ ] Write `src/__tests__/calendar.test.ts`
  - [ ] Test get_events
  - [ ] Test create_event
  - [ ] Test error handling

**Commit message:** `feat: add Google Calendar integration (get/create/delete events)`

---

### T1.2: Email Integration ⭐⭐⭐⭐⭐

**Why:** Every email becomes potential task/KB entry

Tasks:
- [ ] **T1.2.1** Create `src/tools/email.ts`
  - [ ] Define tool: `email_read_inbox` (get last N emails)
  - [ ] Define tool: `email_send` (send email)
  - [ ] Define tool: `email_search` (search emails)
  - [ ] Implement IMAP client (Gmail/Outlook)
  - [ ] Parse email headers + body
  - [ ] Handle attachments (basic)

- [ ] **T1.2.2** Add to env.ts
  - [ ] EMAIL_IMAP_HOST
  - [ ] EMAIL_IMAP_PORT
  - [ ] EMAIL_USERNAME
  - [ ] EMAIL_PASSWORD (or OAuth)
  - [ ] EMAIL_SENDER_NAME

- [ ] **T1.2.3** Email → Task Auto-Creation
  - [ ] When email arrives, agent can auto-create task
  - [ ] Parse subject/body for action items
  - [ ] Store email in KB as reference

- [ ] **T1.2.4** Test
  - [ ] Write `src/__tests__/email.test.ts`
  - [ ] Test read_inbox
  - [ ] Test send
  - [ ] Test search

**Commit message:** `feat: add email integration (IMAP read/send/search)`

---

### T1.3: Weather API ⭐⭐⭐⭐

**Why:** Critical for farm/outdoor work planning

Tasks:
- [ ] **T1.3.1** Create `src/tools/weather.ts`
  - [ ] Define tool: `weather_current` (current weather)
  - [ ] Define tool: `weather_forecast` (next 7 days)
  - [ ] Define tool: `weather_alert` (severe weather warning)
  - [ ] Implement Open-Meteo API (free, no key needed)
  - [ ] Geolocation support
  - [ ] Format response for Polish user

- [ ] **T1.3.2** Add to env.ts
  - [ ] USER_LATITUDE (or auto-detect)
  - [ ] USER_LONGITUDE (or auto-detect)
  - [ ] WEATHER_UNITS (metric)

- [ ] **T1.3.3** Integration with Tasks
  - [ ] Agent suggests when to work based on weather
  - [ ] Warns if bad weather for outdoor tasks

- [ ] **T1.3.4** Test
  - [ ] Write `src/__tests__/weather.test.ts`
  - [ ] Test current weather
  - [ ] Test forecast
  - [ ] Test alert logic

**Commit message:** `feat: add Open-Meteo weather integration (current/forecast/alerts)`

---

## 🥈 TIER 2: Pro Features (Medium Priority)

### T2.1: Photo Analysis (Claude Vision) ⭐⭐⭐⭐

**Why:** Quality control + production tracking for farm

Tasks:
- [ ] **T2.1.1** Create `src/tools/vision.ts`
  - [ ] Define tool: `vision_analyze_image` (analyze photo)
  - [ ] Implement Claude Vision API
  - [ ] Extract: item count, quality, condition
  - [ ] Generate structured report

- [ ] **T2.1.2** Integration with KB
  - [ ] Store analysis in knowledge base
  - [ ] Track trends over time
  - [ ] Compare dates/conditions

- [ ] **T2.1.3** Telegram Integration
  - [ ] User sends photo in Telegram
  - [ ] Agent analyzes automatically
  - [ ] Reports back findings

- [ ] **T2.1.4** Test
  - [ ] Write `src/__tests__/vision.test.ts`
  - [ ] Test with sample images
  - [ ] Verify report structure

**Commit message:** `feat: add Claude Vision photo analysis (quality/count/condition)`

---

### T2.2: Analytics Dashboard ⭐⭐⭐⭐

**Why:** Monitor agent health + usage patterns

Tasks:
- [ ] **T2.2.1** Create `src/api/dashboard.ts`
  - [ ] GET /api/dashboard/stats
  - [ ] Return:
    - Tasks completed (total/week/today)
    - Average response time
    - Service health (czat/flow/kb status)
    - Top used tools
    - Facts learned count
    - Conversations total

- [ ] **T2.2.2** Add metrics tracking to D1
  - [ ] Create `metrics` table
  - [ ] Log each tool call
  - [ ] Track response times
  - [ ] Track errors

- [ ] **T2.2.3** Create simple dashboard HTML
  - [ ] Single page, self-contained
  - [ ] Show stats in real-time
  - [ ] Charts (ASCII or simple SVG)
  - [ ] Refresh every 30s

- [ ] **T2.2.4** Test
  - [ ] Verify stats accuracy
  - [ ] Check dashboard loads

**Commit message:** `feat: add analytics dashboard (/api/dashboard/stats)`

---

### T2.3: SMS/Push Notifications ⭐⭐⭐

**Why:** Agent can reach you off Telegram (in field)

Tasks:
- [ ] **T2.3.1** Create `src/tools/notifications.ts`
  - [ ] Define tool: `notify_sms` (send SMS)
  - [ ] Define tool: `notify_push` (send push notification)
  - [ ] Implement Twilio for SMS
  - [ ] Implement Firebase for push

- [ ] **T2.3.2** Add to env.ts
  - [ ] TWILIO_ACCOUNT_SID
  - [ ] TWILIO_AUTH_TOKEN
  - [ ] TWILIO_PHONE_NUMBER
  - [ ] FIREBASE_API_KEY
  - [ ] USER_PHONE_NUMBER

- [ ] **T2.3.3** Alert Rules
  - [ ] Critical errors → SMS + Push
  - [ ] Workflow completion → SMS (if urgent)
  - [ ] Reminders → Push
  - [ ] Configurable thresholds

- [ ] **T2.3.4** Test
  - [ ] Send test SMS
  - [ ] Send test push
  - [ ] Verify delivery

**Commit message:** `feat: add SMS/push notifications (Twilio + Firebase)`

---

## 🥉 TIER 3: Premium Features (Lower Priority)

### T3.1: Voice Transcription ⭐⭐⭐

**Why:** Hands-free note-taking in field

Tasks:
- [ ] **T3.1.1** Create `src/tools/voice.ts`
  - [ ] Define tool: `voice_transcribe` (transcribe audio)
  - [ ] Implement OpenAI Whisper API
  - [ ] Handle .ogg/.wav/.m4a formats
  - [ ] Return transcript + confidence

- [ ] **T3.1.2** Telegram Integration
  - [ ] User sends voice note
  - [ ] Auto-transcribe
  - [ ] Ask: "Create task from this?" / "Add to KB?"

- [ ] **T3.1.3** Add to env.ts
  - [ ] OPENAI_API_KEY (if not already)

- [ ] **T3.1.4** Test
  - [ ] Transcribe sample voice notes
  - [ ] Verify accuracy

**Commit message:** `feat: add voice transcription (Whisper API)`

---

### T3.2: Location Tracking ⭐⭐⭐

**Why:** Agent knows where you are

Tasks:
- [ ] **T3.2.1** Create `src/tools/location.ts`
  - [ ] Define tool: `location_current` (get current location)
  - [ ] Define tool: `location_nearby` (find nearby places)
  - [ ] Implement IP geolocation (fallback)
  - [ ] Implement GPS via Telegram (if shared)

- [ ] **T3.2.2** Integration with Weather
  - [ ] "What's weather where I am?" → uses location
  - [ ] Gives hyperlocal forecast

- [ ] **T3.2.3** Integration with Tasks
  - [ ] "Show tasks near me"
  - [ ] "Closest water point?"

- [ ] **T3.2.4** Test
  - [ ] Get current location
  - [ ] Find nearby POIs

**Commit message:** `feat: add location tracking (geolocation + nearby search)`

---

### T3.3: PDF Document Parser ⭐⭐⭐

**Why:** Extract info from contracts/documents

Tasks:
- [ ] **T3.3.1** Create `src/tools/documents.ts`
  - [ ] Define tool: `document_parse_pdf` (extract text from PDF)
  - [ ] Define tool: `document_summarize` (summarize document)
  - [ ] Implement PDF.js or similar
  - [ ] Use Claude to extract structured info

- [ ] **T3.3.2** Telegram Integration
  - [ ] User sends PDF
  - [ ] Auto-extract key info
  - [ ] Summarize
  - [ ] Store in KB

- [ ] **T3.3.3** Test
  - [ ] Parse sample PDFs
  - [ ] Extract structured data
  - [ ] Verify summaries

**Commit message:** `feat: add PDF document parsing and summarization`

---

## 🚀 TIER 4: Advanced Features (Backlog)

### T4.1: Video Processing
- [ ] Extract key frames
- [ ] Analyze video for anomalies
- [ ] Generate timestamped highlights

### T4.2: Custom Bank API Integration
- [ ] Fetch account balance
- [ ] Get transaction history
- [ ] Track cash flow

### T4.3: Slack/Discord Integration
- [ ] Send briefings to Slack
- [ ] Receive commands from Slack
- [ ] Sync conversations

### T4.4: Git Repository Monitoring
- [ ] Monitor pushes to repos
- [ ] Alert on failed CI/CD
- [ ] Track deployments

### T4.5: Multi-User/Family Mode
- [ ] Create separate user contexts
- [ ] Assign tasks per person
- [ ] Private + shared memories

---

## 📋 Implementation Strategy

### Phase Timeline

**WEEK 1-2 (TIER 1):**
- [ ] Calendar integration
- [ ] Email integration
- [ ] Weather integration

**WEEK 3-4 (TIER 2 Part 1):**
- [ ] Photo analysis
- [ ] Analytics dashboard

**WEEK 5-6 (TIER 2 Part 2):**
- [ ] SMS/Push notifications
- [ ] Voice transcription

**WEEK 7+ (TIER 3):**
- [ ] Location tracking
- [ ] Document parser
- [ ] Advanced features as time permits

---

## 🔄 Testing & Validation

For each tool:
- [ ] Unit tests (mock API)
- [ ] Integration tests (real API in dev environment)
- [ ] Manual testing in Telegram
- [ ] Error scenarios (API down, timeout, malformed response)

---

## 📊 Current Status

```
TIER 1:
  Calendar:     ░░░░░░░░░░░░░░░░░░░░ 0%
  Email:        ░░░░░░░░░░░░░░░░░░░░ 0%
  Weather:      ░░░░░░░░░░░░░░░░░░░░ 0%

TIER 2:
  Photo:        ░░░░░░░░░░░░░░░░░░░░ 0%
  Dashboard:    ░░░░░░░░░░░░░░░░░░░░ 0%
  Notify:       ░░░░░░░░░░░░░░░░░░░░ 0%

TIER 3:
  Voice:        ░░░░░░░░░░░░░░░░░░░░ 0%
  Location:     ░░░░░░░░░░░░░░░░░░░░ 0%
  Documents:    ░░░░░░░░░░░░░░░░░░░░ 0%
```

---

## 🎯 "Max Pro" Target

After completing TIER 1 + TIER 2:

Agent will know:
- ✅ Your schedule
- ✅ Your emails
- ✅ Your location
- ✅ Weather forecast
- ✅ Product quality (photos)
- ✅ System health (dashboard)
- ✅ Can reach you on SMS

Agent can:
- ✅ Auto-create tasks from emails
- ✅ Suggest work times based on weather
- ✅ Analyze quality of work
- ✅ Send critical alerts to SMS
- ✅ Show analytics of agent usage

---

## Notes for Agents

- Each tool is independent (can implement in any order)
- Tools follow same pattern: `src/tools/{name}.ts`
- Must register in `src/tools/index.ts`
- Must add env vars to `src/env.ts`
- Must include tests in `src/__tests__/{name}.test.ts`
- Commit after each tool completes
