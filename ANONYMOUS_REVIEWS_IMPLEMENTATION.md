# Anonymous Reviews Implementation

## Overview
The anonymous review system allows tourists to submit reviews for tour packages and drivers without revealing their identity. When a review is marked as anonymous, the reviewer's name is hidden and displayed as "Anonymous" instead.

## Features

### ✅ Already Implemented

#### Backend (Django/Supabase)
- **Database Schema**: `is_anonymous` boolean field in both `package_reviews` and `driver_reviews` tables
- **API Support**: All review endpoints accept `is_anonymous` parameter
- **Review Display**: Anonymous reviews show "Anonymous" instead of reviewer name
- **Data Privacy**: Email addresses are hidden for anonymous reviews

#### Mobile App (React Native)
- **Anonymous Toggle**: Visual toggle switch in ReviewSubmissionScreen
- **User Preference**: Setting persisted via AsyncStorage
- **Visual Feedback**: Clear UI indication of anonymous mode
- **Dual Reviews**: Works for both package and driver reviews

## Implementation Details

### Database Schema
```sql
-- Package reviews table
ALTER TABLE package_reviews 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- Driver reviews table  
ALTER TABLE driver_reviews 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
```

### Backend API

#### Create Anonymous Package Review
```http
POST /api/reviews/
Content-Type: application/json

{
  "package_id": "uuid",
  "booking_id": "uuid", 
  "reviewer_id": "uuid",
  "rating": 5,
  "comment": "Great experience!",
  "is_anonymous": true
}
```

#### Create Anonymous Driver Review
```http
POST /api/reviews/driver/
Content-Type: application/json

{
  "driver_id": "uuid",
  "booking_id": "uuid",
  "reviewer_id": "uuid", 
  "rating": 5,
  "comment": "Excellent driver!",
  "is_anonymous": true
}
```

#### Review Display Logic
```python
# In reviews.py
if r.get('is_anonymous', False):
    display_name = 'Anonymous'
    reviewer_email = ''
else:
    display_name = reviewer_name or reviewer_email or 'Anonymous Tourist'
```

### Mobile App Implementation

#### Anonymous Toggle Component
```jsx
// In ReviewSubmissionScreen.js
<TouchableOpacity
  style={[
    styles.anonymousToggle,
    isAnonymous && styles.anonymousToggleActive
  ]}
  onPress={() => setIsAnonymous(!isAnonymous)}
>
  <View style={[
    styles.anonymousToggleThumb,
    isAnonymous && styles.anonymousToggleThumbActive
  ]} />
</TouchableOpacity>
```

#### Settings Persistence
```javascript
// In userSettings.js
export async function updateAnonymousReviewSetting(isAnonymous) {
  return await saveUserSettings({ anonymousReviews: isAnonymous });
}

export async function getAnonymousReviewSetting() {
  const settings = await getUserSettings();
  return { 
    success: true, 
    data: { isAnonymous: settings.data.anonymousReviews || false }
  };
}
```

## User Experience

### Review Submission Flow
1. **Complete Booking**: Tourist completes a tour booking
2. **Review Screen**: Navigate to ReviewSubmissionScreen
3. **Anonymous Option**: Toggle "Anonymous Review" switch
4. **Visual Feedback**: Toggle shows current state with animation
5. **Submit Review**: Review is saved with anonymous flag
6. **Display**: Review appears as "Anonymous" in public listings

### Anonymous Review Display
- **Name**: Shows "Anonymous" instead of reviewer name
- **Email**: Hidden completely for privacy
- **Rating**: Still displayed normally
- **Comment**: Displayed normally (user's choice what to share)
- **Date**: Displayed normally

## Privacy & Security

### Data Protection
- **Name Hiding**: Reviewer name never exposed in anonymous reviews
- **Email Protection**: Email addresses hidden for anonymous reviews
- **Audit Trail**: Internal logs still track reviewer for moderation
- **User Choice**: Each review can be individually set as anonymous

### Moderation Support
- **Admin Access**: Admins can still see reviewer identity for moderation
- **Audit Logs**: Full audit trail maintained for accountability
- **Report System**: Anonymous reviews can still be reported/moderated

## Testing

### Backend Testing
```bash
# Run the test script
node test_anonymous_reviews.js
```

### Mobile Testing
1. Open ReviewSubmissionScreen after completing a booking
2. Toggle "Anonymous Review" option ON
3. Submit review with rating and comment
4. Verify review appears as "Anonymous" in review listings
5. Test that setting is remembered across app sessions

### Test Scenarios
- ✅ Anonymous package review submission
- ✅ Anonymous driver review submission  
- ✅ Non-anonymous review submission
- ✅ Review display with proper name handling
- ✅ Settings persistence across app restarts

## Configuration

### Default Settings
```javascript
const DEFAULT_SETTINGS = {
  anonymousReviews: false, // Default to not anonymous
  notifications: true,
  locationSharing: true,
};
```

### Customization Options
- **Default Preference**: Can be changed in userSettings.js
- **UI Styling**: Toggle appearance customizable in ReviewSubmissionScreen
- **Text Labels**: All text can be customized for different languages

## Integration Points

### Existing Systems
- **Review System**: Seamlessly integrates with existing review functionality
- **User Settings**: Uses existing settings persistence system
- **Audit System**: Works with existing audit logging
- **UI Components**: Fits into existing app design patterns

### Database Compatibility
- **Backward Compatible**: Existing reviews default to non-anonymous
- **Migration Safe**: SQL migration adds column with safe defaults
- **Index Support**: Optional indexes for performance optimization

## Future Enhancements

### Potential Features
1. **Bulk Anonymous Setting**: Option to make all reviews anonymous by default
2. **Retroactive Anonymization**: Allow users to make past reviews anonymous
3. **Partial Anonymity**: Show initials instead of full "Anonymous"
4. **Anonymous Statistics**: Show anonymous vs named review ratios
5. **Admin Dashboard**: Better tools for managing anonymous reviews

### Analytics Integration
- Track anonymous vs named review rates
- Monitor user preference trends
- Measure impact on review submission rates
- A/B test different anonymous UI approaches

## Troubleshooting

### Common Issues
1. **Toggle Not Working**: Check AsyncStorage permissions
2. **Setting Not Persisting**: Verify userSettings.js import
3. **Reviews Still Show Name**: Check is_anonymous field in database
4. **API Errors**: Verify is_anonymous parameter in request body

### Debug Steps
1. Check browser/app console for errors
2. Verify database schema has is_anonymous columns
3. Test API endpoints directly with curl/Postman
4. Check AsyncStorage contents in development tools
5. Verify review display logic in backend code

## Deployment Checklist

### Backend
- [ ] Run SQL migration to add is_anonymous columns
- [ ] Deploy updated reviews.py with anonymous logic
- [ ] Test API endpoints with anonymous parameter
- [ ] Verify review display shows "Anonymous" correctly

### Mobile
- [ ] Deploy ReviewSubmissionScreen with anonymous toggle
- [ ] Deploy userSettings.js with anonymous preference
- [ ] Test toggle functionality and persistence
- [ ] Verify reviews display correctly in app
- [ ] Test end-to-end anonymous review flow

### Testing
- [ ] Run backend test script
- [ ] Test mobile anonymous toggle
- [ ] Verify review display in both anonymous and named modes
- [ ] Test settings persistence across app restarts
- [ ] Confirm privacy protection works correctly