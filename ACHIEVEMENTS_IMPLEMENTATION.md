# Achievements Implementation Plan

## New Badges to Add

### One-Time Achievements (can only be earned once)

1. **Day 1 Execution** (`10hours_at_leastfor30days.png`) - 10+ hours daily for 30 consecutive days
2. **14 Hours Daily for a Month** (`14hoursdailyforamonth.png`) - 14+ hours daily for 30 consecutive days
3. **1,000-Hour Club** (`godlmedal_for_1000hours.png`) - 1,000 total lifetime hours
4. **Elon Musk 100+ Hours/week** (`musk_badge_for_100hours_plus_perweek.png`) - 100+ hours in a 7-day period

### Repeatable Achievements (can be earned multiple times)

5. **Bronze - 16 Hour Single Day Shift** (`bronze_medal_for_16hours_singledayshift.png`) - 16-hour focus shift in a single day
6. **Deep Monomaniacal Focus** (`complete 6 hours without single pause.png`) - 6 consecutive hours with zero pauses/interruptions
7. **Wartime Execution - 3 Consecutive 16-Hour Days** (`silverfor_3consecutive_16hours_days.png`) - 16-hour shifts for 3 consecutive days

## Implementation Steps

1. Add badge images to manifest.json as web_accessible_resources
2. Add achievement tracking fields in background.js
3. Update badge awarding logic in background.js
4. Update popup.js to render all badges in achievements section
5. Ensure concise display without taking too much space

## Storage Schema

```javascript
badgeData = {
  // Existing
  monthly: number,
  lifetime: number,
  lastBadgeDate: string,
  badgeMonth: string,

  // New - One-time achievements
  day1_30day_completed: boolean, // 30 days x 10+ hours
  day1_30day_14hr_completed: boolean, // 30 days x 14+ hours
  thousand_hours_completed: boolean, // 1,000 total hours
  elon_musk_weekly_completed: boolean, // 100+ hours per week

  // New - Repeatable achievements
  bronze_16hr_count: number, // Count of 16-hour single days
  six_hour_flow_count: number, // Count of 6-hour flow sessions
  silver_3x16_count: number, // Count of 3 consecutive 16-hour days
};
```
