# Duration UI Update - Mobile App

## Changes Made

### 1. Screen UI (CustomPackageRequestScreen.js)
**User-Friendly Design:**
- Split duration into **two side-by-side inputs**: Hours | Minutes
- Added helper text: "Leave blank if unsure"
- Both fields are optional (tourist can fill one or both)
- Max 2 digits per field for clean input

**Visual Layout:**
```
┌─────────────────────────────────┐
│ Duration                        │
│ ┌──────────┐  ┌──────────┐     │
│ │  Hours   │  │ Minutes  │     │
│ └──────────┘  └──────────┘     │
│ Leave blank if unsure           │
└─────────────────────────────────┘
```

### 2. Service Layer (customPackageRequest.js)
- Added `preferred_duration_minutes` to API payload
- Both fields default to 0 if not provided
- Backend validates at least 1 minute total

### 3. User Experience

**Scenarios:**
1. **4 hours tour** → User enters: Hours=4, Minutes=blank
2. **30 minutes tour** → User enters: Hours=blank, Minutes=30
3. **2.5 hours tour** → User enters: Hours=2, Minutes=30
4. **Unsure** → User leaves both blank (backend will handle)

**Validation:**
- Backend ensures at least 1 minute if both provided
- No frontend validation needed (flexible for user)

## Files Modified

1. `src/screens/main/CustomPackageRequestScreen.js`
   - Added `preferredDurationMinutes` state
   - Split duration input into two fields
   - Added helper text style

2. `src/services/specialpackage/customPackageRequest.js`
   - Added `preferred_duration_minutes` to request payload

## Testing

✅ Test entering hours only
✅ Test entering minutes only
✅ Test entering both
✅ Test leaving both blank
✅ Verify API sends both fields correctly

## Backend Compatibility

✅ Backend already updated to accept both fields
✅ Database migration already created
✅ Validation in place (min 1 minute total)
