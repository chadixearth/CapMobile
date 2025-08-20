# MobileApp (Expo Go + React Native)

## Folder Structure

```
MobileApp/
├── assets/                # Images and static assets
├── src/
│   ├── components/        # Reusable UI components
│   ├── screens/           # App screens (e.g., HomeScreen)
│   ├── services/          # API and business logic (e.g., Django REST API calls)
│   ├── navigation/        # Navigation setup (if you add more screens)
│   └── constants/         # App-wide constants
├── App.js                 # Main app entry (now in src/)
├── index.js               # Root file, points to App
├── package.json           # Project dependencies
└── ...
```

## Connecting to Django REST Framework
- Update the URL in `src/services/api.js` to point to your Django backend (e.g., `http://192.168.x.x:8000/api/example/`).
- Make sure your backend is accessible from your device/emulator.

## Example Usage
- The Home screen fetches data from the Django API and displays it.
- Add more screens/components as needed in their respective folders.

## Ejecting from Expo Go
- Run `npx expo eject` to switch to the bare workflow if you need native code or want to use the CLI/emulator directly.

## Install Dependencies
```
npm install
```

## Run the App
```
npx expo start
``` 