# One-Time Popup/Notification System

## Overview
This system ensures popups/notifications only appear once per device. After clicking "OK", the popup will never show again.

## Files Created
1. `src/services/popupTracker.js` - Tracks which popups have been shown
2. `src/components/OneTimeModal.js` - Wrapper component for one-time modals
3. `src/examples/OneTimeModalExample.js` - Usage examples

## Quick Start

### Basic Usage

```javascript
import OneTimeModal from '../components/OneTimeModal';

function MyScreen() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button onPress={() => setShowModal(true)} title="Show Popup" />
      
      <OneTimeModal
        popupId="unique_popup_id"
        modalType="success"
        visible={showModal}
        onClose={() => setShowModal(false)}
        title="Important Notice"
        message="This will only show once!"
        primaryActionText="OK"
      />
    </>
  );
}
```

## Modal Types

### 1. Success Modal
```javascript
<OneTimeModal
  popupId="welcome_success"
  modalType="success"
  visible={visible}
  onClose={handleClose}
  title="Success!"
  message="Operation completed successfully."
/>
```

### 2. Error Modal
```javascript
<OneTimeModal
  popupId="error_notice"
  modalType="error"
  visible={visible}
  onClose={handleClose}
  title="Error"
  message="Something went wrong."
  type="error"
/>
```

### 3. Confirmation Modal
```javascript
<OneTimeModal
  popupId="confirm_action"
  modalType="confirmation"
  visible={visible}
  onClose={handleClose}
  onConfirm={handleConfirm}
  title="Confirm"
  message="Are you sure?"
/>
```

## Important Props

- `popupId` (required): Unique identifier for the popup
- `modalType`: 'success', 'error', or 'confirmation'
- `visible`: Controls visibility
- `onClose`: Called when modal closes
- All other props are passed to the underlying modal component

## Advanced Features

### Reset a Specific Popup
```javascript
import { popupTracker } from '../services/popupTracker';

// Allow popup to show again
await popupTracker.reset('unique_popup_id');
```

### Reset All Popups
```javascript
import { popupTracker } from '../services/popupTracker';

// Reset all one-time popups (useful for testing)
await popupTracker.resetAll();
```

### Check if Popup Has Been Shown
```javascript
import { popupTracker } from '../services/popupTracker';

const hasShown = await popupTracker.hasShown('unique_popup_id');
if (!hasShown) {
  // Show popup
}
```

## Real-World Examples

### Welcome Message (First Time Only)
```javascript
useEffect(() => {
  setShowWelcome(true);
}, []);

<OneTimeModal
  popupId="app_welcome"
  modalType="success"
  visible={showWelcome}
  onClose={() => setShowWelcome(false)}
  title="Welcome to TarTrack!"
  message="Thank you for using our app."
/>
```

### Feature Announcement
```javascript
<OneTimeModal
  popupId="new_feature_v2"
  modalType="info"
  visible={showFeature}
  onClose={() => setShowFeature(false)}
  title="New Feature!"
  message="Check out our new ride tracking feature."
/>
```

### Important Notice
```javascript
<OneTimeModal
  popupId="terms_update_2024"
  modalType="warning"
  visible={showNotice}
  onClose={() => setShowNotice(false)}
  title="Terms Updated"
  message="Our terms of service have been updated."
/>
```

## Tips

1. **Unique IDs**: Always use unique `popupId` values
2. **Version IDs**: Include version numbers in IDs for updates (e.g., "welcome_v2")
3. **Testing**: Use `popupTracker.resetAll()` during development
4. **User Control**: Consider adding a settings option to reset popups

## Storage
- Uses AsyncStorage to persist popup state
- Data persists across app restarts
- Cleared only when app is uninstalled or manually reset
